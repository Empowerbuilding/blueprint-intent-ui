// Contract v2 (Intent Pipeline v2, milestone M1): the typed, executable projection of the same data
// contract v1 is built from. Pure: no database, no clock. Built beside v1 at every Lock & Emit;
// v1 is never changed by anything in this file.
//
// v2 is only emitted when NOTHING is missing: every room has a role and a 2D yes/no, and every
// active decision and redline note has a kind from the vocabulary. Anything missing is returned as
// a list, never guessed and never dropped.
// Relative imports and erasable types only: scripts/test-libs.mjs imports this file directly.

import { createHash } from 'node:crypto'
import { CONTEXT_KIND, SHELL_KINDS, isHouseSection, normaliseRole } from './vocab.ts'

export const V2_SCHEMA = 'intent-contract/2.0'

export type KindRow = { kind: string; family: string; label: string; executable: boolean; status: string; stage_scope: string | null; active: boolean }
export type ModelRuleRow = { rule_key: string; status: string; kinds: string[] | null }
export type V2Project = { name: string; client: string | null; doc_title: string | null }
export type V2RoomIn = {
  id: string
  section_code: string
  name: string
  role: string | null
  needs_2d: boolean | null
  shell_changed: boolean | null
  model_state: Record<string, unknown> | null
}
export type V2DecisionIn = {
  id: string
  room_id: string | null
  topic: string
  value: string
  source: string
  source_ref: string | null
  kind: string | null
  params: Record<string, unknown> | null
}
export type V2OpenIn = { room_id: string | null; question: string; answer: string | null; default_if_unanswered: string | null; blocking: boolean }
export type V2RedlineIn = { id: string; room_id: string | null; note_type: string; text: string; source_ref: string | null; kind: string | null }
export type V2ImageIn = { room_id: string | null; storage_path: string; notes: string | null; tags: string[] | null }

export type WorkItem = {
  id: string
  kind: string
  room: string
  summary: string
  params: Record<string, unknown>
  target: null
  provenance: { decision_id: string | null; redline_id?: string; source: string; evidence: string | null }
  acceptance: string[]
  depends_on: string[]
  judgment: null
}
export type ContextLine = { text: string; source: string; evidence: string | null }
export type V2Open = { question: string; default: string | null; blocking: boolean; answer: string | null }
export type V2Room = {
  section_code: string
  name: string
  role: string
  needs_2d: boolean
  shell_changed: boolean
  model_state: Record<string, unknown>
  work_items: WorkItem[]
  context: ContextLine[]
  opens: V2Open[]
  inspo: { storage_path: string; notes: string | null; tags: string[] }[]
}
export type ContractV2 = {
  schema: typeof V2_SCHEMA
  project: { name: string; slug: string; doc: string | null; client: string | null }
  version: number
  emitted_at: string
  sha256_intent: string
  vocabulary: { status: 'draft' | 'locked'; kinds: number }
  rooms: V2Room[]
  house: { work_items: WorkItem[]; context: ContextLine[]; opens: V2Open[]; defaults_applied: string[] }
  site: { work_items: WorkItem[] }
}
export type V2Result =
  | { ok: true; contract: ContractV2; warnings: string[]; work_items: number }
  | { ok: false; errors: string[]; warnings: string[] }

export const slugOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** the app's decision sources -> the contract's. A line typed by hand in the app stays "manual". */
const SOURCE_MAP: Record<string, string> = { transcript: 'meeting', redline: 'redline', inspo: 'inspo', default: 'default', manual: 'manual' }

