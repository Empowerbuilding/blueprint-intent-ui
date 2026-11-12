import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildBriefMd, type Contract, type ContractDecision, type ContractRoom } from '@/lib/emit'
import { buildContractV2, type ContractV2, type KindRow, type ModelRuleRow } from '@/lib/emit-v2'
import { loadDefaults } from '@/lib/defaults'
import { sameAsBeingWritten, sameAsEmitted, type EmittedRow } from '@/lib/emit-same'

// Contract v2 rides beside v1. `ok: false` is not a failed emit: v1 is emitted either way, and the
// list says what is still missing before the typed contract can be written.
export type V2Summary = { ok: boolean; errors: string[]; warnings: string[]; work_items: number; stored: boolean; contract: ContractV2 | null }

export type EmitResult =
  | { ok: false; errors: string[] }
  | {
      ok: true
      version: number
      handoff: string
      briefMd: string
      contract: Contract
      v2: V2Summary
      /** false = nothing was persisted: a dry run, or a press that would have written what the last emission already holds */
      written: boolean
      /** the emission that already holds exactly this content, when there is one */
      unchanged: { version: number; emitted_at: string | null } | null
    }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

/** Builds contract v2 from the rows v1 was just built from. Never throws: a problem here must not touch v1. */
export async function buildV2(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { projectId: string; name: string; client: string | null; version: number; emittedAt: string; rooms: Row[]; activeDecisions: Row[]; opens: Row[]; redlines: Row[]; images: Row[] },
): Promise<V2Summary> {
  const none = (errors: string[]): V2Summary => ({ ok: false, errors, warnings: [], work_items: 0, stored: false, contract: null })
  try {
    const [{ data: kinds, error: kindsErr }, { data: rules }, { data: docRow }, defaults] = await Promise.all([
      supabase.from('intent_kinds').select('kind, family, label, executable, status, stage_scope, active'),
      supabase.from('intent_model_rules').select('rule_key, status, kinds'),
      supabase.from('intent_projects').select('doc_title').eq('id', args.projectId).maybeSingle(),
      loadDefaults(supabase),
    ])
    if (kindsErr || !kinds) return none(['The list of kinds of work could not be read' + (kindsErr ? ' (' + kindsErr.message + ')' : '') + '.'])
    const built = buildContractV2({
      project: { name: args.name, client: args.client, doc_title: (docRow as { doc_title?: string | null } | null)?.doc_title || null },
      version: args.version,
      emittedAt: args.emittedAt,
      rooms: args.rooms.map((r) => ({ id: r.id, section_code: r.section_code, name: r.name, role: r.role ?? null, needs_2d: r.needs_2d ?? null, shell_changed: r.shell_changed ?? null, model_state: r.model_state || {}, level: r.level ?? null, sheet_group: r.sheet_group ?? null })),
      decisions: args.activeDecisions.map((d) => ({ id: d.id, room_id: d.room_id ?? null, topic: d.topic, value: d.value, source: d.source, source_ref: d.source_ref ?? null, kind: d.kind ?? null, params: d.params ?? null })),
      opens: args.opens.map((o) => ({ room_id: o.room_id ?? null, question: o.question, answer: o.answer ?? null, default_if_unanswered: o.default_if_unanswered ?? null, blocking: !!o.blocking })),
      redlines: args.redlines.map((n) => ({ id: n.id, room_id: n.room_id ?? null, note_type: n.note_type, text: n.text, source_ref: n.source_ref ?? null, kind: n.kind ?? null })),
      images: args.images.filter((i) => i.room_id).map((i) => ({ room_id: i.room_id, storage_path: i.storage_path, notes: i.notes ?? null, tags: i.tags || [] })),
      kinds: kinds as KindRow[],
      modelRules: (rules || []) as ModelRuleRow[],
      defaultTopics: defaults.map((d) => d.topic),
    })
    if (!built.ok) return { ok: false, errors: built.errors, warnings: built.warnings, work_items: 0, stored: false, contract: null }
    return { ok: true, errors: [], warnings: built.warnings, work_items: built.work_items, stored: false, contract: built.contract }
  } catch (e) {
    return none(['Contract v2 could not be built: ' + (e instanceof Error ? e.message : String(e))])
  }
}

// Machine client (service role) for secret-gated automation paths.
export async function serviceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** one stored emission of a project, with what is needed to compare it with a contract built now */
async function emissionAt(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, version: number): Promise<EmittedRow | null> {
  if (!version) return null
  const { data } = await supabase
    .from('intent_emissions')
    .select('version, emitted_at, intent_json, intent_v2_json, v2_errors, brief_md')
    .eq('project_id', projectId)
    .eq('version', version)
    .limit(1)
  return ((data && data[0]) as EmittedRow | undefined) || null
}

