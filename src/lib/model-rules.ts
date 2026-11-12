// MODEL CHECKS — the registry of checks run on the built model (the "3D rule registry").
// Blueprint (or anyone signed in) proposes a check; only an approver (intent_approvers: Mitch and
// Michael) accepts or retires one. Only ACCEPTED checks are attached to work items in contract v2.
// The database enforces the split too (supabase/migrations/20261111g_pipeline_v2.sql).

export type ModelRuleStatus = 'proposed' | 'accepted' | 'retired'
export type ModelRule = {
  id: string
  rule_key: string
  description: string
  status: ModelRuleStatus
  kinds: string[] | null
  params: Record<string, unknown> | null
  checker: string | null
  checker_status: 'none' | 'script' | 'tool' | 'app'
  source: string | null
  version: number
  proposed_by: string
  decided_by_email: string | null
  decided_at: string | null
  decision_note: string | null
  /** what was last edited on the check outside a decision (a wording edit that keeps the acceptance). null = nothing */
  change_note: string | null
  /** who last changed a number on the check (params), and when. null = the starting value stands */
  params_by: string | null
  params_at: string | null
  created_at: string
  updated_at: string
}
export const MODEL_RULE_COLUMNS =
  'id, rule_key, description, status, kinds, params, checker, checker_status, source, version, proposed_by, decided_by_email, decided_at, decision_note, change_note, params_by, params_at, created_at, updated_at'

export const CHECKER_LABEL: Record<ModelRule['checker_status'], string> = {
  none: 'no checker written yet',
  script: 'checked by a one-project script',
  tool: 'checked by a tool',
  app: 'checked in this app',
}

// NUMBERS ON A CHECK. A check may carry numbers in params (tolerance_ft: 0.25). Those are what an approver can change on
// the page; the work-order compiler reads them from GET /api/model-rules. Flags (true / false) and text are not numbers.
// A number that is present with NO value (params.clear_depth_in: null) is waiting for one: the checker needs it, nothing
// written gives it, and only an approver types it (rule A83). value null = waiting. Until then the check cannot pass.
export type RuleNumber = { key: string; value: number | null; label: string; unit: string }
const NUMBER_UNITS: Record<string, string> = { ft: 'ft', in: 'in', sf: 'sq ft', deg: 'degrees', pct: '%' }
/** tolerance_ft -> { label: 'Tolerance', unit: 'ft' } */
export function numberLabel(key: string): { label: string; unit: string } {
  const parts = key.split('_').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  const unit = parts.length > 1 && NUMBER_UNITS[last] ? NUMBER_UNITS[last] : ''
  const words = (unit ? parts.slice(0, -1) : parts).join(' ')
  return { label: words.charAt(0).toUpperCase() + words.slice(1), unit }
}
export function ruleNumbers(params: Record<string, unknown> | null | undefined): RuleNumber[] {
  return Object.entries(params || {})
    .filter(([, v]) => v === null || (typeof v === 'number' && Number.isFinite(v)))
    .map(([key, v]) => ({ key, value: v as number | null, ...numberLabel(key) }))
    .sort((a, b) => a.key.localeCompare(b.key))
}
/** the numbers a check carries without a value: it cannot pass, and is not accepted, until an approver types them */
export function missingNumbers(params: Record<string, unknown> | null | undefined): RuleNumber[] {
  return ruleNumbers(params).filter((n) => n.value === null)
}

