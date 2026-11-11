'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
  })
  if (error) {
    console.error('signIn failed:', error.status, error.code, error.message)
    redirect('/login?error=1')
  }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const name = String(formData.get('name') || '').trim()
  if (!name) return
  const { data, error } = await supabase
    .from('intent_projects')
    .insert({ name, client: String(formData.get('client') || '') || null, created_by: user?.id ?? null })
    .select('id')
    .single()
  if (error || !data) return
  revalidatePath('/')
  revalidatePath('/projects')
  redirect(`/projects/${data.id}`)
}

// Standard room set from the BRIEF format (B1–B16 + house-level)
const STANDARD_ROOMS: [string, string][] = [
  ['B1', 'Entry / Foyer / Front Porch'],
  ['B2', 'Great Room / Living'],
  ['B3', 'Kitchen'],
  ['B4', 'Butler Pantry / Dining'],
  ['B5', 'Master Suite'],
  ['B6', 'Master Bath / Closet'],
  ['B7', 'Office (4th Bedroom)'],
  ['B8', 'Safe Room'],
  ['B9', 'Bed 2'],
  ['B10', 'Bed 3'],
  ['B11', 'J&J Bath'],
  ['B12', 'Half Bath'],
  ['B13', 'Mud / Laundry'],
  ['B14', 'Gym'],
  ['B15', 'Garage'],
  ['B16', 'ADU'],
  ['B17', 'Outdoor Living / Patio'],
  ['B18', 'Site / Exterior'],
  ['HOUSE', 'House-Level (global)'],
]

export async function createStandardRooms(projectId: string) {
  const supabase = await createClient()
  const rows = STANDARD_ROOMS.map(([code, name], i) => ({
    project_id: projectId,
    section_code: code,
    name,
    sort_order: i,
  }))
  await supabase.from('intent_rooms').upsert(rows, { onConflict: 'project_id,section_code' })
  revalidatePath(`/projects/${projectId}`)
}

