// Proxy: full StudioStateV16. Session-gated.

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineState } from '@/lib/canvas/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const result = await engineState()
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, code: result.code }, { status: 502 })
  }
  return Response.json(result.data)
}
