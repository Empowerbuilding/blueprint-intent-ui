import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { runMathGate, type Geometry, type RuleRow } from '@/lib/rules'
import { visionGateForOutline } from '@/lib/outline-vision'

// POST /api/verify-outline — re-run the math + vision gates on a pushed outline
// (e.g. after the rulebook changed, or to retry a failed vision call).
// Math is instant; vision is AWAITED here (explicit machine call — can take 1-2+ min
// on large images). Auth: x-prefill-secret header OR logged-in session.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  const secretOk = !!process.env.PREFILL_SECRET && secret === process.env.PREFILL_SECRET

  const supabase = await createClient()
  if (!secretOk) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { outline_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.outline_id) return NextResponse.json({ error: 'outline_id required' }, { status: 400 })

  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }

  const { data: outline, error } = await client
    .from('intent_outlines')
    .select('id, project_id, room_id, outline_type, label, storage_path, geometry, status, checks')
    .eq('id', body.outline_id)
    .single()
  if (error || !outline) return NextResponse.json({ error: 'outline not found' }, { status: 404 })
  if (outline.status === 'superseded') {
    return NextResponse.json({ error: 'outline is superseded — verify the replacement instead' }, { status: 409 })
  }

  const { data: room } = await client
    .from('intent_rooms')
    .select('id, section_code, name')
    .eq('id', outline.room_id)
    .single()
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  // ---- math gate ----
  const [{ data: ruleRows }, { data: latestVersion }] = await Promise.all([
    client.from('intent_rules').select('*').eq('active', true),
    client.from('intent_rulebook_versions').select('version').order('version', { ascending: false }).limit(1),
  ])
  const math = runMathGate(
    (ruleRows || []) as unknown as RuleRow[],
    { name: room.name, section_code: room.section_code },
    outline.outline_type,
    (outline.geometry || {}) as Geometry,
    latestVersion?.[0]?.version ?? null
  )

  // ---- vision gate (awaited — explicit verify call) ----
  let vision = null as Awaited<ReturnType<typeof visionGateForOutline>> | null
  if (outline.storage_path) {
    vision = await visionGateForOutline(client, {
      outlineId: outline.id,
      projectId: outline.project_id,
      roomId: outline.room_id,
      storagePath: outline.storage_path,
      outlineType: outline.outline_type,
      roomName: room.name,
    })
  }

  return NextResponse.json({ ok: true, outline_id: outline.id, math: { passed: math.passed, results: math.results }, vision })
}
