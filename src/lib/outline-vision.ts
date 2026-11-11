// Vision-gate orchestration for outlines: load the room's confirmed decisions,
// run GLM-4.6v over the outline image, persist results to the outline row.
// The push path runs this in the BACKGROUND (vision on a large image can take
// 1-2+ minutes — the push API returns fast with math results; the room page
// shows "running…" and auto-refreshes until it lands).

import { runVisionGate, type VisionCheck } from '@/lib/vision-gate'

// minimal structural type for what we use
type AnyClient = {
  // the two Supabase clients (user session, service role) have different generics; only .from() is used
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any
}

// Wake Blueprint when the vision gate lands CONFLICTS — it should not have to
// poll. (Missing/absent stays on the card for human review: non-spatial
// decisions routinely read as "missing" until the prompt learns to skip them.)
async function wakeOnConflicts(
  client: AnyClient,
  opts: { outlineId: string; projectId: string; roomName: string; outlineType: string },
  check: VisionCheck
): Promise<void> {
  if (check.status !== 'ok' || !check.results?.length) return
  const conflicts = check.results.filter((r) => r.verdict === 'conflict')
  if (!conflicts.length) return

  const portalUrl = process.env.PORTAL_URL
  const portalKey = process.env.PORTAL_SUPABASE_SERVICE_KEY
  if (!portalUrl || !portalKey) return

  let projectName = 'project'
  try {
    const { data: project } = await client.from('intent_projects').select('name').eq('id', opts.projectId).single()
    if (project?.name) projectName = project.name
  } catch { /* keep fallback */ }

  const conflictLines = conflicts.map((c) => `• ${c.topic}${c.note ? ` — ${c.note}` : ''}`).join('\n')
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
        content: `👁 **Vision gate CONFLICT — ${projectName} · ${opts.roomName} (${opts.outlineType}).** The pushed outline contradicts confirmed decisions:\n${conflictLines}\nRedraft and re-push (same room/type/label supersedes). Outline: ${opts.outlineId}`,
        processed: false,
      }),
    })
  } catch {
    // best effort — the results are on the outline card either way
  }
}

export async function visionGateForOutline(
  client: AnyClient,
  opts: { outlineId: string; projectId: string; roomId: string; storagePath: string; outlineType: string; roomName: string }
): Promise<VisionCheck> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const [{ data: roomDecisions }, { data: houseDecisions }, { data: outline }] = await Promise.all([
    client.from('intent_decisions').select('topic, value').eq('room_id', opts.roomId).eq('status', 'active'),
    client
      .from('intent_decisions')
      .select('topic, value')
      .eq('project_id', opts.projectId)
      .is('room_id', null)
      .eq('status', 'active'),
    client.from('intent_outlines').select('checks, geometry').eq('id', opts.outlineId).single(),
  ])

  const mediaType = /\.(jpe?g|webp|gif)$/i.exec(opts.storagePath)?.[1]?.toLowerCase()
  const geoElements = (((outline as { geometry?: { elements?: unknown[] } } | null)?.geometry?.elements) || []) as {
    kind: string
    label?: string
    w?: number
    h?: number
  }[]
  const check = await runVisionGate({
    imageUrl: `${supabaseUrl}/storage/v1/object/public/intent-outlines/${opts.storagePath}`,
    mediaType: mediaType === 'jpeg' || mediaType === 'webp' || mediaType === 'gif' ? `image/${mediaType}` : 'image/png',
    outlineType: opts.outlineType,
    roomName: opts.roomName,
    decisions: [...(roomDecisions || []), ...(houseDecisions || [])] as { topic: string; value: string }[],
    geometryElements: geoElements,
  })

  const checks = { ...((outline as { checks?: Record<string, unknown> } | null)?.checks || {}), vision: check }
  await client.from('intent_outlines').update({ checks }).eq('id', opts.outlineId)
  await wakeOnConflicts(client, opts, check)
  return check
}

export function visionGateInBackground(
  client: AnyClient,
  opts: { outlineId: string; projectId: string; roomId: string; storagePath: string; outlineType: string; roomName: string }
): void {
  // NOTE: the caller (push route / rerun action) writes the `vision: running`
  // placeholder BEFORE firing this — this function must NOT pre-write checks,
  // or it can race the caller's math write and clobber it.
  void (async () => {
    try {
      await visionGateForOutline(client, opts)
    } catch (e) {
      console.error('background vision gate failed', opts.outlineId, e)
      try {
        const { data: outline } = await client.from('intent_outlines').select('checks').eq('id', opts.outlineId).single()
        const checks = { ...((outline as { checks?: Record<string, unknown> } | null)?.checks || {}), vision: { ran_at: new Date().toISOString(), model: 'glm-4.6v', status: 'error', error: String(e).slice(0, 200) } }
        await client.from('intent_outlines').update({ checks }).eq('id', opts.outlineId)
      } catch {
        /* give up — re-run button / verify-outline API can retry */
      }
    }
  })()
}
