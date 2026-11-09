import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

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

type PrefillDecision = {
  topic: string
  value: string
  source?: string
  source_ref?: string | null
  meeting_date?: string | null
}
type PrefillRoom = {
  section_code: string
  name: string
  decisions?: PrefillDecision[]
  open_questions?: { question: string; default_if_unanswered?: string | null; blocking?: boolean }[]
  redline_notes?: { note_type: string; text: string; source_ref?: string | null }[]
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { project: { name: string; client?: string }; rooms?: PrefillRoom[] }
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
        { project_id: project.id, section_code: room.section_code, name: room.name },
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
