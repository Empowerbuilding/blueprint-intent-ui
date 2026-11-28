// Proxy: pattern re-render (Barnhaus Pattern & Settings Library mode).

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineRedrawPattern } from '@/lib/canvas/engine'

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
  const { patternId, overrides } = (body ?? {}) as { patternId?: unknown; overrides?: unknown }
  if (typeof patternId !== 'string' || !patternId) {
    return Response.json({ ok: false, error: 'patternId required' }, { status: 400 })
  }

  const result = await engineRedrawPattern({
    patternId,
    overrides: (overrides ?? {}) as { wallWidthIn?: number; ceilingIn?: number },
  })
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    )
  }
  return Response.json(result.data)
}
