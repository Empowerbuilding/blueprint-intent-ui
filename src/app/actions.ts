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
  await supabase.from('intent_rooms').update({ review_state: state }).eq('id', roomId)
  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
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
}

export async function setProjectStatus(projectId: string, status: string) {
  const supabase = await createClient()
  await supabase.from('intent_projects').update({ status }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}
