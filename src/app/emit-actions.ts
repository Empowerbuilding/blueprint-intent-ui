'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildAndEmit } from '@/lib/emit-core'
import { analyseStoredImage } from '@/lib/inspo-analyse-run'

export async function assignImage(imageId: string, roomId: string | null, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase
    .from('intent_inspo_images')
    .update({ room_id: roomId, parked: roomId === null ? true : false, assigned_by: user?.id ?? null, assigned_at: new Date().toISOString() })
    .eq('id', imageId)
  revalidatePath(`/projects/${projectId}/images`)
  revalidatePath(`/projects/${projectId}`)
}

export async function unassignImage(imageId: string, projectId: string) {
  const supabase = await createClient()
  await supabase.from('intent_inspo_images').update({ room_id: null, parked: false }).eq('id', imageId)
  revalidatePath(`/projects/${projectId}/images`)
}

export async function assignImageForm(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const imageId = String(formData.get('image_id'))
  const projectId = String(formData.get('project_id'))
  const sel = String(formData.get('room_id') || '')
  // '' = unassigned, 'PARK' = explicitly parked, otherwise a room uuid
  const roomId = sel === '' || sel === 'PARK' ? null : sel
  const parked = sel === 'PARK'
  await supabase
    .from('intent_inspo_images')
    .update({ room_id: roomId, parked, assigned_by: user?.id ?? null, assigned_at: new Date().toISOString() })
    .eq('id', imageId)
  revalidatePath(`/projects/${projectId}/images`)
  revalidatePath(`/projects/${projectId}`)
}

// "Read the picture again" on a room page: the vision analysis runs again and replaces the picture's layout details.
// Any signed-in person may press it; it changes nothing but the picture's own description, tags and details.
export async function analyseImageAgain(formData: FormData) {
  const supabase = await createClient()
  const imageId = String(formData.get('image_id') || '')
  const projectId = String(formData.get('project_id') || '')
  const roomId = String(formData.get('room_id') || '')
  const back = '/projects/' + projectId + '/rooms/' + roomId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !imageId) redirect(back + '?pic=failed#inspo')
  const r = await analyseStoredImage(supabase, imageId)
  revalidatePath(back)
  revalidatePath('/projects/' + projectId + '/images')
  redirect(back + (r.ok ? '?pic=read' : '?pic=failed') + '#inspo')
}

export async function emitContract(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const { data: { user } } = await supabase.auth.getUser()

  // "again" comes only from the second button of the page ("Emit the same contract again"), never from the main one
  const again = String(formData.get('again') || '') === '1'

  const result = await buildAndEmit(projectId, user?.id ?? null, { again })

  if (!result.ok) {
    redirect(`/projects/${projectId}/emit?error=${encodeURIComponent(result.errors.join(' · '))}`)
  }
  // nothing changed since the last emission: nothing was written and nobody was messaged (flag 52)
  if (!result.written) {
    redirect(`/projects/${projectId}/emit?same=${result.version}`)
  }

  revalidatePath(`/projects/${projectId}`)
  const v2 = result.v2.ok && result.v2.stored ? 'ok-' + result.v2.work_items : 'no-' + result.v2.errors.length
  redirect(`/projects/${projectId}/emit?emitted=${result.version}&handoff=${encodeURIComponent(result.handoff)}&v2=${v2}`)
}
