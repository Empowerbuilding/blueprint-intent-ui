// Vision-gate orchestration for outlines: load the room's confirmed decisions,
// run GLM-4.6v over the outline image, persist results to the outline row.
// The push path runs this in the BACKGROUND (vision on a large image can take
// 1-2+ minutes — the push API returns fast with math results; the room page
// shows "running…" and auto-refreshes until it lands).

import { runVisionGate, type VisionCheck } from '@/lib/vision-gate'

// minimal structural type for what we use
type AnyClient = {
  from: (t: string) => any
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
    client.from('intent_outlines').select('checks').eq('id', opts.outlineId).single(),
  ])

  const mediaType = /\.(jpe?g|webp|gif)$/i.exec(opts.storagePath)?.[1]?.toLowerCase()
  const check = await runVisionGate({
    imageUrl: `${supabaseUrl}/storage/v1/object/public/intent-outlines/${opts.storagePath}`,
    mediaType: mediaType === 'jpeg' || mediaType === 'webp' || mediaType === 'gif' ? `image/${mediaType}` : 'image/png',
    outlineType: opts.outlineType,
    roomName: opts.roomName,
    decisions: [...(roomDecisions || []), ...(houseDecisions || [])] as { topic: string; value: string }[],
  })

  const checks = { ...((outline as { checks?: Record<string, unknown> } | null)?.checks || {}), vision: check }
  await client.from('intent_outlines').update({ checks }).eq('id', opts.outlineId)
  return check
}

export function visionGateInBackground(
  client: AnyClient,
  opts: { outlineId: string; projectId: string; roomId: string; storagePath: string; outlineType: string; roomName: string }
): void {
  // mark running immediately (synchronous best-effort), then fire the real call
  void (async () => {
    try {
      const { data: outline } = await client.from('intent_outlines').select('checks').eq('id', opts.outlineId).single()
      const checks = { ...((outline as { checks?: Record<string, unknown> } | null)?.checks || {}), vision: { ran_at: new Date().toISOString(), model: 'glm-4.6v', status: 'running' } }
      await client.from('intent_outlines').update({ checks }).eq('id', opts.outlineId)
    } catch {
      /* placeholder is best-effort — the real update below is what matters */
    }
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
