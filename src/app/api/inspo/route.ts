import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { FETCH_URL_TTL, INSPO_BUCKET, signedUrls, type StorageClient } from '@/lib/storage'
import { tidyLayoutDetails } from '@/lib/inspo-analysis'

// GET /api/inspo?project_id=<uuid>[&room=<section_code>] — the inspiration pictures attached to rooms, for the
// 2D drawing phase (spec A97): Blueprint looks at each picture itself, next to the details the app read out of it.
// Per picture: the room, the storage path (the key the typed contract uses), notes, tags, layout_details,
// analyzed_at, and image_url: a signed link that stops working after ten minutes.
// Pictures that are parked or not assigned are not listed. Auth: x-prefill-secret OR logged-in session.

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
  const roomCode = request.nextUrl.searchParams.get('room')

  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }

  const { data: project } = await client.from('intent_projects').select('id, name').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const [{ data: rooms }, { data: images }] = await Promise.all([
    client.from('intent_rooms').select('id, section_code, name').eq('project_id', projectId).order('sort_order'),
    client.from('intent_inspo_images').select('*').eq('project_id', projectId).order('created_at'),
  ])
  const roomById = new Map((rooms || []).map((r) => [r.id, r]))
  const mine = (images || []).filter((i) => {
    const r = i.room_id ? roomById.get(i.room_id) : null
    return !!r && (!roomCode || String(r.section_code) === roomCode)
  })
  const urls = await signedUrls(client as unknown as StorageClient, INSPO_BUCKET, mine.map((i) => i.storage_path), FETCH_URL_TTL)

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    room: roomCode,
    link_seconds: FETCH_URL_TTL,
    pictures: mine.map((i) => {
      const r = roomById.get(i.room_id)!
      return {
        id: i.id,
        room: String(r.section_code),
        room_name: r.name,
        storage_path: i.storage_path,
        notes: i.notes ?? null,
        tags: i.tags || [],
        layout_details: tidyLayoutDetails(i.layout_details),
        analyzed_at: i.analyzed_at ?? null,
        image_url: urls.get(i.storage_path) || null,
      }
    }),
  })
}
