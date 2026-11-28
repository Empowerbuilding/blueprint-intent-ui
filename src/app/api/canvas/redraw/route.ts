// Proxy: room redraw. Session-gated — this one MUTATES engine state,
// so the engine-side freeze guard (contract ask #2) matters here.

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineRedraw } from '@/lib/canvas/engine'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }
  const { roomId, specUpdates, updateComposite } = (body ?? {}) as {
    roomId?: unknown
    specUpdates?: unknown
    updateComposite?: unknown
  }
  if (typeof roomId !== 'string' || !roomId) {
    return Response.json({ ok: false, error: 'roomId required' }, { status: 400 })
  }
  if (specUpdates !== undefined && typeof specUpdates !== 'object') {
    return Response.json({ ok: false, error: 'specUpdates must be an object' }, { status: 400 })
  }

  const result = await engineRedraw({
    roomId,
    specUpdates: (specUpdates ?? {}) as Record<string, number | string>,
    updateComposite: updateComposite === true,
  })
  if (!result.ok) {
    // Pass the engine's status + code through so the UI can react to
    // e.g. { ok:false, code:"room_frozen" } without guessing.
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    )
  }
  return Response.json(result.data)
}
