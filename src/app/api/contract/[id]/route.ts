import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/contract/[id]?version=N — returns the emitted intent contract
// (intent.json + BRIEF.md). Auth: x-prefill-secret header (for Blueprint /
// design-brain machine access) OR a logged-in Supabase session.
// &schema=2 returns contract v2 (typed work items) from the same emission instead:
//   200 { version, schema, contract, emitted_at }   or   409 { error, v2_errors } when that emission has no v2.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const secret = request.headers.get('x-prefill-secret')
  const expected = process.env.PREFILL_SECRET

  let supabase = await createClient()
  if (secret && secret === expected) {
    // machine access with valid secret: service client
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as typeof supabase
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const version = request.nextUrl.searchParams.get('version')

  if (request.nextUrl.searchParams.get('schema') === '2') {
    let q2 = supabase
      .from('intent_emissions')
      .select('version, intent_v2_json, v2_errors, emitted_at')
      .eq('project_id', id)
      .order('version', { ascending: false })
      .limit(1)
    if (version) q2 = q2.eq('version', Number(version))
    const { data: row, error: err2 } = await q2.single()
    if (err2 || !row) return NextResponse.json({ error: 'no emission found for project' }, { status: 404 })
    if (!row.intent_v2_json) {
      return NextResponse.json(
        { error: 'this emission has no contract v2 — v1 is available without &schema=2', version: row.version, v2_errors: row.v2_errors || [] },
        { status: 409 },
      )
    }
    return NextResponse.json({ version: row.version, schema: 'intent-contract/2.0', contract: row.intent_v2_json, emitted_at: row.emitted_at })
  }

  let q = supabase
    .from('intent_emissions')
    .select('version, intent_json, brief_md, emitted_at, blueprint_status')
    .eq('project_id', id)
    .order('version', { ascending: false })
    .limit(1)
  if (version) q = q.eq('version', Number(version))

  const { data, error } = await q.single()
  if (error || !data) {
    return NextResponse.json({ error: 'no emission found for project' }, { status: 404 })
  }

  const fmt = request.nextUrl.searchParams.get('format')
  if (fmt === 'brief') {
    return new NextResponse(data.brief_md, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }
  return NextResponse.json(data)
}
