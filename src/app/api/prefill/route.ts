import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { normaliseRole, tidyName } from '@/lib/vocab'

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
  let redlinesInserted = 0

  for (const room of body.rooms || []) {
    if (!room.section_code || !room.name) continue
    const { data: roomRow } = await supabase
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
    if (!roomRow) continue
    roomsUpserted++

    for (const d of room.decisions || []) {
      if (!d.topic || !d.value) continue
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
    }

    for (const o of room.open_questions || []) {
      if (!o.question) continue
      const { data: existingOpen } = await supabase
        .from('intent_open_questions')
        .select('id')
        .eq('project_id', project.id)
        .eq('room_id', roomRow.id)
        .eq('question', o.question)
        .maybeSingle()
      if (existingOpen) continue
      const { error } = await supabase.from('intent_open_questions').insert({
        project_id: project.id,
        room_id: roomRow.id,
        question: o.question,
        default_if_unanswered: o.default_if_unanswered || null,
        blocking: o.blocking ?? true,
      })
      if (!error) opensInserted++
    }

    for (const r of room.redline_notes || []) {
      if (!r.text) continue
      const { error } = await supabase.from('intent_redline_notes').insert({
        project_id: project.id,
        room_id: roomRow.id,
        note_type: r.note_type || 'note',
        text: r.text,
        source_ref: r.source_ref || null,
        ...(r.kind ? { kind: r.kind } : {}),
      })
      if (!error) redlinesInserted++
    }
  }

  return NextResponse.json({
    ok: true,
    project_id: project.id,
    rooms: roomsUpserted,
    decisions: { inserted: decisionsInserted, skipped_duplicate: decisionsSkipped },
    open_questions: opensInserted,
    redline_notes: redlinesInserted,
  })
}
