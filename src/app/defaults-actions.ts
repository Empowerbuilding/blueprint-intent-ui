'use server'

import { createClient } from '@/lib/supabase/server'
import { isScope } from '@/lib/defaults'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { notifyBlueprint } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Defaults are changed by an approver only (same people who accept lessons) — checked here for a
// clear message and enforced again by the database. Every change is written to
// intent_defaults_history with who and when, and Blueprint is told.

const PAGE = '/rulebook/defaults'
const back = (opts: { err?: string; saved?: string; anchor?: string; edit?: string } = {}) => {
  const q = [
    opts.err ? 'err=' + encodeURIComponent(opts.err) : '',
    opts.saved ? 'saved=' + encodeURIComponent(opts.saved) : '',
    opts.edit ? 'edit=' + encodeURIComponent(opts.edit) : '',
  ].filter(Boolean)
  return PAGE + (q.length ? '?' + q.join('&') : '') + (opts.anchor ? '#' + opts.anchor : '')
}

async function approver() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  if (!approvers.some((a) => a.user_id === user.id)) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can change a default. Nothing was changed.' }))
  }
  return { supabase, user }
}

type Change = {
  default_id: string
  topic: string
  action: 'added' | 'changed' | 'turned_off' | 'turned_on'
  old_value?: string | null
  new_value?: string | null
  old_scope?: string | null
  new_scope?: string | null
  note?: string | null
}

async function record(supabase: Awaited<ReturnType<typeof createClient>>, user: { id: string; email?: string | null }, c: Change) {
  await supabase.from('intent_defaults_history').insert({
    default_id: c.default_id,
    topic: c.topic,
    action: c.action,
    old_value: c.old_value ?? null,
    new_value: c.new_value ?? null,
    old_scope: c.old_scope ?? null,
    new_scope: c.new_scope ?? null,
    note: c.note || null,
    changed_by: user.id,
    changed_by_email: user.email || null,
  })
  const what =
    c.action === 'added'
      ? 'added: **' + c.topic + '** = ' + c.new_value + ' (' + c.new_scope + ')'
      : c.action === 'changed'
        ? 'changed: **' + c.topic + '** — was "' + c.old_value + '" (' + c.old_scope + '), now "' + c.new_value + '" (' + c.new_scope + ')'
        : c.action === 'turned_off'
          ? 'turned off: **' + c.topic + '** (was "' + c.old_value + '"). Nothing is built by default for it any more.'
          : 'turned back on: **' + c.topic + '** = ' + c.new_value
  await notifyBlueprint(
    '📋 **Default ' + what + '** By ' + (user.email || 'someone') + (c.note ? ' — "' + c.note + '"' : '') +
      '.\nThe list in the app is what gets built when nobody decides: python3 automation/defaults.py. This is a notice, not a go.',
  )
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
}

export async function addDefault(formData: FormData) {
  const { supabase, user } = await approver()
  const topic = String(formData.get('topic') || '').trim().replace(/\s+/g, ' ')
  const value = String(formData.get('value') || '').trim()
  const scope = String(formData.get('scope') || 'house')
  const note = String(formData.get('note') || '').trim()
  if (!topic || !value) redirect(back({ err: 'A default needs a topic and what gets built. Nothing was added.' }))
  if (topic.length > 60) redirect(back({ err: 'Keep the topic short (60 characters at most). Nothing was added.' }))
  if (!isScope(scope)) redirect(back({ err: 'Pick where the default applies. Nothing was added.' }))

  const { data: all } = await supabase.from('intent_defaults').select('id, topic, active, sort_order')
  const rows = (all || []) as { id: string; topic: string; active: boolean; sort_order: number }[]
  const twin = rows.find((r) => r.topic.toLowerCase() === topic.toLowerCase())
  if (twin) {
    redirect(
      back({
        err: 'There is already a default for "' + twin.topic + '"' + (twin.active ? '' : ' (turned off)') + '. Change that line instead. Nothing was added.',
        anchor: 'd-' + twin.id,
      }),
    )
  }
  const { data: row, error } = await supabase
    .from('intent_defaults')
    .insert({
      topic,
      value,
      scope,
      active: true,
      sort_order: rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) + 10,
      updated_by: user.id,
      updated_by_email: user.email || null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !row) redirect(back({ err: 'The default could not be added' + (error ? ': ' + error.message : '.') }))
  await record(supabase, user, { default_id: row.id, topic, action: 'added', new_value: value, new_scope: scope, note })
  redirect(back({ saved: topic, anchor: 'd-' + row.id }))
}

export async function saveDefault(formData: FormData) {
  const { supabase, user } = await approver()
  const id = String(formData.get('default_id') || '')
  const value = String(formData.get('value') || '').trim()
  const scope = String(formData.get('scope') || '')
  const note = String(formData.get('note') || '').trim()
  const { data: row } = await supabase.from('intent_defaults').select('id, topic, value, scope, active').eq('id', id).single()
  if (!row) redirect(back({ err: 'That default no longer exists. Nothing was changed.' }))
  if (!value) redirect(back({ err: 'What gets built was empty. Nothing was changed.', edit: id, anchor: 'd-' + id }))
  if (!isScope(scope)) redirect(back({ err: 'Pick where the default applies. Nothing was changed.', edit: id, anchor: 'd-' + id }))
  if (value === row.value && scope === row.scope) redirect(back({ err: 'Nothing was different, so nothing was changed.', anchor: 'd-' + id }))

  const { data: changed, error } = await supabase
    .from('intent_defaults')
    .update({ value, scope, updated_by: user.id, updated_by_email: user.email || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), edit: id, anchor: 'd-' + id }))
  }
  await record(supabase, user, {
    default_id: id,
    topic: row.topic,
    action: 'changed',
    old_value: row.value,
    new_value: value,
    old_scope: row.scope,
    new_scope: scope,
    note,
  })
  redirect(back({ saved: row.topic, anchor: 'd-' + id }))
}

export async function toggleDefault(formData: FormData) {
  const { supabase, user } = await approver()
  const id = String(formData.get('default_id') || '')
  const note = String(formData.get('note') || '').trim()
  const { data: row } = await supabase.from('intent_defaults').select('id, topic, value, scope, active').eq('id', id).single()
  if (!row) redirect(back({ err: 'That default no longer exists. Nothing was changed.' }))
  const { data: changed, error } = await supabase
    .from('intent_defaults')
    .update({ active: !row.active, updated_by: user.id, updated_by_email: user.email || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('active', row.active)
    .select('id')
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (the database refused it).'), anchor: 'd-' + id }))
  }
  await record(supabase, user, {
    default_id: id,
    topic: row.topic,
    action: row.active ? 'turned_off' : 'turned_on',
    old_value: row.value,
    new_value: row.value,
    old_scope: row.scope,
    new_scope: row.scope,
    note,
  })
  redirect(back({ saved: row.topic, anchor: row.active ? 'off' : 'd-' + id }))
}