// A PALETTE ON A CHECK. room.palette_rgb carries the standard room colours in params.palette: one entry per Department,
// { "<Department>": [red, green, blue] }, whole numbers from 0 to 255. params.palette_source says, per Department, where its
// colour comes from (the graphic standard: document, section, date). The checker (automation/checks_rooms.py) reads
// params.palette from GET /api/model-rules and carries no colour of its own. An approver can change a row on the page; no
// row is added or removed there.
export type PaletteRow = { department: string; rgb: [number, number, number]; source: string | null }
export const PALETTE_ORIGIN = 'Source of the first value: '
const isChannel = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255
/** the palette rows of a check, by Department. null = the check carries no palette */
export function rulePalette(params: Record<string, unknown> | null | undefined): PaletteRow[] | null {
  const p = (params || {}).palette
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const src = (params || {}).palette_source
  const sources = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {}
  return Object.entries(p as Record<string, unknown>)
    .filter(([, c]) => Array.isArray(c) && c.length === 3 && c.every(isChannel))
    .map(([department, c]) => ({
      department,
      rgb: c as [number, number, number],
      source: typeof sources[department] === 'string' && (sources[department] as string).trim() ? (sources[department] as string) : null,
    }))
    .sort((a, b) => a.department.localeCompare(b.department))
}
/** "252" -> 252; anything that is not a whole number from 0 to 255 -> null */
export function colourChannel(raw: string): number | null {
  const t = raw.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return isChannel(n) ? n : null
}
/** the note a changed row carries: who changed it and from what, and still where its first value came from */
export function changedPaletteSource(prev: string | null, who: string, day: string, from: number[], to: number[]): string {
  const before = prev || 'no source was recorded'
  const origin = before.includes(PALETTE_ORIGIN) ? before.slice(before.indexOf(PALETTE_ORIGIN) + PALETTE_ORIGIN.length) : before
  return 'Changed on this page by ' + who + ' on ' + day + ', from ' + from.join('/') + ' to ' + to.join('/') + '. ' + PALETTE_ORIGIN + origin
}

