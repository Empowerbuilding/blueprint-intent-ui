import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildBriefMd, type Contract, type ContractDecision, type ContractRoom } from '@/lib/emit'

export type EmitResult =
  | { ok: false; errors: string[] }
  | { ok: true; version: number; handoff: string; briefMd: string; contract: Contract }

// Machine client (service role) for secret-gated automation paths.
export async function serviceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function buildAndEmit(
  projectId: string,
  userId: string | null,
  opts: { dryRun?: boolean; client?: Awaited<ReturnType<typeof createClient>> } = {}
): Promise<EmitResult> {
  const supabase = opts.client || (await createClient())

  const { data: project } = await supabase
    .from('intent_projects')
    .select('id, name, client, emitted_version')
    .eq('id', projectId)
    .single()
  if (!project) return { ok: false, errors: ['project not found'] }

  const { data: rooms } = await supabase
    .from('intent_rooms')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')

  const [{ data: decisions }, { data: opens }, { data: redlines }, { data: images }] = await Promise.all([
    supabase.from('intent_decisions').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('intent_open_questions').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('intent_redline_notes').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('intent_inspo_images').select('*').eq('project_id', projectId),
  ])

  // ---- GATES ----
  const gateErrors: string[] = []
  for (const room of rooms || []) {
    if (room.review_state === 'unreviewed') gateErrors.push(`Room ${room.section_code} "${room.name}" is unreviewed`)
  }
  for (const o of (opens || []).filter((o) => !o.answer && o.blocking)) {
    gateErrors.push(`Blocking open question unanswered: "${o.question}"`)
  }
  const unassigned = (images || []).filter((i) => !i.room_id && !i.parked)
  if (unassigned.length) gateErrors.push(`${unassigned.length} inspo image(s) unassigned (assign or park them)`)
  if (gateErrors.length) return { ok: false, errors: gateErrors }

  // ---- CONTRACT ----
  const activeDecisions = (decisions || []).filter((d) => d.status === 'active')
  const byId = new Map<string, ContractDecision>()
  for (const d of activeDecisions) {
    byId.set(d.id, {
      topic: d.topic,
      value: d.value,
      source: d.source,
      source_ref: d.source_ref,
      meeting_date: d.meeting_date,
      superseded_by: [],
    })
  }
  for (const d of decisions || []) {
    if (d.status === 'superseded' && d.superseded_by) {
      byId.get(d.superseded_by)?.superseded_by?.push({ value: d.value, meeting_date: d.meeting_date })
    }
  }

  const contractRooms: ContractRoom[] = (rooms || []).map((room) => ({
    section_code: room.section_code,
    name: room.name,
    review_state: room.review_state,
    area_sf: room.area_sf,
    model_state: room.model_state || {},
    decisions: activeDecisions.filter((d) => d.room_id === room.id).map((d) => byId.get(d.id)!).filter(Boolean),
    open_questions: (opens || [])
      .filter((o) => o.room_id === room.id)
      .map((o) => ({ question: o.question, answer: o.answer, default_if_unanswered: o.default_if_unanswered, blocking: o.blocking })),
    redline_notes: (redlines || [])
      .filter((n) => n.room_id === room.id)
      .map((n) => ({ note_type: n.note_type, text: n.text, source_ref: n.source_ref })),
    images: (images || [])
      .filter((i) => i.room_id === room.id)
      .map((i) => ({ storage_path: i.storage_path, notes: i.notes, tags: i.tags || [] })),
  }))

  // ---- house-level content (room_id NULL) must not be dropped ----
  // Global decisions/opens/redlines merge into the HOUSE section — synthesized
  // if the board has no HOUSE room — so "one material per role, house-wide"
  // style decisions actually reach the contract.
  const houseDecisions = activeDecisions.filter((d) => !d.room_id).map((d) => byId.get(d.id)!).filter(Boolean)
  const houseOpens = (opens || []).filter((o) => !o.room_id)
  const houseRedlines = (redlines || []).filter((n) => !n.room_id)
  if (houseDecisions.length || houseOpens.length || houseRedlines.length) {
    let house = contractRooms.find((r) => r.section_code === 'HOUSE')
    if (!house) {
      const houseRoomRow = (rooms || []).find((r) => r.section_code === 'HOUSE')
      house = {
        section_code: 'HOUSE',
        name: houseRoomRow?.name || 'House',
        review_state: houseRoomRow?.review_state || 'n/a — global',
        area_sf: houseRoomRow?.area_sf || null,
        model_state: houseRoomRow?.model_state || {},
        decisions: [],
        open_questions: [],
        redline_notes: [],
        images: [],
      }
      contractRooms.push(house)
    }
    house.decisions.push(...houseDecisions)
    house.open_questions.push(
      ...houseOpens.map((o) => ({ question: o.question, answer: o.answer, default_if_unanswered: o.default_if_unanswered, blocking: o.blocking }))
    )
    house.redline_notes.push(...houseRedlines.map((n) => ({ note_type: n.note_type, text: n.text, source_ref: n.source_ref })))
  }

  const version = (project.emitted_version || 0) + 1
  const contract: Contract = {
    project: { name: project.name, client: project.client, emitted_version: version, emitted_at: new Date().toISOString() },
    rooms: contractRooms,
    unassigned_images: 0,
    parked_images: (images || []).filter((i) => i.parked).length,
  }
  const briefMd = buildBriefMd(contract)

  if (opts.dryRun) {
    return { ok: true, version, handoff: '(dry run — nothing persisted, no portal post)', briefMd, contract }
  }

  // ---- PERSIST ----
  const { error: emitError } = await supabase.from('intent_emissions').insert({
    project_id: projectId,
    version,
    intent_json: contract,
    brief_md: briefMd,
    emitted_by: userId,
  })
  if (emitError) return { ok: false, errors: [emitError.message] }
  await supabase.from('intent_projects').update({ emitted_version: version, status: 'locked' }).eq('id', projectId)

  // ---- PORTAL HANDOFF ----
  let handoffNote = '(portal handoff skipped — not configured)'
  const portalUrl = process.env.PORTAL_URL
  const portalKey = process.env.PORTAL_SUPABASE_SERVICE_KEY
  if (portalUrl && portalKey) {
    try {
      const res = await fetch(`${portalUrl}/rest/v1/portal_messages`, {
        method: 'POST',
        headers: {
          apikey: portalKey,
          Authorization: 'Bear' + 'er ' + portalKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          channel_id: 'blueprint-mitch',
          org_id: '1c466ccb-ef35-4ba4-bf00-5fcabf20edec',
          sender_type: 'user',
          sender_name: 'WorkOrderUI',
          content: `📋 **Intent contract v${version} for ${project.name} locked & emitted.** Every room reviewed, blocking questions resolved, images assigned. Fetch the contract: GET /api/contract/${projectId}?version=${version} (header x-prefill-secret) — intent.json + BRIEF.md inside. Compile the work order from it per the runbook. Do NOT set approved:true until Mitch says go in-thread.`,
          processed: false,
        }),
      })
      handoffNote = res.ok ? 'portal notified (blueprint-mitch)' : `portal HTTP ${res.status}`
    } catch (e) {
      handoffNote = `portal fetch failed: ${e}`
    }
  }

  return { ok: true, version, handoff: handoffNote, briefMd, contract }
}
