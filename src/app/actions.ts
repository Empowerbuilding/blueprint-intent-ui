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

export async function addDecision(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id') || '') || null
  const topic = String(formData.get('topic') || '').trim()
  const value = String(formData.get('value') || '').trim()
  const source = String(formData.get('source') || 'manual')
  const sourceRef = String(formData.get('source_ref') || '') || null
  const meetingDate = String(formData.get('meeting_date') || '') || null
  if (!topic || !value) return

  // supersede chain: any active decision on the same (room, topic) becomes superseded
  let q = supabase
    .from('intent_decisions')
    .select('id')
    .eq('project_id', projectId)
    .eq('topic', topic)
    .eq('status', 'active')
  q = roomId ? q.eq('room_id', roomId) : q.is('room_id', null)
  const { data: existing } = await q

  const { data: inserted } = await supabase
    .from('intent_decisions')
    .insert({ project_id: projectId, room_id: roomId, topic, value, source, source_ref: sourceRef, meeting_date: meetingDate })
    .select('id')
    .single()

  if (existing?.length && inserted) {
    await supabase
      .from('intent_decisions')
      .update({ status: 'superseded', superseded_by: inserted.id })
      .in('id', existing.map((d: { id: string }) => d.id))
  }

  if (roomId) revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
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
