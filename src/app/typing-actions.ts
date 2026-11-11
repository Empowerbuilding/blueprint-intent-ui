'use server'

import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/vocab'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// TYPING — the fields contract v2 is built from, set by a person:
//   a room's role, whether it gets 2D drawings, whether its walls / size change;
//   the kind of work a decision line or a redline note is.
// Typing a line is not a change of wording: the line stays the same line (nothing is crossed out).
// Nothing here guesses. The suggestions shown on the page are only preselected in the form.

const roomUrl = (projectId: string, roomId: string, opts: { err?: string; anchor?: string } = {}) =>
  '/projects/' + projectId + '/rooms/' + roomId + '?view=decide' + (opts.err ? '&err=' + encodeURIComponent(opts.err) : '') + (opts.anchor ? '#' + opts.anchor : '')

function revalidate(projectId: string, roomId: string) {
  revalidatePath('/projects/' + projectId + '/rooms/' + roomId)
  revalidatePath('/projects/' + projectId)
  revalidatePath('/projects/' + projectId + '/emit')
}

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

/** the kind exists and is in use. '' clears the kind. */
async function kindError(supabase: Awaited<ReturnType<typeof createClient>>, kind: string): Promise<string | null> {
  if (!kind) return null
  const { data } = await supabase.from('intent_kinds').select('kind, active').eq('kind', kind).maybeSingle()
  const row = data as { kind: string; active: boolean } | null
  if (!row || !row.active) return '"' + kind + '" is not in the list of kinds of work. Nothing was changed.'
  return null
}

export async function setRoomTyping(formData: FormData) {
  const { supabase, user } = await signedIn()
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  if (!projectId || !roomId) return
  const rawRole = String(formData.get('role') || '')
  const role = rawRole ? normaliseRole(rawRole) : null
  if (rawRole && !role) redirect(roomUrl(projectId, roomId, { err: '"' + rawRole + '" is not in the list of room roles. Nothing was changed.', anchor: 'typing' }))
  const n2d = String(formData.get('needs_2d') || '')
  const needs2d = n2d === 'yes' ? true : n2d === 'no' ? false : null
  const { data: changed, error } = await supabase
    .from('intent_rooms')
    .update({ role, needs_2d: needs2d, shell_changed: formData.get('shell_changed') === 'on', typed_by: user.email || user.id, typed_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('project_id', projectId)
    .select('id')
  revalidate(projectId, roomId)
  if (error || !changed || changed.length === 0) {
    redirect(roomUrl(projectId, roomId, { err: 'The room could not be saved' + (error ? ': ' + error.message : '.'), anchor: 'typing' }))
  }
  redirect(roomUrl(projectId, roomId, { anchor: 'typing' }))
}

function parseParams(raw: string): { ok: true; params: Record<string, unknown> } | { ok: false } {
  if (!raw.trim()) return { ok: true, params: {} }
  try {
    const v = JSON.parse(raw)
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ok: true, params: v }
  } catch {}
  return { ok: false }
}

export async function setDecisionKind(formData: FormData) {
  const { supabase, user } = await signedIn()
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  const decisionId = String(formData.get('decision_id') || '')
  const kind = String(formData.get('kind') || '')
  if (!projectId || !roomId || !decisionId) return
  const anchor = 'd-' + decisionId
  const bad = await kindError(supabase, kind)
  if (bad) redirect(roomUrl(projectId, roomId, { err: bad, anchor }))
  const parsed = parseParams(String(formData.get('params') || ''))
  if (!parsed.ok) redirect(roomUrl(projectId, roomId, { err: 'The numbers were not written as a list of name: value pairs. Nothing was changed.', anchor }))
  const { data: changed, error } = await supabase
    .from('intent_decisions')
    .update({ kind: kind || null, params: parsed.params, kind_set_by: user.email || user.id, kind_set_at: new Date().toISOString() })
    .eq('id', decisionId)
    .eq('project_id', projectId)
    .eq('room_id', roomId)
    .eq('status', 'active')
    .select('id')
  revalidate(projectId, roomId)
  if (error || !changed || changed.length === 0) {
    redirect(roomUrl(projectId, roomId, { err: 'That line was already changed or removed' + (error ? ' (' + error.message + ')' : '') + '. Nothing was changed.', anchor }))
  }
  redirect(roomUrl(projectId, roomId, { anchor }))
}

// every active line of ONE topic in ONE room that has no kind yet. Lines that already have a kind are left alone.
export async function setTopicKind(formData: FormData) {
  const { supabase, user } = await signedIn()
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  const topic = String(formData.get('topic') || '')
  const kind = String(formData.get('kind') || '')
  if (!projectId || !roomId || !topic) return
  if (!kind) redirect(roomUrl(projectId, roomId, { err: 'Pick the kind of work first. Nothing was changed.' }))
  const bad = await kindError(supabase, kind)
  if (bad) redirect(roomUrl(projectId, roomId, { err: bad }))
  const { error } = await supabase
    .from('intent_decisions')
    .update({ kind, kind_set_by: user.email || user.id, kind_set_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('room_id', roomId)
    .eq('topic', topic)
    .eq('status', 'active')
    .is('kind', null)
  revalidate(projectId, roomId)
  if (error) redirect(roomUrl(projectId, roomId, { err: 'The lines could not be saved: ' + error.message }))
  redirect(roomUrl(projectId, roomId, { anchor: 'decisions' }))
}

export async function setRedlineKind(formData: FormData) {
  const { supabase } = await signedIn()
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  const noteId = String(formData.get('note_id') || '')
  const kind = String(formData.get('kind') || '')
  if (!projectId || !roomId || !noteId) return
  const bad = await kindError(supabase, kind)
  if (bad) redirect(roomUrl(projectId, roomId, { err: bad, anchor: 'redlines' }))
  const { data: changed, error } = await supabase
    .from('intent_redline_notes')
    .update({ kind: kind || null })
    .eq('id', noteId)
    .eq('project_id', projectId)
    .eq('room_id', roomId)
    .select('id')
  revalidate(projectId, roomId)
  if (error || !changed || changed.length === 0) {
    redirect(roomUrl(projectId, roomId, { err: 'The note could not be saved' + (error ? ': ' + error.message : '.'), anchor: 'redlines' }))
  }
  redirect(roomUrl(projectId, roomId, { anchor: 'redlines' }))
}
