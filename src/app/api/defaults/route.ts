import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { loadDefaultRows } from '@/lib/defaults'

// GET /api/defaults — what gets built when nobody decided otherwise, for machine clients (Blueprint).
// -> { defaults: [{ topic, value, scope }], updated_at, source: "app" }
// Read only. Defaults are changed by an approver, signed in, in the app (Rulebook → Defaults).
// Auth: x-prefill-secret header (PREFILL_SECRET env), or a signed-in user.

export async function GET(request: NextRequest) {
  const machine = !!process.env.PREFILL_SECRET && request.headers.get('x-prefill-secret') === process.env.PREFILL_SECRET
  const userClient = await createClient()
  if (!machine) {
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const client = machine && url && key ? createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : userClient

  const rows = await loadDefaultRows(client)
  if (!rows) return NextResponse.json({ error: 'defaults could not be read' }, { status: 500 })
  const active = rows.filter((r) => r.active)
  return NextResponse.json({
    defaults: active.map((r) => ({ topic: r.topic, value: r.value, scope: r.scope })),
    turned_off: rows.filter((r) => !r.active).map((r) => r.topic),
    updated_at: rows.map((r) => r.updated_at || '').sort().pop() || null,
    source: 'app',
  })
}
