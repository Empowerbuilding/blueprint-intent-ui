import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/check-exceptions?project_id=<uuid>[&room_id=][&outline_type=][&label=][&check=]
//   Active slot-matched exceptions. Auth: x-prefill-secret OR logged-in session.
// POST /api/check-exceptions — body: { project_id, room_id, outline_type, label?, check, ruled_by, ruled_at, quote?, source? }
//   Creates one exception. Secret-gated (machine port from rulings.json) or session.
//   A duplicate active exception for the same slot+check is updated, not duplicated.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function authed(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  const secretOk = !!process.env.PREFILL_SECRET && secret === process.env.PREFILL_SECRET
  const supabase = await createClient()
  if (!secretOk) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const }
  }
  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }
  return { ok: true as const, client }
}

export async function GET(request: NextRequest) {
  const a = await authed(request)
  if (!a.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const q = request.nextUrl.searchParams
  const projectId = q.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id query param required' }, { status: 400 })
  let sel = a.client.from('intent_check_exceptions').select('*').eq('project_id', projectId).eq('active', true)
  const roomId = q.get('room_id'); if (roomId) sel = sel.eq('room_id', roomId)
  const outlineType = q.get('outline_type'); if (outlineType) sel = sel.eq('outline_type', outlineType)
  const label = q.get('label'); if (label) sel = sel.eq('label', label)
  const check = q.get('check'); if (check) sel = sel.eq('check_key', check)
  const { data, error } = await sel.order('ruled_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ exceptions: data })
}

export async function POST(request: NextRequest) {
  const a = await authed(request)
  if (!a.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const need = ['project_id', 'room_id', 'outline_type', 'check', 'ruled_by', 'ruled_at'] as const
  for (const k of need) if (!body[k] || typeof body[k] !== 'string') return NextResponse.json({ error: k + ' required' }, { status: 400 })
  const row = {
    project_id: body.project_id, room_id: body.room_id, outline_type: body.outline_type,
    label: typeof body.label === 'string' ? body.label : '',
    check_key: body.check, ruled_by: body.ruled_by, ruled_at: body.ruled_at,
    quote: typeof body.quote === 'string' ? body.quote : '',
    source: typeof body.source === 'string' ? body.source : 'app',
    active: true,
  }
  const { data: existing } = await a.client
    .from('intent_check_exceptions')
    .select('id').eq('project_id', row.project_id).eq('room_id', row.room_id)
    .eq('outline_type', row.outline_type).eq('label', row.label).eq('check_key', row.check_key).eq('active', true).maybeSingle()
  if (existing) {
    const { data: updated, error } = await a.client.from('intent_check_exceptions').update(row).eq('id', existing.id).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: updated.id, updated: true })
  }
  const { data: created, error } = await a.client.from('intent_check_exceptions').insert(row).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: created.id, updated: false })
}
