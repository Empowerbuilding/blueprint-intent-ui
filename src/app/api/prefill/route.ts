import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { DECISION_SOURCES, normaliseRole, tidyName } from '@/lib/vocab'

// POST /api/prefill — design-brain pushes transcript-derived intent into the UI.
// Auth: x-prefill-secret header (PREFILL_SECRET env).
//
// Payload:
// {
//   "project": { "name": "Whitaker", "client": "..." },
//   "rooms": [
//     {
//       "section_code": "B3", "name": "Kitchen",
//       "decisions": [ { "topic": "backsplash", "value": "...", "source": "transcript",
//                        "source_ref": "11/06 14:22", "meeting_date": "2026-11-06" } ],
//       "open_questions": [ { "question": "...", "default_if_unanswered": "...", "blocking": true } ],
//       "redline_notes": [ { "note_type": "beam", "text": "...", "source_ref": "A101.1" } ]
//     }
//   ]
// }
//
// Upsert semantics: project by name, rooms by (project, section_code).
// Decisions: skipped when an identical active (topic, value) already exists.
//
// Typed pushes (contract v2) — all optional:
//   project.doc            the Revit file title Blueprint works in
//   room.role              one of the room roles (GET /api/vocabulary)
//   room.shell_changed     true when a decision changes the room's walls / size
//   room.level             the model's level name for the room; when absent, model_state.level is used (SPEC A71)
//   decision.kind, .params the kind of work (GET /api/vocabulary) and its numbers
//   redline_note.kind
// A kind or role that is not in the vocabulary refuses the WHOLE push (422, nothing written).
// decision.source is one of the app's sources (GET /api/vocabulary, decision_sources); without one a line is stored as "transcript".
//
// What the reply says (SPEC A123). No row is dropped without a word:
//   rooms, decisions.inserted, decisions.skipped_duplicate, open_questions, open_questions_skipped_duplicate, redline_notes
//                          what went in, and what was already there
//   complete               false when at least one row that was sent is not in the app after the push
//   not_inserted           { rooms, decisions, open_questions, redline_notes: how many were not stored,
//                            first: up to 10 of them as { room, what, row, reason },
//                            redline_notes_failed: every redline note not stored as { room, index } (index in the room's list as sent) }
// A row that fails does not stop the push: the others still go in, and the reply is still 200 with ok: true.
// Whether a room gets 2D drawings is NOT accepted here: a person says so in the app. The same goes for the room's
// interior sheet group: a push cannot set it.

type PrefillDecision = {
  topic: string
  value: string
  source?: string
  source_ref?: string | null
  meeting_date?: string | null
  kind?: string | null
  params?: Record<string, unknown> | null
}
type PrefillRoom = {
  section_code: string
  name: string
  source?: 'template' | 'model_scan'
  area_sf?: number | null
  model_state?: Record<string, unknown>
  role?: string | null
  shell_changed?: boolean
  level?: string | null
  decisions?: PrefillDecision[]
  open_questions?: { question: string; default_if_unanswered?: string | null; blocking?: boolean }[]
  redline_notes?: { note_type: string; text: string; source_ref?: string | null; kind?: string | null }[]
}

