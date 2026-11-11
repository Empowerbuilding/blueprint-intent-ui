'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { buildAndEmit } from '@/lib/emit-core'

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

export async function emitContract(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const { data: { user } } = await supabase.auth.getUser()

  const result = await buildAndEmit(projectId, user?.id ?? null)

  if (!result.ok) {
    redirect(`/projects/${projectId}/emit?error=${encodeURIComponent(result.errors.join(' · '))}`)
  }

  revalidatePath(`/projects/${projectId}`)
  const v2 = result.v2.ok && result.v2.stored ? 'ok-' + result.v2.work_items : 'no-' + result.v2.errors.length
  redirect(`/projects/${projectId}/emit?emitted=${result.version}&handoff=${encodeURIComponent(result.handoff)}&v2=${v2}`)
}
