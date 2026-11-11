'use server'

import { createClient } from '@/lib/supabase/server'
import { approverNames, loadApprovers, LESSON_KINDS, type Approver } from '@/lib/lessons'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Lessons: anyone signed in can ADD (propose) one. Accepting, dismissing and retiring are for
// approvers only — checked here for a clear message, and enforced again by the database.

const PAGE = '/blueprint/lessons'
const back = (opts: { err?: string; anchor?: string } = {}) =>
  PAGE + (opts.err ? '?err=' + encodeURIComponent(opts.err) : '') + (opts.anchor ? '#' + opts.anchor : '')

function refresh() {
  revalidatePath(PAGE)
  revalidatePath('/blueprint')
  revalidatePath('/')
}

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const approvers: Approver[] = await loadApprovers(supabase)
  return { supabase, user, approvers, isApprover: approvers.some((a) => a.user_id === user.id) }
}

export async function proposeLesson(formData: FormData) {
  const { supabase, user } = await signedIn()
  const title = String(formData.get('title') || '').trim()
  const rule = String(formData.get('proposed_rule') || '').trim()
  const what = String(formData.get('what_happened') || '').trim()
  const kindRaw = String(formData.get('kind') || 'process')
  const kind = LESSON_KINDS.some((k) => k.key === kindRaw) ? kindRaw : 'process'
  if (!title || !rule) redirect(back({ err: 'A lesson needs a one-line title and the rule to follow. Nothing was added.' }))

  const { data, error } = await supabase
    .from('intent_lessons')
    .insert({
      status: 'proposed',
      kind,
      title,
      what_happened: what,
      proposed_rule: rule,
      source: 'person',
      proposed_by: user.email || 'someone',
    })
    .select('id')
    .single()
  if (error || !data) redirect(back({ err: 'The lesson could not be added' + (error ? ': ' + error.message : '.') }))
  refresh()
  redirect(back({ anchor: 'l-' + data.id }))
}

// one decision on one lesson; "from" is the status it must still be in
async function decide(
  formData: FormData,
  from: 'proposed' | 'accepted',
  build: (ctx: { now: string; note: string; email: string }) => Record<string, unknown> | string,
  verb: string,
) {
  const { supabase, user, approvers, isApprover } = await signedIn()
  const id = String(formData.get('lesson_id') || '')
  const note = String(formData.get('decision_note') || '').trim()
  if (!id) redirect(back())
  if (!isApprover) {
    redirect(back({ err: 'Only ' + approverNames(approvers) + ' can ' + verb + ' a lesson. Nothing was changed.', anchor: 'l-' + id }))
  }
  const { data: lesson } = await supabase.from('intent_lessons').select('id, status').eq('id', id).single()
  if (!lesson || lesson.status !== from) {
    redirect(back({ err: 'That lesson was already decided by someone else. Nothing was changed.', anchor: 'l-' + id }))
  }
  const now = new Date().toISOString()
  const fields = build({ now, note, email: user.email || '' })
  if (typeof fields === 'string') redirect(back({ err: fields, anchor: 'l-' + id }))

  const { data: changed, error } = await supabase
    .from('intent_lessons')
    .update({ ...fields, decided_by: user.id, decided_by_email: user.email || null, decided_at: now, decision_note: note || null })
    .eq('id', id)
    .eq('status', from)
    .select('id')
  refresh()
  if (error || !changed || changed.length === 0) {
    redirect(
      back({
        err: 'The decision was not saved' + (error ? ': ' + error.message : ' (the database refused it, or the lesson was decided a moment ago).'),
        anchor: 'l-' + id,
      }),
    )
  }
  redirect(back({ anchor: 'l-' + id }))
}

export async function acceptLesson(formData: FormData) {
  const rule = String(formData.get('accepted_rule') || '').trim()
  await decide(
    formData,
    'proposed',
    ({ now }) => (rule ? { status: 'accepted', accepted_rule: rule, accepted_at: now } : 'The rule wording was empty. Nothing was accepted.'),
    'accept',
  )
}

export async function dismissLesson(formData: FormData) {
  await decide(formData, 'proposed', ({ note }) => (note ? { status: 'dismissed' } : 'Say why it is dismissed, so Blueprint does not propose it again. Nothing was changed.'), 'dismiss')
}

export async function retireLesson(formData: FormData) {
  await decide(formData, 'accepted', ({ note }) => (note ? { status: 'retired' } : 'Say why it no longer applies. Nothing was changed.'), 'retire')
}