// TEXTURE FOLDERS ON A CHECK. material.appearance_paths_resolve carries the shared library folders in params.texture_folders:
// a list of folder paths, exactly as the checker (automation/checks_materials.py) reads it from GET /api/model-rules; the
// checker carries no folder of its own. params.texture_folders_source says, per folder path, where it comes from (the
// document, the section and its date). An approver can change a folder, add one or remove one on the page; the last one
// cannot be removed, because a check with no folder cannot be run.
export type FolderRow = { folder: string; source: string | null }
/** the folder rows of a check, in the order the check lists them. null = the check carries no list of folders */
export function ruleFolders(params: Record<string, unknown> | null | undefined): FolderRow[] | null {
  const p = (params || {}).texture_folders
  if (!Array.isArray(p)) return null
  const src = (params || {}).texture_folders_source
  const sources = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {}
  return p
    .filter((f): f is string => typeof f === 'string' && !!f.trim())
    .map((folder) => ({ folder, source: typeof sources[folder] === 'string' && (sources[folder] as string).trim() ? (sources[folder] as string) : null }))
}
/** what a person typed -> a full Windows folder path (a drive letter or a network share), without a slash at the end; anything else -> null */
export function folderPath(raw: string): string | null {
  let t = raw.trim().replace(/\//g, '\\')
  const share = t.startsWith('\\\\')
  t = (share ? '\\\\' : '') + t.replace(/^\\+/, '').replace(/\\{2,}/g, '\\').replace(/\\+$/, '')
  if (t.length > 300) return null
  if (/[<>"|?*\u0000-\u001f]/.test(t)) return null
  if (share) return /^\\\\[^\\:]+\\[^\\:]+(\\[^\\:]+)*$/.test(t) ? t : null
  return /^[A-Za-z]:(\\[^\\:]+)+$/.test(t) ? t : null
}
/** two paths that name the same folder (Windows does not tell upper case from lower case) */
export function sameFolder(a: string, b: string): boolean {
  const n = (s: string) => (folderPath(s) || s.trim()).toLowerCase()
  return n(a) === n(b)
}
/** the note a changed folder carries: who changed it and from what, and still where its first value came from */
export function changedFolderSource(prev: string | null, who: string, day: string, from: string, to: string): string {
  const before = prev || 'no source was recorded'
  const origin = before.includes(PALETTE_ORIGIN) ? before.slice(before.indexOf(PALETTE_ORIGIN) + PALETTE_ORIGIN.length) : before
  return 'Changed on this page by ' + who + ' on ' + day + ', from ' + from + ' to ' + to + '. ' + PALETTE_ORIGIN + origin
}
/** the note a folder added on the page carries: no document named it, a person did */
export function addedFolderSource(who: string, day: string): string {
  return 'Added on this page by ' + who + ' on ' + day + '. No standard document names this folder: it is on the check on their word.'
}

// A LIST OF TEXTS ON A CHECK. A check may carry a list of short texts under a name this table knows (sheet.set_matches_stage:
// params.sheet_list, the sheet numbers a set of the draft stage is made of; sheet.tags_text_only: params.tag_families, the tag
// families that count as text only), exactly as the checker (automation/checks_sheets.py) reads it from GET /api/model-rules;
// the checker carries no entry of its own. params.<name>_source says, per entry, where it comes from. A note that starts
// with UNREVIEWED marks an entry that is Blueprint's reading of a standard and not its literal words; the marking is kept
// as for the roles below. An approver can change an entry, add one or remove one on the page; the last one cannot be
// removed, because a check with no entry cannot be run. The texture folders keep their own rules above (a full Windows path).
export type ListSpec = { title: string; one: string; save: string; add: string; placeholder: string; help: string; max: number }
export const CHECK_LISTS: Record<string, ListSpec> = {
  sheet_list: {
    title:
      'Sheet list: the sheet numbers a set of this draft stage is made of. A * at the end takes every number that starts the same way (A107.* takes A107.1 and A107.12). A ? at the end means the sheet may be missing. The check compares the model with this list.',
    one: 'sheet',
    save: 'Save sheet',
    add: 'Add sheet',
    placeholder: 'another sheet number, such as A108 or A108.*',
    help: 'A sheet entry is a sheet number, with * at the end for every number that starts the same way and ? at the end when the sheet may be missing: A100, A107.* or A100.3?, up to 40 characters.',
    max: 40,
  },
  tag_families: {
    title: 'Tag families: the door and window tag families that count as text only. The check compares the tags in the model with this list.',
    one: 'tag family',
    save: 'Save family',
    add: 'Add family',
    placeholder: 'another tag family, by its name in Revit',
    help: 'A tag family is its name as Revit shows it, 1 to 120 characters.',
    max: 120,
  },
}
export type ListRow = { value: string; source: string | null }
export type CheckList = { key: string; spec: ListSpec; rows: ListRow[] }
/** the lists of texts a check carries, each with its rows in the order the check lists them. [] = the check carries none */
export function ruleLists(params: Record<string, unknown> | null | undefined): CheckList[] {
  const p = params || {}
  const out: CheckList[] = []
  for (const key of Object.keys(CHECK_LISTS)) {
    const v = p[key]
    if (!Array.isArray(v)) continue
    const src = p[key + '_source']
    const sources = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {}
    out.push({
      key,
      spec: CHECK_LISTS[key],
      rows: v
        .filter((s): s is string => typeof s === 'string' && !!s.trim())
        .map((value) => ({ value, source: typeof sources[value] === 'string' && (sources[value] as string).trim() ? (sources[value] as string) : null })),
    })
  }
  return out
}
/** what a person typed -> one entry of that list, single spaces; anything the checker could not read -> null */
export function listEntry(list: string, raw: string): string | null {
  const spec = CHECK_LISTS[list]
  if (!spec || /[\u0000-\u001f]/.test(raw)) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t || t.length > spec.max) return null
  if (list === 'sheet_list') {
    // as the checker reads it: ? comes last, * before it, neither anywhere else, and a sheet number is left
    let stem = t.endsWith('?') ? t.slice(0, -1).trim() : t
    stem = stem.endsWith('*') ? stem.slice(0, -1).trim() : stem
    if (!stem || /[*?]/.test(stem)) return null
  }
  return t
}
/** two entries the checker reads as the same text (it does not tell upper case from lower case, or one space from two) */
export function sameEntry(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase()
  return n(a) === n(b)
}
/** the note an entry added on the page carries: no document named it, a person did */
export function addedEntrySource(who: string, day: string, one: string): string {
  return 'Added on this page by ' + who + ' on ' + day + '. No standard document names this ' + one + ': it is on the check on their word.'
}

// A TEXT ON A CHECK. A check may carry words in params under a name that ends in _text (site.conceptual_note_present:
// params.note_text, the words the checker looks for on the site sheet). params.<name>_source says where the words come from
// (the document, the section and its date). The checker reads the words from GET /api/model-rules and carries none of its
// own. An approver can change the words on the page; no text is added or removed there.
export type TextRow = { key: string; value: string; label: string; source: string | null }
export function ruleTexts(params: Record<string, unknown> | null | undefined): TextRow[] {
  const p = params || {}
  return Object.entries(p)
    .filter(([k, v]) => k.endsWith('_text') && typeof v === 'string' && !!v.trim())
    .map(([key, v]) => {
      const src = p[key + '_source']
      return { key, value: v as string, label: numberLabel(key).label, source: typeof src === 'string' && src.trim() ? src : null }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}
/** what a person typed -> the words, single spaces, 1 to 200 characters; anything else -> null */
export function checkText(raw: string): string | null {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  return t && t.length <= 200 ? t : null
}
/** the note changed words carry: who changed them and from what, and still where the first words came from */
export function changedTextSource(prev: string | null, who: string, day: string, from: string, to: string): string {
  const before = prev || 'no source was recorded'
  const origin = before.includes(PALETTE_ORIGIN) ? before.slice(before.indexOf(PALETTE_ORIGIN) + PALETTE_ORIGIN.length) : before
  return 'Changed on this page by ' + who + ' on ' + day + ', from "' + from + '" to "' + to + '". ' + PALETTE_ORIGIN + origin
}

// ROLES ON A CHECK. material.one_per_role carries the material roles in params.roles, exactly as the checker
// (automation/checks_materials.py) reads it from GET /api/model-rules:
//   { "<role>": { "parameters": ["<family parameter>", ...], "material": "<the one material>", "accents": ["<allowed accent>", ...] } }
// params.roles_source says, per role, which line of the standard it comes from and what in it is Blueprint's reading. A row
// that starts with UNREVIEWED holds values nobody has reviewed. The marking is never dropped: a row an approver changes says
// who changed it and from what and keeps its first source; a row accepted as shown says who adopted it and when (Tony,
// 2026-11-12 02:12Z). An approver can change a row on the page; no role is added or removed there.
export const UNREVIEWED = "Blueprint's reading, not reviewed"
export const ADOPTED = 'Accepted as shown by '
export type RoleRow = { role: string; parameters: string[]; material: string; accents: string[]; source: string | null }
const names = (x: unknown): string[] | null => (Array.isArray(x) && x.every((s) => typeof s === 'string' && !!s.trim()) ? (x as string[]).map((s) => s.trim()) : null)
/** the role rows of a check, by role. null = the check carries no roles. A role the checker could not read is left out. */
export function ruleRoles(params: Record<string, unknown> | null | undefined): RoleRow[] | null {
  const p = (params || {}).roles
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const src = (params || {}).roles_source
  const sources = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {}
  const rows: RoleRow[] = []
  for (const [role, d] of Object.entries(p as Record<string, unknown>)) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue
    const o = d as Record<string, unknown>
    const parameters = names(o.parameters)
    const accents = o.accents === undefined || o.accents === null ? [] : names(o.accents)
    if (!parameters || !parameters.length || !accents || typeof o.material !== 'string' || !o.material.trim()) continue
    rows.push({ role, parameters, material: o.material.trim(), accents, source: typeof sources[role] === 'string' && (sources[role] as string).trim() ? (sources[role] as string) : null })
  }
  return rows.sort((a, b) => a.role.localeCompare(b.role))
}
/** what a person typed -> one name (a material or a family parameter), single spaces, 1 to 120 characters, no comma; anything else -> null */
export function roleName(raw: string): string | null {
  if (/[\u0000-\u001f,]/.test(raw)) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  return t && t.length <= 120 ? t : null
}
/** "Cabinet Material, Door/Drawer Material" -> the names, in order, each once; a name that cannot be read -> null. Blank -> [] */
export function roleNames(raw: string): string[] | null {
  if (/[\u0000-\u001f]/.test(raw)) return null
  const out: string[] = []
  for (const part of raw.split(',')) {
    if (!part.trim()) continue
    const n = roleName(part)
    if (!n) return null
    if (!out.includes(n)) out.push(n)
  }
  return out
}
/** the note a changed role carries: who changed it and what, and still where its first values came from (with their marking) */
export function changedRoleSource(prev: string | null, who: string, day: string, changes: string[]): string {
  const before = prev || 'no source was recorded'
  const origin = before.includes(PALETTE_ORIGIN) ? before.slice(before.indexOf(PALETTE_ORIGIN) + PALETTE_ORIGIN.length) : before
  return 'Changed on this page by ' + who + ' on ' + day + ': ' + changes.join('; ') + '. ' + PALETTE_ORIGIN + origin
}
/** the note of a row nobody reviewed, once the check is accepted without a change to it: the marking stays, and says who adopted it */
export function adoptedRoleSource(prev: string, who: string, day: string): string {
  if (!prev.startsWith(UNREVIEWED) || prev.includes(ADOPTED)) return prev
  return prev.replace(/\s+$/, '') + ' ' + ADOPTED + who + ' on ' + day + ', without a change to this row.'
}
/** params after an acceptance: every role row still marked as not reviewed says who adopted it. null = nothing to write */
export function adoptRoles(params: Record<string, unknown> | null | undefined, who: string, day: string): Record<string, unknown> | null {
  const src = (params || {}).roles_source
  if (!params || !src || typeof src !== 'object' || Array.isArray(src)) return null
  let changed = false
  const next: Record<string, unknown> = {}
  for (const [role, note] of Object.entries(src as Record<string, unknown>)) {
    const after = typeof note === 'string' ? adoptedRoleSource(note, who, day) : note
    if (after !== note) changed = true
    next[role] = after
  }
  return changed ? { ...params, roles_source: next } : null
}
/** params after an acceptance, for every kind of note a check carries (the roles, a list of texts, the words): every row still
 *  marked as not reviewed says who adopted it as shown; the marking itself is never dropped. null = nothing to write */
export function adoptUnreviewed(params: Record<string, unknown> | null | undefined, who: string, day: string): Record<string, unknown> | null {
  if (!params) return null
  let changed = false
  const next: Record<string, unknown> = { ...params }
  for (const [key, src] of Object.entries(params)) {
    if (!key.endsWith('_source')) continue
    if (typeof src === 'string') {
      const after = adoptedRoleSource(src, who, day)
      if (after !== src) {
        next[key] = after
        changed = true
      }
    } else if (src && typeof src === 'object' && !Array.isArray(src)) {
      const rows: Record<string, unknown> = {}
      let any = false
      for (const [row, note] of Object.entries(src as Record<string, unknown>)) {
        const after = typeof note === 'string' ? adoptedRoleSource(note, who, day) : note
        if (after !== note) any = true
        rows[row] = after
      }
      if (any) {
        next[key] = rows
        changed = true
      }
    }
  }
  return changed ? next : null
}

// the two Supabase clients (user session, service role) have different generics; only .from() is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

/** every check, any status. null = the table could not be read */
export async function loadModelRules(client: AnyClient): Promise<ModelRule[] | null> {
  const { data, error } = await client.from('intent_model_rules').select(MODEL_RULE_COLUMNS).order('rule_key')
  if (error || !data) return null
  return data as ModelRule[]
}

export type KindOption = {
  kind: string
  family: string
  label: string
  description: string
  executable: boolean
  status: string // draft | locked. Locked = its commands are on the live bridge and their parameters were read from source. Not "proven".
  stage_scope: string | null
  active: boolean
  sort_order: number
  bridge_commands: string[] | null
  locked_build: string | null
  status_note: string | null
  /** how the kind is built: command = named bridge commands; recipe = direct Revit calls that ran on a real project; unmapped = neither */
  backing: 'command' | 'recipe' | 'unmapped' | null
  target_need: TargetNeed | null
  target_need_by: string | null
  target_need_at: string | null
  recipe: KindRecipe | null
}
/** what a kind must be pinned to before a build phase may write. The compiler reads this from /api/vocabulary. */
export const TARGET_NEEDS = ['element', 'location', 'any', 'none'] as const
export type TargetNeed = (typeof TARGET_NEEDS)[number]
export const TARGET_NEED_LABEL: Record<TargetNeed, string> = {
  element: 'an existing element in the model',
  location: 'a drawn position on the approved 2D',
  any: 'an existing element or a drawn position',
  none: 'nothing single (house-wide or room-wide work)',
}
export type KindRecipe = {
  summary: string
  calls: string[]
  receipts: { project: string; script: string; date: string; check: string }[]
  /** true = it ran and passed a build-phase check on a real project */
  proven: boolean
  proven_note: string | null
}
/** the kinds of work, in display order. null = the table could not be read */
export async function loadKinds(client: AnyClient): Promise<KindOption[] | null> {
  const { data, error } = await client
    .from('intent_kinds')
    .select('kind, family, label, description, executable, status, stage_scope, active, sort_order, bridge_commands, locked_build, status_note, backing, recipe, target_need, target_need_by, target_need_at')
    .order('sort_order')
  if (error || !data) return null
  return data as KindOption[]
}
