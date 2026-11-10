import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/projects?name=Whitaker — project lookup by name for machine clients
// (id, status, emitted_version, room count) so push tools don't need a stored id.
// GET /api/rules — the active math-gate rulebook (for local gate mirrors).
// Auth: x-prefill-secret header (PREFILL_SECRET env) — machine-to-machine.

function authed(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  return !!process.env.PREFILL_SECRET && secret === process.env.PREFILL_SECRET
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = service()
  if (!supabase) return NextResponse.json({ error: 'server not configured' }, { status: 500 })

  const name = request.nextUrl.searchParams.get('name')

  if (name) {
    const { data: project, error } = await supabase
      .from('intent_projects')
      .select('id, name, client, status, emitted_version, created_at')
      .ilike('name', name)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: `no project named "${name}"` }, { status: 404 })
    const { count: roomCount } = await supabase
      .from('intent_rooms')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
    return NextResponse.json({ ...project, room_count: roomCount || 0 })
  }

  const { data: projects, error } = await supabase
    .from('intent_projects')
    .select('id, name, client, status, emitted_version, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects })
}