// same canonical form Blueprint's contract_fetch.py hashes: sorted keys, no spaces
const canon = (v: unknown): string =>
  Array.isArray(v)
    ? '[' + v.map(canon).join(',') + ']'
    : v && typeof v === 'object'
      ? '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + canon((v as Record<string, unknown>)[k])).join(',') + '}'
      : JSON.stringify(v === undefined ? null : v)
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
/** the contract's own fingerprint: everything except the fingerprint field itself */
export function contractSha(contract: ContractV2): string {
  const rest: Record<string, unknown> = { ...contract }
  delete rest.sha256_intent
  return sha(canon(rest))
}
const itemId = (seed: string) => 'wi-' + sha(seed).slice(0, 8)
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function buildContractV2(input: {
  project: V2Project
  version: number
  emittedAt: string
  rooms: V2RoomIn[]
  decisions: V2DecisionIn[] // ACTIVE lines only
  opens: V2OpenIn[]
  redlines: V2RedlineIn[]
  images: V2ImageIn[]
  kinds: KindRow[]
  modelRules: ModelRuleRow[]
  defaultTopics: string[]
}): V2Result {
  const errors: string[] = []
  const warnings: string[] = []
  const vocab = new Map(input.kinds.filter((k) => k.active).map((k) => [k.kind, k]))
  if (!vocab.size) return { ok: false, errors: ['The list of kinds of work could not be read, so nothing can be typed.'], warnings }
  // a check is attached to a work item only once an approver has accepted it
  const acceptanceFor = (kind: string) =>
    input.modelRules.filter((r) => r.status === 'accepted' && (r.kinds || []).includes(kind)).map((r) => r.rule_key).sort()

  const roomById = new Map(input.rooms.map((r) => [r.id, r]))
  const houseRow = input.rooms.find((r) => isHouseSection(r.section_code)) || null
  const where = (roomId: string | null) => {
    const r = roomId ? roomById.get(roomId) : null
    return !r || isHouseSection(r.section_code) ? 'House-level' : 'Room ' + r.section_code + ' ' + r.name
  }
  const codeOf = (roomId: string | null) => {
    const r = roomId ? roomById.get(roomId) : null
    return !r || isHouseSection(r.section_code) ? 'HOUSE' : r.section_code
  }
  const isHouse = (roomId: string | null) => codeOf(roomId) === 'HOUSE'

  // ---- every line becomes a work item, a context line, or an error ----
  const items = new Map<string, WorkItem[]>() // by room code
  const context = new Map<string, ContextLine[]>()
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) || []), v])
  const seen = new Set<string>()
  const kindOk = (kind: string | null, label: string): kind is string => {
    if (!kind) {
      errors.push(label + ': no kind of work chosen')
      return false
    }
    if (!vocab.has(kind)) {
      errors.push(label + ': "' + kind + '" is not in the list of kinds of work')
      return false
    }
    return true
  }
  for (const d of input.decisions) {
    const label = where(d.room_id) + ' — decision "' + short(d.topic + ': ' + d.value) + '"'
    if (!kindOk(d.kind, label)) continue
    const source = SOURCE_MAP[d.source] || d.source
    if (!vocab.get(d.kind)!.executable) {
      push(context, codeOf(d.room_id), { text: d.topic + ': ' + d.value, source, evidence: d.source_ref })
      continue
    }
    const id = itemId('decision:' + d.id)
    if (seen.has(id)) errors.push(label + ': work item id ' + id + ' is used twice')
    seen.add(id)
    push(items, codeOf(d.room_id), {
      id,
      kind: d.kind,
      room: codeOf(d.room_id),
      summary: d.topic + ': ' + d.value,
      params: d.params && typeof d.params === 'object' && !Array.isArray(d.params) ? d.params : {},
      target: null,
      provenance: { decision_id: d.id, source, evidence: d.source_ref },
      acceptance: acceptanceFor(d.kind),
      depends_on: [],
      judgment: null,
    })
  }
  for (const n of input.redlines) {
    const label = where(n.room_id) + ' — redline note "' + short(n.text) + '"'
    if (!kindOk(n.kind, label)) continue
    if (!vocab.get(n.kind)!.executable) {
      push(context, codeOf(n.room_id), { text: n.note_type + ': ' + n.text, source: 'redline', evidence: n.source_ref })
      continue
    }
    const id = itemId('redline:' + n.id)
    if (seen.has(id)) errors.push(label + ': work item id ' + id + ' is used twice')
    seen.add(id)
    push(items, codeOf(n.room_id), {
      id,
      kind: n.kind,
      room: codeOf(n.room_id),
      summary: n.note_type + ': ' + n.text,
      params: { note_type: n.note_type },
      target: null,
      provenance: { decision_id: null, redline_id: n.id, source: 'redline', evidence: n.source_ref },
      acceptance: acceptanceFor(n.kind),
      depends_on: [],
      judgment: null,
    })
  }

  const opensOf = (pick: (o: V2OpenIn) => boolean): V2Open[] =>
    input.opens.filter(pick).map((o) => ({ question: o.question, default: o.default_if_unanswered, blocking: o.blocking, answer: o.answer }))

  // ---- rooms ----
  const rooms: V2Room[] = []
  for (const r of input.rooms) {
    if (isHouseSection(r.section_code)) continue
    const label = 'Room ' + r.section_code + ' ' + r.name
    const role = normaliseRole(r.role)
    if (!r.role) errors.push(label + ': no role chosen')
    else if (!role) errors.push(label + ': "' + r.role + '" is not in the list of room roles')
    if (r.needs_2d !== true && r.needs_2d !== false) errors.push(label + ': nobody has said whether it gets 2D drawings')
    const mine = items.get(r.section_code) || []
    const ms = (r.model_state || {}) as Record<string, unknown>
    if (ms.scanned_at == null) warnings.push(label + ': the model scan carries no scan time, so a stale scan cannot be detected')
    rooms.push({
      section_code: r.section_code,
      name: r.name,
      role: role || '',
      needs_2d: r.needs_2d === true,
      // marked by a person, or implied by a line that moves a wall, a stair or the structure in this room
      shell_changed: r.shell_changed === true || mine.some((w) => SHELL_KINDS.includes(w.kind)),
      model_state: { ...ms, scanned_at: ms.scanned_at ?? null, bridge_build: ms.bridge_build ?? null },
      work_items: mine,
      context: context.get(r.section_code) || [],
      opens: opensOf((o) => !!o.room_id && roomById.get(o.room_id)?.section_code === r.section_code),
      inspo: input.images
        .filter((i) => !!i.room_id && roomById.get(i.room_id)?.section_code === r.section_code)
        .map((i) => ({ storage_path: i.storage_path, notes: i.notes, tags: i.tags || [] })),
    })
  }
  const codes = rooms.map((r) => r.section_code)
  for (const c of new Set(codes.filter((c, i) => codes.indexOf(c) !== i))) errors.push('Room number ' + c + ' is on the board twice')

  // ---- house-level lines: site work goes to its own section ----
  const houseItems = items.get('HOUSE') || []
  if (!input.project.doc_title) warnings.push('The project has no Revit file title yet, so Blueprint cannot check it is in the right file from the contract alone.')
  if (errors.length) return { ok: false, errors, warnings }

  const contract: ContractV2 = {
    schema: V2_SCHEMA,
    project: { name: input.project.name, slug: slugOf(input.project.name), doc: input.project.doc_title || null, client: input.project.client },
    version: input.version,
    emitted_at: input.emittedAt,
    sha256_intent: '',
    vocabulary: { status: input.kinds.every((k) => k.status === 'locked') ? 'locked' : 'draft', kinds: vocab.size },
    rooms,
    house: {
      work_items: houseItems.filter((w) => !w.kind.startsWith('site.')),
      context: context.get('HOUSE') || [],
      opens: opensOf((o) => isHouse(o.room_id)),
      defaults_applied: input.defaultTopics.map((t) => 'default:' + t),
    },
    site: { work_items: houseItems.filter((w) => w.kind.startsWith('site.')) },
  }
  void houseRow
  contract.sha256_intent = contractSha(contract)
  const count = rooms.reduce((n, r) => n + r.work_items.length, 0) + houseItems.length
  return { ok: true, contract, warnings, work_items: count }
}

