// Proxy: engine health probe. Session-gated (the engine must stay private).

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineHealth } from '@/lib/canvas/engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const result = await engineHealth()
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 502 })
  }
  return Response.json(result.data)
}