/** the level a pushed room is on: the explicit field, else what the scan recorded in model_state. '' = the push says nothing */
const levelOf = (room: PrefillRoom): string => {
  const raw = typeof room.level === 'string' ? room.level : typeof room.model_state?.level === 'string' ? room.model_state.level : ''
  return tidyName(raw)
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { project: { name: string; client?: string; doc?: string }; rooms?: PrefillRoom[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body?.project?.name) {
    return NextResponse.json({ error: 'project.name required' }, { status: 400 })
  }

  // machine-to-machine: secret verified above, use service role (bypasses RLS)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = serviceKey
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createClient()

  // typed fields are checked against the vocabulary BEFORE anything is written
  const wantKinds = new Set<string>()
  const badRoles: string[] = []
  for (const room of body.rooms || []) {
    if (room.role && !normaliseRole(room.role)) badRoles.push(room.section_code + ': ' + room.role)
    for (const d of room.decisions || []) if (d.kind) wantKinds.add(d.kind)
    for (const n of room.redline_notes || []) if (n.kind) wantKinds.add(n.kind)
  }
  if (wantKinds.size || badRoles.length) {
    let unknownKinds: string[] = []
    if (wantKinds.size) {
      const { data: kindRows, error: kindErr } = await supabase.from('intent_kinds').select('kind, active')
      if (kindErr || !kindRows) {
        return NextResponse.json({ error: 'the list of kinds could not be read, so a typed push cannot be checked. Nothing was written.' }, { status: 500 })
      }
      const known = new Set((kindRows as { kind: string; active: boolean }[]).filter((k) => k.active).map((k) => k.kind))
      unknownKinds = [...wantKinds].filter((k) => !known.has(k)).sort()
    }
    if (unknownKinds.length || badRoles.length) {
      return NextResponse.json(
        { error: 'not in the vocabulary — nothing was written', unknown_kinds: unknownKinds, unknown_roles: badRoles },
        { status: 422 },
      )
    }
  }

  // project upsert by name
  let { data: project } = await supabase
    .from('intent_projects')
    .select('id, name')
    .eq('name', body.project.name)
    .maybeSingle()
  if (!project) {
    const { data: created, error } = await supabase
      .from('intent_projects')
      .insert({ name: body.project.name, client: body.project.client || null })
      .select('id, name')
      .single()
    if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 })
    project = created
  }
  if (typeof body.project.doc === 'string' && body.project.doc.trim()) {
    await supabase.from('intent_projects').update({ doc_title: body.project.doc.trim() }).eq('id', project.id)
  }

  let roomsUpserted = 0
  let decisionsInserted = 0
  let decisionsSkipped = 0
  let opensInserted = 0
  let opensSkipped = 0
  let redlinesInserted = 0

  // rows that were sent and are NOT in the app after this push: counted, and the first ones carry the reason
  const FIRST_MAX = 10
  const missed = { rooms: 0, decisions: 0, open_questions: 0, redline_notes: 0 }
  const WHAT = { rooms: 'room', decisions: 'decision', open_questions: 'open question', redline_notes: 'redline note' } as const
  const first: { room: string; what: string; row: string; reason: string }[] = []
  const redlineFailed: { room: string; index: number }[] = []
  const short = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
  const miss = (what: keyof typeof missed, room: string, row: unknown, reason: string) => {
    missed[what]++
    if (first.length < FIRST_MAX) first.push({ room, what: WHAT[what], row: short(row, 80), reason: short(reason, 300) })
  }
  const said = (e: { message?: string } | null | undefined) => (e && e.message ? e.message : 'the database gave no reason')
  const known = DECISION_SOURCES as readonly string[]

  for (const room of body.rooms || []) {
    const code = String(room.section_code || '')
    // a room that is not stored takes its lines with it: they are counted too
    const missRoom = (reason: string) => {
      miss('rooms', code, room.name, reason)
      missed.decisions += (room.decisions || []).length
      missed.open_questions += (room.open_questions || []).length
      ;(room.redline_notes || []).forEach((_n, index) => {
        missed.redline_notes++
        redlineFailed.push({ room: code, index })
      })
    }
    if (!room.section_code || !room.name) {
      missRoom('a room needs a number (section_code) and a name')
      continue
    }
    const { data: roomRow, error: roomErr } = await supabase
      .from('intent_rooms')
      .upsert(
        {
          project_id: project.id,
          section_code: room.section_code,
          name: room.name,
          ...(room.source ? { source: room.source } : {}),
          ...(room.area_sf != null ? { area_sf: room.area_sf } : {}),
          ...(room.model_state ? { model_state: room.model_state } : {}),
          ...(room.role ? { role: normaliseRole(room.role), typed_by: 'blueprint', typed_at: new Date().toISOString() } : {}),
          ...(room.shell_changed === true ? { shell_changed: true } : {}),
          ...(levelOf(room) ? { level: levelOf(room) } : {}),
        },
        { onConflict: 'project_id,section_code' }
      )
      .select('id')
      .single()
    if (!roomRow) {
      missRoom('the room was not stored: ' + said(roomErr))
      continue
    }
    roomsUpserted++

    for (const d of room.decisions || []) {
      if (!d.topic || !d.value) {
        miss('decisions', code, d.topic || d.value, 'a decision needs a topic and a value')
        continue
      }
      const { data: existing } = await supabase
        .from('intent_decisions')
        .select('id')
        .eq('project_id', project.id)
        .eq('room_id', roomRow.id)
        .eq('topic', d.topic)
        .eq('value', d.value)
        .eq('status', 'active')
        .maybeSingle()
      if (existing) {
        decisionsSkipped++
        continue
      }
      const { error } = await supabase.from('intent_decisions').insert({
        project_id: project.id,
        room_id: roomRow.id,
        topic: d.topic,
        value: d.value,
        source: d.source || 'transcript',
        source_ref: d.source_ref || null,
        meeting_date: d.meeting_date || null,
        ...(d.kind ? { kind: d.kind, kind_set_by: 'blueprint', kind_set_at: new Date().toISOString() } : {}),
        ...(d.params && typeof d.params === 'object' ? { params: d.params } : {}),
      })
      if (!error) decisionsInserted++
      else {
        const why = d.source && !known.includes(d.source) ? 'the source "' + d.source + '" is not one the app knows (' + known.join(', ') + '). The database said: ' : ''
        miss('decisions', code, d.topic + ': ' + d.value, why + said(error))
      }
    }

    for (const o of room.open_questions || []) {
      if (!o.question) {
        miss('open_questions', code, '', 'an open question needs its question')
        continue
      }
      const { data: existingOpen } = await supabase
        .from('intent_open_questions')
        .select('id')
        .eq('project_id', project.id)
        .eq('room_id', roomRow.id)
        .eq('question', o.question)
        .maybeSingle()
      if (existingOpen) {
        opensSkipped++
        continue
      }
      const { error } = await supabase.from('intent_open_questions').insert({
        project_id: project.id,
        room_id: roomRow.id,
        question: o.question,
        default_if_unanswered: o.default_if_unanswered || null,
        blocking: o.blocking ?? true,
      })
      if (!error) opensInserted++
      else miss('open_questions', code, o.question, said(error))
    }

    for (const [index, r] of (room.redline_notes || []).entries()) {
      if (!r.text) {
        miss('redline_notes', code, r.note_type, 'a redline note needs its text')
        redlineFailed.push({ room: code, index })
        continue
      }
      const { error } = await supabase.from('intent_redline_notes').insert({
        project_id: project.id,
        room_id: roomRow.id,
        note_type: r.note_type || 'note',
        text: r.text,
        source_ref: r.source_ref || null,
        ...(r.kind ? { kind: r.kind } : {}),
      })
      if (!error) redlinesInserted++
      else {
        miss('redline_notes', code, r.text, said(error))
        redlineFailed.push({ room: code, index })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    project_id: project.id,
    rooms: roomsUpserted,
    decisions: { inserted: decisionsInserted, skipped_duplicate: decisionsSkipped },
    open_questions: opensInserted,
    open_questions_skipped_duplicate: opensSkipped,
    redline_notes: redlinesInserted,
    complete: missed.rooms + missed.decisions + missed.open_questions + missed.redline_notes === 0,
    not_inserted: { ...missed, first, redline_notes_failed: redlineFailed },
  })
}
