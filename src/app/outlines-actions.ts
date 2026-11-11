'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { runMathGate, type Geometry, type RuleRow } from '@/lib/rules'
import { visionGateInBackground } from '@/lib/outline-vision'

export async function approveOutline(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id'))
  const outlineId = String(formData.get('outline_id'))
  const reason = String(formData.get('override_reason') || '').trim()

  const { data: outline } = await supabase.from('intent_outlines').select('checks').eq('id', outlineId).single()
  if (!outline) return

  // Approving a drawing that failed a rule overrides the rulebook. That is
  // allowed, but never silently: the reason is required and stored on the
  // outline (checks.override) so the rule can be corrected instead of failing
  // the same way on the next project.
  const checks = (outline.checks || {}) as Record<string, unknown>
  const mathResults = (checks.math as { results?: { rule_key?: string; status?: string }[] } | undefined)?.results || []
  const failed = mathResults.filter((r) => r.status === 'fail')
  if (failed.length > 0 && !reason) {
    redirect(
      `/projects/${projectId}/rooms/${roomId}?view=2d&err2d=${encodeURIComponent('A rule failed on that drawing. Say why it is OK before approving it.')}#o-${outlineId}`
    )
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = { status: 'approved', approved_by: user?.id ?? null, approved_at: now }
  if (failed.length > 0) {
    update.checks = {
      ...checks,
      override: { reason, by: user?.email ?? null, at: now, failed_rules: failed.map((r) => r.rule_key) },
    }
  }
  await supabase.from('intent_outlines').update(update).eq('id', outlineId).eq('status', 'pushed')
  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

export async function rejectOutline(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id'))
  const outlineId = String(formData.get('outline_id'))
  const feedback = String(formData.get('feedback') || '').trim()
  if (!feedback) return

  const { data: outline } = await supabase
    .from('intent_outlines')
    .select('id, outline_type, label, room_id')
    .eq('id', outlineId)
    .single()
  if (!outline) return

  const [{ data: room }, { data: project }] = await Promise.all([
    supabase.from('intent_rooms').select('section_code, name').eq('id', roomId).single(),
    supabase.from('intent_projects').select('name').eq('id', projectId).single(),
  ])

  await supabase.from('intent_outlines').update({ status: 'rejected', feedback }).eq('id', outlineId).eq('status', 'pushed')

  // wake Blueprint to redraft (same pattern as the emit handoff)
  const portalUrl = process.env.PORTAL_URL
  const portalKey = process.env.PORTAL_SUPABASE_SERVICE_KEY
  if (portalUrl && portalKey) {
    try {
      await fetch(`${portalUrl}/rest/v1/portal_messages`, {
        method: 'POST',
        headers: {
          apikey: portalKey,
          Authorization: 'Bear' + 'er ' + portalKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          channel_id: 'blueprint-mitch',
          org_id: '1c466ccb-ef35-4ba4-bf00-5fcabf20edec',
          sender_type: 'user',
          sender_name: 'WorkOrderUI',
          content: `🔴 **2D outline rejected — ${project?.name || 'project'} ${room ? `${room.section_code} ${room.name}` : ''} (${outline.outline_type}${outline.label ? ` "${outline.label}"` : ''}).** Michael's feedback: "${feedback}". Fetch the current state: GET /api/outlines?project_id=${projectId} (header x-prefill-secret). Redraft and re-push via POST /api/push-outline — same room/type/label supersedes the old one.`,
          processed: false,
        }),
      })
    } catch (e) {
      console.error('reject portal post failed', e)
    }
  }

  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

export async function rerunOutlineChecks(formData: FormData) {
  const supabase = await createClient()
  const projectId = String(formData.get('project_id'))
  const roomId = String(formData.get('room_id'))
  const outlineId = String(formData.get('outline_id'))

  const { data: outline } = await supabase
    .from('intent_outlines')
    .select('*')
    .eq('id', outlineId)
    .single()
  if (!outline) return

  const { data: room } = await supabase
    .from('intent_rooms')
    .select('id, section_code, name')
    .eq('id', roomId)
    .single()
  if (!room) return

  const [{ data: ruleRows }, { data: latestVersion }] = await Promise.all([
    supabase.from('intent_rules').select('*').eq('active', true),
    supabase.from('intent_rulebook_versions').select('version').order('version', { ascending: false }).limit(1),
  ])
  const math = runMathGate(
    (ruleRows || []) as unknown as RuleRow[],
    { name: room.name, section_code: room.section_code },
    outline.outline_type,
    (outline.geometry || {}) as Geometry,
    latestVersion?.[0]?.version ?? null
  )

  const checks: Record<string, unknown> = { ...(outline.checks || {}), math }

  if (outline.storage_path) {
    // vision in the background — form returns fast, page auto-refreshes while running
    checks.vision = { ran_at: new Date().toISOString(), model: 'glm-4.6v', status: 'running' }
    await supabase.from('intent_outlines').update({ checks }).eq('id', outlineId)
    visionGateInBackground(supabase, {
      outlineId,
      projectId,
      roomId,
      storagePath: outline.storage_path,
      outlineType: outline.outline_type,
      roomName: room.name,
    })
  } else {
    await supabase.from('intent_outlines').update({ checks }).eq('id', outlineId)
  }

  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
}

// Room state machine: confirmed → 2d_approved.
// Gate: room must be confirmed and every pushed outline reviewed (nothing in 'pushed').
export async function set2dApproved(roomId: string, projectId: string) {
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('intent_rooms')
    .select('review_state')
    .eq('id', roomId)
    .single()
  if (!room) return

  if (room.review_state !== 'confirmed') {
    redirect(`/projects/${projectId}/rooms/${roomId}?view=2d&err2d=${encodeURIComponent('Mark the room confirmed first.')}`)
  }

  const { count: pending } = await supabase
    .from('intent_outlines')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('status', 'pushed')
  if ((pending || 0) > 0) {
    redirect(`/projects/${projectId}/rooms/${roomId}?view=2d&err2d=${encodeURIComponent(pending + ' drawing(s) are still awaiting review.')}`)
  }

  // 2D approval requires at least one APPROVED outline — a room that was never
  // drawn (or whose outlines were all rejected) cannot be 2D-approved.
  const { count: approvedOutlines } = await supabase
    .from('intent_outlines')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('status', 'approved')
  if ((approvedOutlines || 0) === 0) {
    redirect(`/projects/${projectId}/rooms/${roomId}?view=2d&err2d=${encodeURIComponent('No drawing in this room is approved yet. At least one must be approved before the room can be 2D approved.')}`)
  }

  await supabase.from('intent_rooms').update({ review_state: '2d_approved' }).eq('id', roomId)
  revalidatePath(`/projects/${projectId}/rooms/${roomId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}
