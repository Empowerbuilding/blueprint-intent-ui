'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { notifyBlueprint } from '@/lib/notify'
import { TARGET_NEEDS, TARGET_NEED_LABEL, numberLabel } from '@/lib/model-rules'
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

// A number on a kind of work (params: { flat_max_in: 2 }). Only an approver types or changes one, and only a number the
// kind already carries (present with a value, or present with null = waiting for its first value). Who and when are kept.
// Blueprint reads it at every compile; a work order compiled with the old number is stale.
export async function setKindNumber(formData: FormData) {
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
  const key = String(formData.get('param') || '')
  const raw = String(formData.get('value') || '').trim()
  if (!kind || !key) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_kinds').select('kind, label, params').eq('kind', kind).maybeSingle()
  if (!row) redirect(back({ err: 'That kind of work no longer exists. Nothing was changed.' }))
  const anchor = 'k-' + kind
  const params = (row.params || {}) as Record<string, unknown>
  const old = params[key]
  const first = old === null && key in params // carried without a value: this is its first one
  if (!first && (typeof old !== 'number' || !Number.isFinite(old))) {
    redirect(back({ err: '"' + row.label + '" carries no number called "' + key + '". Nothing was changed.', anchor }))
  }
  const value = Number(raw)
  if (raw === '' || !Number.isFinite(value) || value <= 0) redirect(back({ err: 'The number must be greater than zero. Nothing was changed.', anchor }))
  const { label, unit } = numberLabel(key)
  const show = (n: number) => String(n) + (unit ? ' ' + unit : '')
  if (value === old) redirect(back({ err: '"' + row.label + '" already says ' + show(value) + '. Nothing was changed.', anchor }))
  const { data: changed, error } = await supabase
    .from('intent_kinds')
    .update({ params: { ...params, [key]: value }, params_by: user.email || user.id, params_at: new Date().toISOString() })
    .eq('kind', kind)
    .select('kind')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The number was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    (first
      ? '🧩 **Kind of work, number set: `' + kind + '`** — ' + label.toLowerCase() + ' ' + show(value) + ', its first value. By ' + (user.email || 'someone') +
        '.\nUntil now the rule that needs it decided nothing.'
      : '🧩 **Kind of work, number changed: `' + kind + '`** — ' + label.toLowerCase() + ' ' + show(old as number) + ' → ' + show(value) + '. By ' + (user.email || 'someone') + '.') +
      '\nA work order compiled before this is stale: GET /api/vocabulary, then --check. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  redirect(back({ saved: row.label + ': ' + label.toLowerCase() + ' ' + show(value), anchor }))
}
