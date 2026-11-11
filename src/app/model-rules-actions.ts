'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { notifyBlueprint } from '@/lib/notify'
import { missingNumbers, numberLabel } from '@/lib/model-rules'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Model checks: anyone signed in can PROPOSE one; only an approver (Mitch or Michael) accepts,
// retires or brings one back. Checked here for a clear message and enforced again by the database.
// Only accepted checks are attached to work items in contract v2.

const PAGE = '/rulebook/model-checks'
const back = (opts: { err?: string; saved?: string; anchor?: string } = {}) => {
  const q = [opts.err ? 'err=' + encodeURIComponent(opts.err) : '', opts.saved ? 'saved=' + encodeURIComponent(opts.saved) : ''].filter(Boolean)
  return PAGE + (q.length ? '?' + q.join('&') : '') + (opts.anchor ? '#' + opts.anchor : '')
}

export async function proposeModelRule(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const ruleKey = String(formData.get('rule_key') || '').trim().toLowerCase()
  const description = String(formData.get('description') || '').trim()
  if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/.test(ruleKey)) {
    redirect(back({ err: 'The name looks like "casework.no_overlap": lower case, a dot between the group and the name. Nothing was added.', anchor: 'new' }))
  }
  if (!description) redirect(back({ err: 'Add the sentence that says what the check proves. Nothing was added.', anchor: 'new' }))
  const { data: twin } = await supabase.from('intent_model_rules').select('id, rule_key').eq('rule_key', ruleKey).maybeSingle()
  if (twin) redirect(back({ err: 'There is already a check called "' + ruleKey + '". Nothing was added.', anchor: 'r-' + ruleKey }))
  const { error } = await supabase
    .from('intent_model_rules')
    .insert({ rule_key: ruleKey, description, status: 'proposed', kinds: [], source: 'added in the app', proposed_by: user.email || user.id })
  if (error) redirect(back({ err: 'The check could not be added: ' + error.message, anchor: 'new' }))
  revalidatePath(PAGE)
  redirect(back({ saved: ruleKey + ' proposed', anchor: 'r-' + ruleKey }))
}

const NEXT: Record<string, { from: string[]; to: string; verb: string }> = {
  accept: { from: ['proposed'], to: 'accepted', verb: 'accepted' },
  retire: { from: ['accepted', 'proposed'], to: 'retired', verb: 'retired' },
  reopen: { from: ['retired'], to: 'proposed', verb: 'put back as proposed' },
}

export async function decideModelRule(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can accept or retire a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const step = NEXT[String(formData.get('decision') || '')]
  const note = String(formData.get('note') || '').trim()
  if (!id || !step) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (!step.from.includes(row.status)) redirect(back({ err: '"' + row.rule_key + '" is already ' + row.status + '. Nothing was changed.', anchor }))
  // a check that waits for a number is not accepted without it: the number is part of what is being accepted (rule A83)
  const waiting = step.to === 'accepted' ? missingNumbers(row.params as Record<string, unknown> | null) : []
  if (waiting.length) {
    redirect(
      back({
        err:
          '"' + row.rule_key + '" has no ' + waiting.map((n) => n.label.toLowerCase()).join(' and no ') +
          ' yet. Type the number and save it, then accept the check. Nothing was changed.',
        anchor,
      }),
    )
  }
  const now = new Date().toISOString()
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ status: step.to, version: (row.version || 1) + 1, decided_by: user.id, decided_by_email: user.email || null, decided_at: now, decision_note: note || null, updated_at: now })
    .eq('id', id)
    .eq('status', row.status)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    '🧪 **Model check ' + step.verb + ': `' + row.rule_key + '`** — ' + row.description + ' By ' + (user.email || 'someone') + (note ? ' — "' + note + '"' : '') +
      '.\nAccepted checks are attached to work items at the next Lock & Emit: GET /api/model-rules. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ' ' + step.verb, anchor }))
}

// A number on a check (params: tolerance_ft and the like). Only an approver changes it, on a check that is proposed or
// accepted; an accepted check stays accepted. The version goes up, so a work order compiled with the old number is stale.
// No number is ever added here: only one the check already carries can be changed, or given its first value when the
// check carries it without one (null: a number the checker needs and nothing written gives, rule A83).
export async function setModelRuleNumber(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a number on a check. Nothing was changed.' }))
  }
  const id = String(formData.get('rule_id') || '')
  const key = String(formData.get('param') || '')
  const raw = String(formData.get('value') || '').trim()
  if (!id || !key) redirect(back({ err: 'Nothing was changed.' }))
  const { data: row } = await supabase.from('intent_model_rules').select('id, rule_key, description, status, version, params').eq('id', id).single()
  if (!row) redirect(back({ err: 'That check no longer exists. Nothing was changed.' }))
  const anchor = 'r-' + row.rule_key
  if (row.status === 'retired') redirect(back({ err: '"' + row.rule_key + '" is retired. Put it back as proposed first. Nothing was changed.', anchor }))
  const params = (row.params || {}) as Record<string, unknown>
  const old = params[key]
  const first = old === null && key in params // carried without a value: this is its first one
  if (!first && (typeof old !== 'number' || !Number.isFinite(old))) {
    redirect(back({ err: '"' + row.rule_key + '" carries no number called "' + key + '". Nothing was changed.', anchor }))
  }
  const value = Number(raw)
  if (raw === '' || !Number.isFinite(value) || value <= 0) redirect(back({ err: 'The number must be greater than zero. Nothing was changed.', anchor }))
  const { label, unit } = numberLabel(key)
  const show = (n: number) => String(n) + (unit ? ' ' + unit : '')
  if (value === old) redirect(back({ err: '"' + row.rule_key + '" already says ' + show(value) + '. Nothing was changed.', anchor }))
  const next: Record<string, unknown> = { ...params, [key]: value }
  if ('initial' in next) next.initial = false // it is no longer the starting value
  const now = new Date().toISOString()
  const { data: changed, error } = await supabase
    .from('intent_model_rules')
    .update({ params: next, version: (row.version || 1) + 1, params_by: user.email || user.id, params_at: now, updated_at: now })
    .eq('id', id)
    .eq('version', row.version)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The number was not saved' + (error ? ': ' + error.message : ' (the check changed in the meantime, or the database refused it).'), anchor }))
  }
  await notifyBlueprint(
    first
      ? '🧪 **Model check number set: \`' + row.rule_key + '\`** — ' + label.toLowerCase() + ' ' + show(value) + ', its first value (the check is ' + row.status + '). By ' +
          (user.email || 'someone') + '.\nThe check had no value for it and could not pass: GET /api/model-rules. This is a notice, not a go.'
      : '🧪 **Model check number changed: \`' + row.rule_key + '\`** — ' + label.toLowerCase() + ' ' + show(old as number) + ' → ' + show(value) + ' (the check is ' + row.status + '). By ' +
          (user.email || 'someone') + '.\nA work order compiled with the old number is stale: GET /api/model-rules, then --check. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  redirect(back({ saved: row.rule_key + ': ' + label.toLowerCase() + ' ' + show(value), anchor }))
}