export async function setReviewState(roomId: string, projectId: string, state: 'unreviewed' | 'defaults_accepted' | 'confirmed') {
  const supabase = await createClient()
  // A 2D-approved room is never downgraded by this control — that would discard
  // the approval silently. Reopening is its own explicit action (reopenRoom).
  const { data: room } = await supabase.from('intent_rooms').select('review_state').eq('id', roomId).single()
  if (!room) return
  if (room.review_state === '2d_approved') {
    redirect(`/projects/${projectId}/rooms/${roomId}?err2d=${encodeURIComponent('This room is 2D approved. Use "Reopen room" to change it — that discards the 2D approval.')}`)
  }
  await supabase.from('intent_rooms').update({ review_state: state }).eq('id', roomId)
  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

// Explicitly give up a room's 2D approval (back to confirmed) so it can be changed.
export async function reopenRoom(roomId: string, projectId: string) {
  const supabase = await createClient()
  await supabase
    .from('intent_rooms')
    .update({ review_state: 'confirmed' })
    .eq('id', roomId)
    .eq('review_state', '2d_approved')
  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

// ---- decisions ----
// A topic can hold many active lines (a board push adds one per transcript line), so every
// change is addressed to ONE line by id:
//   addDecision      adds a line. It never replaces anything.
//   replaceDecision  replaces one line; the old one stays on record, crossed out under its replacement.
//   removeDecision   takes one line out of the build; it stays listed, crossed out, and can be put back.
//   restoreDecision  puts a removed line back.
// "Removed" is status 'superseded' with no superseded_by. status_changed_at records a hand
// removal / put-back so a locked contract shows as out of date (see lib/overview.ts).

function decideUrl(projectId: string, roomId: string, opts: { err?: string; anchor?: string } = {}) {
  return (
    `/projects/${projectId}/rooms/${roomId}?view=decide` +
    (opts.err ? '&err=' + encodeURIComponent(opts.err) : '') +
    (opts.anchor ? '#' + opts.anchor : '')
  )
}

function revalidateDecisions(projectId: string, roomId: string | null) {
  if (roomId) revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

type DecisionLine = { id: string; project_id: string; room_id: string | null; topic: string; status: string; superseded_by: string | null }

// the line a form points at — only if it really belongs to that project and room
async function findLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
): Promise<{ projectId: string; roomId: string; line: DecisionLine | null }> {
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  const decisionId = String(formData.get('decision_id') || '')
  if (!projectId || !roomId || !decisionId) return { projectId, roomId, line: null }
  const { data } = await supabase
    .from('intent_decisions')
    .select('id, project_id, room_id, topic, status, superseded_by')
    .eq('id', decisionId)
    .single()
  const line = data as DecisionLine | null
  return { projectId, roomId, line: line && line.project_id === projectId && line.room_id === roomId ? line : null }
}

export async function addDecision(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id') || '') || null
  const topic = String(formData.get('topic') || '').trim()
  const value = String(formData.get('value') || '').trim()
  const source = String(formData.get('source') || 'manual')
  const sourceRef = String(formData.get('source_ref') || '') || null
  const meetingDate = String(formData.get('meeting_date') || '') || null
  if (!topic || !value) return

  await supabase
    .from('intent_decisions')
    .insert({ project_id: projectId, room_id: roomId, topic, value, source, source_ref: sourceRef, meeting_date: meetingDate })

  revalidateDecisions(projectId, roomId)
}

export async function replaceDecision(formData: FormData) {
  const supabase = await createClient()
  const { projectId, roomId, line } = await findLine(supabase, formData)
  if (!projectId || !roomId) return
  const value = String(formData.get('value') || '').trim()
  const source = String(formData.get('source') || 'manual')
  const sourceRef = String(formData.get('source_ref') || '') || null
  const meetingDate = String(formData.get('meeting_date') || '') || null
  if (!line || line.status !== 'active') {
    redirect(decideUrl(projectId, roomId, { err: 'That line was already changed or removed. Nothing was changed.' }))
  }
  if (!value) {
    redirect(decideUrl(projectId, roomId, { err: 'The new wording was empty. Nothing was changed.', anchor: 'd-' + line.id }))
  }

  const { data: inserted, error } = await supabase
    .from('intent_decisions')
    .insert({ project_id: projectId, room_id: roomId, topic: line.topic, value, source, source_ref: sourceRef, meeting_date: meetingDate })
    .select('id')
    .single()
  if (error || !inserted) {
    redirect(decideUrl(projectId, roomId, { err: 'The change could not be saved' + (error ? ': ' + error.message : '.'), anchor: 'd-' + line.id }))
  }

  // only this line, and only if it is still active
  const { error: updateError } = await supabase
    .from('intent_decisions')
    .update({ status: 'superseded', superseded_by: inserted.id })
    .eq('id', line.id)
    .eq('status', 'active')
  revalidateDecisions(projectId, roomId)
  if (updateError) {
    redirect(
      decideUrl(projectId, roomId, {
        err: 'The new line was added, but the old one could not be crossed out (' + updateError.message + '). Remove the old line by hand.',
        anchor: 'd-' + line.id,
      }),
    )
  }
  redirect(decideUrl(projectId, roomId, { anchor: 'd-' + inserted.id }))
}

export async function removeDecision(formData: FormData) {
  const supabase = await createClient()
  const { projectId, roomId, line } = await findLine(supabase, formData)
  if (!projectId || !roomId) return
  if (!line || line.status !== 'active') {
    redirect(decideUrl(projectId, roomId, { err: 'That line was already changed or removed. Nothing was changed.' }))
  }
  const { error } = await supabase
    .from('intent_decisions')
    .update({ status: 'superseded', superseded_by: null, status_changed_at: new Date().toISOString() })
    .eq('id', line.id)
    .eq('status', 'active')
  revalidateDecisions(projectId, roomId)
  if (error) redirect(decideUrl(projectId, roomId, { err: 'The line could not be removed: ' + error.message, anchor: 'd-' + line.id }))
  redirect(decideUrl(projectId, roomId, { anchor: 'd-' + line.id }))
}

export async function restoreDecision(formData: FormData) {
  const supabase = await createClient()
  const { projectId, roomId, line } = await findLine(supabase, formData)
  if (!projectId || !roomId) return
  // only a line that was removed outright; one that was replaced has a newer wording in its place
  if (!line || line.status !== 'superseded' || line.superseded_by) {
    redirect(decideUrl(projectId, roomId, { err: 'That line cannot be put back: it is already active, or it was replaced by a newer line.' }))
  }
  const { error } = await supabase
    .from('intent_decisions')
    .update({ status: 'active', status_changed_at: new Date().toISOString() })
    .eq('id', line.id)
    .eq('status', 'superseded')
  revalidateDecisions(projectId, roomId)
  if (error) redirect(decideUrl(projectId, roomId, { err: 'The line could not be put back: ' + error.message, anchor: 'd-' + line.id }))
  redirect(decideUrl(projectId, roomId, { anchor: 'd-' + line.id }))
}

export async function addOpenQuestion(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id') || '') || null
  const question = String(formData.get('question') || '').trim()
  if (!question) return
  await supabase.from('intent_open_questions').insert({
    project_id: projectId,
    room_id: roomId,
    question,
    default_if_unanswered: String(formData.get('default_if_unanswered') || '') || null,
    blocking: formData.get('blocking') === 'on',
  })
  if (roomId) revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

export async function resolveOpen(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id') || '') || null
  const id = String(formData.get('id'))
  const answer = String(formData.get('answer') || '').trim()
  if (!answer) return
  await supabase
    .from('intent_open_questions')
    .update({ answer, answered_by: user?.id ?? null })
    .eq('id', id)
  if (roomId) revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

export async function addRedlineNote(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id') || '') || null
  const text = String(formData.get('text') || '').trim()
  const noteType = String(formData.get('note_type') || 'note')
  if (!text) return
  await supabase.from('intent_redline_notes').insert({
    project_id: projectId,
    room_id: roomId,
    note_type: noteType,
    text,
    source_ref: String(formData.get('source_ref') || '') || null,
  })
  if (roomId) revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

// The stage shown in the UI is derived from the data (src/lib/progress.ts). The
// only statuses a person sets are the two the app cannot see for itself: the
// Revit build has started, and it has finished.
export async function setProjectStatus(projectId: string, status: string) {
  if (status !== 'building' && status !== 'done') return
  const supabase = await createClient()
  await supabase.from('intent_projects').update({ status }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/')
}

// Delete a project and everything under it. Guarded by a typed project name.
//
// Order: (1) try the project row alone — if the database cascades, that is one
// atomic statement. (2) If a foreign key blocks it, remove the children first,
// then the project. (3) Only after the rows are gone, remove the stored image
// files; anything left behind is reported, never hidden.
export async function deleteProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const projectId = String(formData.get('project_id') || '')
  const typed = String(formData.get('confirm_name') || '').trim()
  const { data: project } = await supabase.from('intent_projects').select('id, name').eq('id', projectId).single()
  if (!project) redirect('/projects')

  const fail: (message: string) => never = (message) =>
    redirect(`/projects/${projectId}?delete_error=${encodeURIComponent(message)}#delete`)

  if (typed !== project.name) fail('The name you typed does not match the project name. Nothing was deleted.')

  // collect stored files before the rows that point at them disappear
  const [{ data: imageRows }, { data: outlineRows }] = await Promise.all([
    supabase.from('intent_inspo_images').select('storage_path').eq('project_id', projectId),
    supabase.from('intent_outlines').select('storage_path').eq('project_id', projectId),
  ])
  const paths = (rows: { storage_path: string | null }[] | null) =>
    [...new Set((rows || []).map((r) => r.storage_path).filter((p): p is string => !!p))]
  const inspoPaths = paths(imageRows)
  const outlinePaths = paths(outlineRows)

  let { error: projectError, count } = await supabase
    .from('intent_projects')
    .delete({ count: 'exact' })
    .eq('id', projectId)

  // anything other than a foreign-key block (23503) is a real failure: stop with nothing deleted
  if (projectError && projectError.code !== '23503') {
    fail(`The project could not be deleted: ${projectError.message}. Nothing was deleted.`)
  }

  if (projectError) {
    // blocked by a child table without cascade — remove children explicitly, child-first
    const children = [
      'intent_outlines',
      'intent_emissions',
      'intent_inspo_images',
      'intent_redline_notes',
      'intent_open_questions',
      'intent_decisions',
      'intent_rooms',
    ]
    for (const table of children) {
      const { error } = await supabase.from(table).delete().eq('project_id', projectId)
      if (error) {
        fail(
          `Delete stopped at ${table}: ${error.message}. Tables before it in the list were already emptied for this project; the project itself still exists.`
        )
      }
    }
    const second = await supabase.from('intent_projects').delete({ count: 'exact' }).eq('id', projectId)
    projectError = second.error
    count = second.count
    if (projectError) {
      fail(`The project's contents were removed but the project row could not be: ${projectError.message}`)
    }
  }
  if (!count) fail('The database did not remove the project (no permission to delete). Nothing was deleted.')

  // stored files — best effort, reported
  let filesLeft = 0
  const removeFiles = async (bucket: string, list: string[]) => {
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100)
      const { data, error } = await supabase.storage.from(bucket).remove(chunk)
      filesLeft += error ? chunk.length : chunk.length - (data?.length || 0)
    }
  }
  await removeFiles('intent-inspo', inspoPaths)
  await removeFiles('intent-outlines', outlinePaths)

  revalidatePath('/')
  revalidatePath('/projects')
  redirect(
    `/projects?deleted=${encodeURIComponent(project.name)}` + (filesLeft ? `&files_left=${filesLeft}` : '')
  )
}
