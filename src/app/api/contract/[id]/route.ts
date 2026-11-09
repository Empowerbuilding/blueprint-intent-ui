import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/contract/[id]?version=N — returns the emitted intent contract
// (intent.json + BRIEF.md). Auth: x-prefill-secret header (for Blueprint /
// design-brain machine access) OR a logged-in Supabase session.
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
