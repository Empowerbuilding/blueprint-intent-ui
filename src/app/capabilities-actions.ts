'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Gap log: anyone signed in can ADD a gap. Closing and reopening are for approvers only — checked
// here for a clear message and enforced again by the database.

const PAGE = '/blueprint/capabilities'
const back = (opts: { err?: string; anchor?: string } = {}) =>
  PAGE + (opts.err ? '?err=' + encodeURIComponent(opts.err) : '') + '#' + (opts.anchor || 'gaps')

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers = await loadApprovers(supabase)
  return { supabase, user, approvers, isApprover: approvers.some((a) => a.user_id === user.id) }
}

export async function addGap(formData: FormData) {
  const { supabase, user } = await signedIn()
  const title = String(formData.get('title') || '').trim()
  const detail = String(formData.get('detail') || '').trim()
  const workaround = String(formData.get('workaround') || '').trim()
  if (!title || !detail) redirect(back({ err: 'A gap needs a one-line title and what was needed. Nothing was added.' }))
  const { data, error } = await supabase
    .from('intent_gaps')
    .insert({ status: 'open', title, detail, workaround: workaround || null, proposed_by: user.email || 'someone' })
    .select('id')
    .single()
  if (error || !data) redirect(back({ err: 'The gap could not be added' + (error ? ': ' + error.message : '.') }))
  revalidatePath(PAGE)
  redirect(back({ anchor: 'g-' + data.id }))
}

async function setStatus(formData: FormData, to: 'open' | 'closed') {
  const { supabase, user, approvers, isApprover } = await signedIn()
  const id = String(formData.get('gap_id') || '')
  const note = String(formData.get('close_note') || '').trim()
  if (!id) redirect(back())
  if (!isApprover) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can ' + (to === 'closed' ? 'close' : 'reopen') + ' a gap. Nothing was changed.', anchor: 'g-' + id }))
  }
  if (to === 'closed' && !note) redirect(back({ err: 'Say how it was closed (fixed in which build, or why it no longer matters). Nothing was changed.', anchor: 'g-' + id }))
  const from = to === 'closed' ? 'open' : 'closed'
  const fields =
    to === 'closed'
      ? { status: 'closed', closed_by: user.id, closed_by_email: user.email || null, closed_at: new Date().toISOString(), close_note: note }
      : { status: 'open', closed_by: null, closed_by_email: null, closed_at: null, close_note: null }
  const { data: changed, error } = await supabase.from('intent_gaps').update(fields).eq('id', id).eq('status', from).select('id')
  revalidatePath(PAGE)
  if (error || !changed || changed.length === 0) {
    redirect(back({ err: 'The change was not saved' + (error ? ': ' + error.message : ' (already changed by someone else, or the database refused it).'), anchor: 'g-' + id }))
  }
  redirect(back({ anchor: 'g-' + id }))
}

export async function closeGap(formData: FormData) {
  await setStatus(formData, 'closed')
}
export async function reopenGap(formData: FormData) {
  await setStatus(formData, 'open')
}
