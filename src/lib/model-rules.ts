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
  created_at: string
  updated_at: string
}
export const MODEL_RULE_COLUMNS =
  'id, rule_key, description, status, kinds, params, checker, checker_status, source, version, proposed_by, decided_by_email, decided_at, decision_note, created_at, updated_at'

export const CHECKER_LABEL: Record<ModelRule['checker_status'], string> = {
  none: 'no checker written yet',
  script: 'checked by a one-project script',
  tool: 'checked by a tool',
  app: 'checked in this app',
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
