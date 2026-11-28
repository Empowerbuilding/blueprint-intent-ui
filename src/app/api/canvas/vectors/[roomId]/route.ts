// Proxy: CAD vector overlay geometry (contract v2 — GET /api/vectors/:roomId).

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineVectors } from '@/lib/canvas/engine'

export async function GET(_req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { roomId } = await ctx.params
  if (!roomId) return Response.json({ ok: false, error: 'roomId required' }, { status: 400 })

  const result = await engineVectors(roomId)
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    )
  }
  return Response.json(result.data)
}
