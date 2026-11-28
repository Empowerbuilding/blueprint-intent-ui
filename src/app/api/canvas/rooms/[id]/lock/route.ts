// Proxy: engine-side room lock/unfreeze (contract v2 — POST /api/rooms/:id/lock).
// The ENGINE is the freeze authority (HTTP 423 room_frozen on locked redraws);
// this UI action lifts or restores it and gets the updated room back.

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineRoomLock } from '@/lib/canvas/engine'

const STATUSES = ['frozen', 'updated', 'approved', 'draft'] as const
type Status = (typeof STATUSES)[number]

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return Response.json({ ok: false, error: 'room id required' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const { status, by, reason } = (body ?? {}) as { status?: unknown; by?: unknown; reason?: unknown }
  if (typeof status !== 'string' || !STATUSES.includes(status as Status)) {
    return Response.json(
      { ok: false, error: `status must be one of ${STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const result = await engineRoomLock(
    id,
    status as Status,
    typeof by === 'string' ? by : undefined,
    typeof reason === 'string' ? reason : undefined,
  )
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    )
  }
  return Response.json(result.data)
}