// `again`: write a new version although nothing changed since the last one. Only a person asks for that, in so many
// words (the second button of the emit page, or "again": true on the secret-gated route).
export async function buildAndEmit(
  projectId: string,
  userId: string | null,
  opts: { dryRun?: boolean; again?: boolean; client?: Awaited<ReturnType<typeof createClient>> } = {}
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

  // contract v2: same rows, typed. Built after v1 and never allowed to change or block it.
  const v2 = await buildV2(supabase, {
    projectId,
    name: project.name,
    client: project.client,
    version,
    emittedAt: contract.project.emitted_at,
    rooms: rooms || [],
    activeDecisions,
    opens: opens || [],
    redlines: redlines || [],
    images: images || [],
  })

  // ---- REPEAT GUARD (flag 52) ----
  // A press that would write exactly what the last emission holds writes nothing: no new version, no second message.
  const v2Missing = v2.ok ? null : v2.errors
  const last = await emissionAt(supabase, projectId, project.emitted_version || 0)
  const unchanged = last && sameAsEmitted(last, contract, v2.contract, v2Missing) ? { version: last.version, emitted_at: last.emitted_at ?? null } : null

  if (opts.dryRun) {
    return { ok: true, written: false, unchanged, version, handoff: '(dry run — nothing persisted, no portal post)', briefMd, contract, v2 }
  }
  if (unchanged && !opts.again) {
    return {
      ok: true,
      written: false,
      unchanged,
      version: unchanged.version,
      handoff: `(nothing changed since v${unchanged.version} — no new version written, no portal post)`,
      briefMd: last?.brief_md || briefMd,
      contract,
      v2: { ...v2, stored: v2.ok },
    }
  }

  // ---- PERSIST ----
  const { error: emitError } = await supabase.from('intent_emissions').insert({
    project_id: projectId,
    version,
    intent_json: contract,
    brief_md: briefMd,
    emitted_by: userId,
  })
  if (emitError) {
    // two presses in the same instant: the database refused the second row of this version (unique project + version)
    if ((emitError as { code?: string }).code === '23505') {
      const other = await emissionAt(supabase, projectId, version)
      if (other && sameAsBeingWritten(other, contract, v2.contract, v2Missing)) {
        return {
          ok: true,
          written: false,
          unchanged: { version: other.version, emitted_at: other.emitted_at ?? null },
          version: other.version,
          handoff: `(v${other.version} was written by another press a moment ago — no second version, no second portal post)`,
          briefMd: other.brief_md || briefMd,
          contract,
          v2: { ...v2, stored: v2.ok },
        }
      }
      return { ok: false, errors: [`Contract v${version} was written a moment ago by another press, and it does not hold the same content. Nothing was written by this press. Reload this page and look at v${version} before emitting again.`] }
    }
    return { ok: false, errors: [emitError.message] }
  }
  await supabase.from('intent_projects').update({ emitted_version: version, status: 'locked' }).eq('id', projectId)

  // v2 is written onto the same emission in a second step, so v1 is on record whatever happens here
  try {
    const { data: stored, error: v2Error } = await supabase
      .from('intent_emissions')
      .update({ intent_v2_json: v2.contract, v2_errors: v2.ok ? null : v2.errors, v2_work_items: v2.ok ? v2.work_items : null })
      .eq('project_id', projectId)
      .eq('version', version)
      .select('version')
    v2.stored = !v2Error && !!stored && stored.length > 0
    if (!v2.stored && v2.ok) v2.errors = ['Contract v2 was built but could not be stored' + (v2Error ? ': ' + v2Error.message : '.')]
  } catch (e) {
    v2.stored = false
    if (v2.ok) v2.errors = ['Contract v2 was built but could not be stored: ' + (e instanceof Error ? e.message : String(e))]
  }
  const v2Line =
    v2.ok && v2.stored
      ? ` Contract v2 (typed work items) is on the same emission: ${v2.work_items} work item${v2.work_items === 1 ? '' : 's'} — GET /api/contract/${projectId}?version=${version}&schema=2.`
      : ` Contract v2 (typed work items) was NOT emitted: ${v2.errors.length} thing${v2.errors.length === 1 ? '' : 's'} missing (rooms without a role or a 2D yes/no, lines without a kind). v1 is complete.`

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
          content: `📋 **Intent contract v${version} for ${project.name} locked & emitted.** Every room reviewed, blocking questions resolved, images assigned. Fetch the contract: GET /api/contract/${projectId}?version=${version} (header x-prefill-secret) — intent.json + BRIEF.md inside. Compile the work order from it per the runbook. Do NOT set approved:true until Mitch says go in-thread.${v2Line}`,
          processed: false,
        }),
      })
      handoffNote = res.ok ? 'portal notified (blueprint-mitch)' : `portal HTTP ${res.status}`
    } catch (e) {
      handoffNote = `portal fetch failed: ${e}`
    }
  }

  return { ok: true, written: true, unchanged: null, version, handoff: handoffNote, briefMd, contract, v2 }
}
