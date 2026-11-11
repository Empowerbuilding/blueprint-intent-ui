'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { notifyBlueprint } from '@/lib/notify'
import { TARGET_NEEDS, TARGET_NEED_LABEL } from '@/lib/model-rules'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Kinds of work: only an approver (Mitch or Michael) changes what a kind must be pinned to before it is built.
// Checked here for a clear message and enforced again by the database. Blueprint reads the value at every compile.

const PAGE = '/rulebook/kinds'
const back = (opts: { err?: string; saved?: string; anchor?: string } = {}) => {
  const q = [opts.err ? 'err=' + encodeURIComponent(opts.err) : '', opts.saved ? 'saved=' + encodeURIComponent(opts.saved) : ''].filter(Boolean)
  return PAGE + (q.length ? '?' + q.join('&') : '') + (opts.anchor ? '#' + opts.anchor : '')
}

export async function setKindTargetNeed(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a kind of work. Nothing was changed.' }))
  }
  const kind = String(formData.get('kind') || '')
  const need = String(formData.get('target_need') || '')
  if (!kind || !(TARGET_NEEDS as readonly string[]).includes(need)) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_kinds').select('kind, label, target_need').eq('kind', kind).maybeSingle()
  if (!row) redirect(back({ err: 'That kind of work no longer exists. Nothing was changed.' }))
  const anchor = 'k-' + kind
  if (row.target_need === need) redirect(back({ err: '"' + row.label + '" already says that. Nothing was changed.', anchor }))
  const { data: changed, error } = await supabase
    .from('intent_kinds')
    .update({ target_need: need, target_need_by: user.email || user.id, target_need_at: new Date().toISOString() })
    .eq('kind', kind)
    .select('kind')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), anchor }))
  }
  const label = TARGET_NEED_LABEL[need as keyof typeof TARGET_NEED_LABEL]
  await notifyBlueprint(
    '🧩 **Kind of work changed: `' + kind + '`** — before it is built it must now be pinned to: ' + label + ' (was: ' +
      (row.target_need ? TARGET_NEED_LABEL[row.target_need as keyof typeof TARGET_NEED_LABEL] || row.target_need : 'not set') + '). By ' + (user.email || 'someone') +
      '.\nA work order compiled before this is stale: GET /api/vocabulary, then --check. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  redirect(back({ saved: row.label + ': ' + label, anchor }))
}
