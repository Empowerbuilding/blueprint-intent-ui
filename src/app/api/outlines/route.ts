import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/outlines?project_id=<uuid> — the machine-facing view of the 2D stage
// for a project: every room's active outlines with geometry, checks, approval
// state, and rejection feedback. Blueprint reads this to know what to redraft
// and what the humans approved. Auth: x-prefill-secret OR logged-in session.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  const secretOk = !!process.env.PREFILL_SECRET && secret === process.env.PREFILL_SECRET

  const supabase = await createClient()
  if (!secretOk) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id query param required' }, { status: 400 })

  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }

  const { data: project } = await client
    .from('intent_projects')
    .select('id, name, status, emitted_version')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const { data: rooms } = await client
    .from('intent_rooms')
    .select('id, section_code, name, review_state')
    .eq('project_id', projectId)
    .order('sort_order')

  const { data: outlines } = await client
    .from('intent_outlines')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'superseded')
    .order('pushed_at', { ascending: false })

  const byRoom = new Map<string, typeof outlines>()
  for (const o of outlines || []) {
    const list = byRoom.get(o.room_id) || []
    list!.push(o)
    byRoom.set(o.room_id, list!)
  }

  const roomsOut = (rooms || []).map((r) => {
    const list = byRoom.get(r.id) || []
    const pending = list!.filter((o) => o.status === 'pushed').length
    const approved = list!.filter((o) => o.status === 'approved').length
    const rejected = list!.filter((o) => o.status === 'rejected')
    return {
      section_code: r.section_code,
      name: r.name,
      review_state: r.review_state,
      two_d_gate: {
        can_approve_2d: r.review_state === 'confirmed' && pending === 0,
        pending,
        approved,
        rejected: rejected.map((o) => ({
          outline_type: o.outline_type,
          label: o.label,
          feedback: o.feedback,
          pushed_at: o.pushed_at,
        })),
      },
      outlines: list!.map((o) => ({
        id: o.id,
        outline_type: o.outline_type,
        label: o.label,
        status: o.status,
        pushed_at: o.pushed_at,
        pushed_by: o.pushed_by,
        image_url: o.storage_path
          ? `${SUPABASE_URL}/storage/v1/object/public/intent-outlines/${o.storage_path}`
          : null,
        geometry: o.geometry,
        math: o.checks?.math || null,
        vision: o.checks?.vision || null,
        feedback: o.feedback,
      })),
    }
  })

  return NextResponse.json({
    project: { id: project.id, name: project.name, status: project.status, emitted_version: project.emitted_version },
    rooms: roomsOut,
    note: 'Work order compiles from approved 2D. Rejected outlines carry feedback — redraft and re-push via POST /api/push-outline (same room/type/label supersedes).',
  })
}
