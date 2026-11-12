import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { runMathGate, type Geometry, type RuleRow } from '@/lib/rules'
import { visionGateInBackground } from '@/lib/outline-vision'

// POST /api/push-outline — Blueprint pushes a drafted 2D outline (zone map /
// elevation / section) with its geometry. Runs the math gate (rulebook) and the
// vision gate (GLM-4.6v vs the room's confirmed decisions) immediately; Michael
// reviews the results in the room card and approves or rejects.
//
// Auth: x-prefill-secret header (PREFILL_SECRET env) — machine-to-machine.
//
// Payload:
// {
//   "project_id": "<uuid>"            (or "project": {"name": "Whitaker"} / "project": "Whitaker")
//   "room": "B3"                       — section_code (or {"section_code": "B3"})
//   "outline": {
//     "type": "plan" | "elevation" | "section",
//     "label": "Zone map",                       (optional, groups revisions)
//     "image_b64": "<base64 png>", "media_type": "image/png",   (or "storage_path" if already uploaded)
//     "geometry": { "units": "in", "extent": {"w":240,"h":180},
//                   "elements": [ {"id":"island1","kind":"island","label":"Island","x":40,"y":60,"w":96,"h":48} ] },
//     "pushed_by": "blueprint"
//   }
// }
//
// Semantics: a push with the same (room, type, label) SUPERSEDES previous active
// outlines. A push to a 2d_approved room resets it to confirmed (new 2D
// invalidates the approval). Elevations use y-UP from floor; plans y-down.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    project_id?: string
    project?: string | { name?: string }
    room?: string | { section_code?: string }
    outline?: {
      type?: string
      label?: string
      image_b64?: string
      media_type?: string
      storage_path?: string
      geometry?: Geometry
      pushed_by?: string
    }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const outlineType = body.outline?.type
  if (!['plan', 'elevation', 'section'].includes(outlineType || '')) {
    return NextResponse.json({ error: 'outline.type must be plan | elevation | section' }, { status: 400 })
  }
  if (!body.outline?.image_b64 && !body.outline?.storage_path) {
    return NextResponse.json({ error: 'outline.image_b64 (or storage_path) required' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'service key not configured' }, { status: 500 })
  const supabase = createServiceClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---- resolve project ----
  const projectName = typeof body.project === 'string' ? body.project : body.project?.name
  let projectId = body.project_id || null
  if (!projectId && projectName) {
    const { data: p } = await supabase.from('intent_projects').select('id').eq('name', projectName).maybeSingle()
    if (p) projectId = p.id
  } else if (projectId) {
    const { data: p } = await supabase.from('intent_projects').select('id').eq('id', projectId).maybeSingle()
    if (!p) projectId = null
  }
  if (!projectId) return NextResponse.json({ error: 'project not found (pass project_id or project name)' }, { status: 404 })

  // ---- resolve room by section_code ----
  const sectionCode = typeof body.room === 'string' ? body.room : body.room?.section_code
  if (!sectionCode) return NextResponse.json({ error: 'room (section_code) required' }, { status: 400 })
  const { data: room } = await supabase
    .from('intent_rooms')
    .select('id, section_code, name, review_state')
    .eq('project_id', projectId)
    .eq('section_code', sectionCode)
    .maybeSingle()
  if (!room) {
    const { data: available } = await supabase
      .from('intent_rooms')
      .select('section_code, name')
      .eq('project_id', projectId)
      .order('sort_order')
    return NextResponse.json(
      { error: `room "${sectionCode}" not found in project`, available_rooms: available },
      { status: 404 }
    )
  }

  // ---- image: upload b64 to the intent-outlines bucket ----
  let storagePath = body.outline?.storage_path || null
  if (body.outline?.image_b64) {
    const label = (body.outline.label || outlineType!).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outline'
    storagePath = `${projectId}/${room.id}/${Date.now()}-${label}.png`
    const buf = Buffer.from(body.outline.image_b64, 'base64')
    if (buf.length > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'image too large (12MB max)' }, { status: 413 })
    }
    const { error: upErr } = await supabase.storage
      .from('intent-outlines')
      .upload(storagePath, buf, { contentType: body.outline.media_type || 'image/png', upsert: false })
    if (upErr) return NextResponse.json({ error: `storage upload failed: ${upErr.message}` }, { status: 500 })
  }

  const label = body.outline?.label || ''
  const geometry = body.outline?.geometry || {}

  // ---- supersede previous active outlines with same (room, type, label) ----
  // (rejected included — a redraft replaces the rejected draft; the feedback
  // stays on the superseded row in the DB)
  const { data: previous } = await supabase
    .from('intent_outlines')
    .select('id')
    .eq('room_id', room.id)
    .eq('outline_type', outlineType)
    .eq('label', label)
    .in('status', ['pushed', 'approved', 'rejected'])
  // what this push could NOT store. The outline row itself failing is a 500 below; these are the
  // writes around it, which used to fail without a word (Tony 2026-11-12: same guard as the board push)
  const notStored: { what: string; reason: string }[] = []
  const said = (e: { message?: string } | null | undefined) => (e && e.message ? e.message : 'the database gave no reason')
  let replacedId: string | null = null
  if (previous?.length) {
    replacedId = previous[0]!.id
    const { error: supErr } = await supabase
      .from('intent_outlines')
      .update({ status: 'superseded' })
      .in('id', previous.map((o: { id: string }) => o.id))
    if (supErr) notStored.push({ what: 'earlier outlines not superseded', reason: said(supErr) })
  }

  // ---- insert ----
  const { data: outline, error: insErr } = await supabase
    .from('intent_outlines')
    .insert({
      project_id: projectId,
      room_id: room.id,
      outline_type: outlineType,
      label,
      storage_path: storagePath,
      geometry,
      status: 'pushed',
      pushed_by: body.outline?.pushed_by || 'machine',
      replaces: replacedId,
    })
    .select('id')
    .single()
  if (insErr || !outline) return NextResponse.json({ error: insErr?.message || 'insert failed' }, { status: 500 })

  // ---- new 2D invalidates a prior 2d_approved room state ----
  if (room.review_state === '2d_approved') {
    const { error: resetErr } = await supabase.from('intent_rooms').update({ review_state: 'confirmed' }).eq('id', room.id)
    if (resetErr) notStored.push({ what: 'room not set back from 2D approved', reason: said(resetErr) })
  }

  // ---- MATH GATE (rulebook) ----
  const [{ data: ruleRows }, { data: latestVersion }] = await Promise.all([
    supabase.from('intent_rules').select('*').eq('active', true),
    supabase.from('intent_rulebook_versions').select('version').order('version', { ascending: false }).limit(1),
  ])
  const math = runMathGate(
    (ruleRows || []) as unknown as RuleRow[],
    { name: room.name, section_code: room.section_code },
    outlineType!,
    geometry,
    latestVersion?.[0]?.version ?? null
  )

  // ---- persist checks (math + vision placeholder) BEFORE firing the background job ----
  // (write-order matters: the background vision must never be able to clobber math)
  const checks: Record<string, unknown> = { math }
  let visionNote = 'skipped (no image)'
  if (storagePath) {
    checks.vision = { ran_at: new Date().toISOString(), model: 'glm-4.6v', status: 'running' }
    visionNote = 'running (background — lands on the outline card when done; poll GET /api/outlines or re-run via /api/verify-outline)'
  }
  const { error: checksErr } = await supabase.from('intent_outlines').update({ checks }).eq('id', outline.id)
  if (checksErr) notStored.push({ what: 'math result on the outline', reason: said(checksErr) })

  // ---- read the row back: what the app holds, for the sender to compare with what it sent ----
  const sentElements = Array.isArray((geometry as { elements?: unknown }).elements) ? ((geometry as { elements: unknown[] }).elements).length : 0
  const { data: kept, error: keptErr } = await supabase
    .from('intent_outlines')
    .select('id, status, outline_type, label, geometry, checks')
    .eq('id', outline.id)
    .maybeSingle()
  const keptGeometry = (kept?.geometry || {}) as { elements?: unknown }
  const keptElements = Array.isArray(keptGeometry.elements) ? keptGeometry.elements.length : 0
  const mathSaved = !!(kept?.checks && (kept.checks as { math?: unknown }).math)
  if (keptErr || !kept) notStored.push({ what: 'outline could not be read back', reason: said(keptErr) })
  else {
    if (keptElements !== sentElements) notStored.push({ what: 'elements', reason: 'the outline holds ' + keptElements + ' elements, ' + sentElements + ' were sent' })
    if (!mathSaved && !checksErr) notStored.push({ what: 'math result on the outline', reason: 'the saved outline carries no math result' })
  }

  // ---- VISION GATE (GLM-4.6v vs confirmed decisions) — background ----
  // ---- large images take 1-2+ min; push returns fast with math results ----
  if (storagePath) {
    visionGateInBackground(supabase, {
      outlineId: outline.id,
      projectId: projectId!,
      roomId: room.id,
      storagePath,
      outlineType: outlineType!,
      roomName: room.name,
    })
  }

  const mathFails = math.results.filter((r) => r.status === 'fail')

  return NextResponse.json({
    ok: true,
    outline_id: outline.id,
    project_id: projectId,
    room: `${room.section_code} ${room.name}`,
    superseded: previous?.length || 0,
    // complete: false when something this push should have written is not in the app; not_stored says what and why
    complete: notStored.length === 0,
    not_stored: notStored,
    stored: { elements: keptElements, sent_elements: sentElements, math_saved: mathSaved, status: kept?.status || null },
    math: { passed: math.passed, fails: mathFails, results: math.results },
    vision: visionNote,
    storage_path: storagePath,
    next: 'Michael reviews in the room card → approve, or reject with feedback (Blueprint gets woken via portal)',
  })
}