/** structural check of an emitted v2 contract against the vocabulary. [] = valid. */
export function validateContractV2(contract: unknown, kinds: { kind: string }[]): string[] {
  const out: string[] = []
  const c = contract as ContractV2
  if (!c || typeof c !== 'object') return ['not an object']
  if (c.schema !== V2_SCHEMA) out.push('schema is not ' + V2_SCHEMA)
  if (!c.project || !c.project.name || !c.project.slug) out.push('project.name and project.slug are required')
  if (typeof c.version !== 'number' || c.version < 1) out.push('version must be a number from 1')
  if (!c.emitted_at) out.push('emitted_at is required')
  if (!Array.isArray(c.rooms)) return [...out, 'rooms must be a list']
  if (!c.house || !Array.isArray(c.house.work_items) || !Array.isArray(c.house.defaults_applied)) out.push('house.work_items and house.defaults_applied are required')
  if (!c.site || !Array.isArray(c.site.work_items)) out.push('site.work_items is required')
  const known = new Set(kinds.map((k) => k.kind))
  const ids = new Set<string>()
  const checkItem = (w: WorkItem, whereAt: string) => {
    if (!w.id || !/^wi-[0-9a-f]{8}$/.test(w.id)) out.push(whereAt + ': bad work item id ' + w.id)
    if (ids.has(w.id)) out.push(whereAt + ': work item id ' + w.id + ' is used twice')
    ids.add(w.id)
    if (!known.has(w.kind)) out.push(whereAt + ' ' + w.id + ': unknown kind ' + w.kind)
    if (w.kind === CONTEXT_KIND) out.push(whereAt + ' ' + w.id + ': a context line is not a work item')
    if (!w.summary) out.push(whereAt + ' ' + w.id + ': no summary')
    if (!w.provenance || !w.provenance.source) out.push(whereAt + ' ' + w.id + ': no provenance')
    if (!Array.isArray(w.acceptance) || !Array.isArray(w.depends_on)) out.push(whereAt + ' ' + w.id + ': acceptance and depends_on must be lists')
    if (!w.params || typeof w.params !== 'object') out.push(whereAt + ' ' + w.id + ': params must be an object')
  }
  for (const r of c.rooms) {
    const at = 'room ' + r.section_code
    if (!normaliseRole(r.role)) out.push(at + ': role "' + r.role + '" is not in the list')
    if (typeof r.needs_2d !== 'boolean') out.push(at + ': needs_2d must be true or false')
    if (typeof r.shell_changed !== 'boolean') out.push(at + ': shell_changed must be true or false')
    if (!Array.isArray(r.work_items) || !Array.isArray(r.opens) || !Array.isArray(r.inspo)) {
      out.push(at + ': work_items, opens and inspo must be lists')
      continue
    }
    for (const w of r.work_items) {
      checkItem(w, at)
      if (w.room !== r.section_code) out.push(at + ' ' + w.id + ': room field says ' + w.room)
    }
  }
  for (const w of c.house?.work_items || []) checkItem(w, 'house')
  for (const w of c.site?.work_items || []) checkItem(w, 'site')
  if (c.sha256_intent !== contractSha(c)) out.push('sha256_intent does not match the contract')
  return out
}
