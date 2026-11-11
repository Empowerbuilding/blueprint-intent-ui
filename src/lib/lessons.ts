// LESSONS — what Blueprint has learned and should keep doing.
// Blueprint (or anyone signed in) proposes; only an approver (intent_approvers) accepts, dismisses
// or retires. Blueprint works from accepted lessons only. The database enforces the split too
// (supabase/migrations/20261111d_lessons.sql).

export type LessonStatus = 'proposed' | 'accepted' | 'dismissed' | 'retired'

export type Lesson = {
  id: string
  status: LessonStatus
  kind: string
  title: string
  what_happened: string
  proposed_rule: string
  accepted_rule: string | null
  project_id: string | null
  project_name: string | null
  source: string
  source_ref: string | null
  proposed_by: string
  decided_by_email: string | null
  decided_at: string | null
  accepted_at: string | null
  decision_note: string | null
  created_at: string
}

export type Approver = { user_id: string; email: string; name: string }

export const LESSON_COLUMNS =
  'id, status, kind, title, what_happened, proposed_rule, accepted_rule, project_id, project_name, source, source_ref, proposed_by, decided_by_email, decided_at, accepted_at, decision_note, created_at'

export const LESSON_KINDS: { key: string; label: string }[] = [
  { key: 'modeling', label: 'Modeling' },
  { key: 'construction_docs', label: 'Construction documents' },
  { key: 'components', label: 'Components' },
  { key: 'process', label: 'Process' },
  { key: 'app', label: 'This app' },
]
export const kindLabel = (k: string) => LESSON_KINDS.find((x) => x.key === k)?.label || k

/** "Mitch or Michael" */
export function approverNames(list: Approver[]): string {
  const names = list.map((a) => a.name).sort((a, b) => (a === 'Mitch' ? -1 : b === 'Mitch' ? 1 : a.localeCompare(b)))
  if (!names.length) return 'an approver'
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]
}

/** who decided, as a name when it is an approver */
export function whoLabel(email: string | null, approvers: Approver[]): string {
  if (!email) return 'someone'
  const a = approvers.find((x) => x.email.toLowerCase() === email.toLowerCase())
  return a ? a.name : email.split('@')[0]
}

export function proposerLabel(l: Pick<Lesson, 'proposed_by' | 'source'>, approvers: Approver[]): string {
  return l.source === 'blueprint' || l.proposed_by === 'blueprint' ? 'Blueprint' : whoLabel(l.proposed_by, approvers)
}

/** the wording Blueprint works from: as accepted, else as proposed */
export const lessonRule = (l: Pick<Lesson, 'accepted_rule' | 'proposed_rule'>) => l.accepted_rule || l.proposed_rule

// the two Supabase clients (user session, service role) have different generics; only .from() is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

export async function loadApprovers(client: AnyClient): Promise<Approver[]> {
  const { data } = await client.from('intent_approvers').select('user_id, email, name').order('name')
  return (data || []) as Approver[]
}

export async function loadLessons(client: AnyClient): Promise<Lesson[]> {
  const { data } = await client.from('intent_lessons').select(LESSON_COLUMNS).order('created_at', { ascending: false })
  return (data || []) as Lesson[]
}
