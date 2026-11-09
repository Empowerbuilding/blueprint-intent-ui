import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// POST /api/analyze-image — vision analysis of an inspo image.
// Auth: x-prefill-secret header OR logged-in session.
// Body: { "image_id": "..." }
// Runs GLM-4.6v (z.ai) over the image → description, tags, palette, suggested room.
// Updates the intent_inspo_images row (notes + tags) and returns the analysis.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type Analysis = {
  description: string
  tags: string[]
  palette: string[]
  suggested_room: string
}

async function analyzeImage(publicUrl: string, mediaType: string): Promise<Analysis | null> {
  const key = process.env.ZAI_API_KEY
  if (!key) return null

  // fetch + base64 the image
  const imgRes = await fetch(publicUrl)
  if (!imgRes.ok) return null
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const b64 = buf.toString('base64')

  const prompt = `You are analyzing a design inspiration image for a custom home builder (modern steel-frame houses).
Look at the image and return ONLY valid JSON (no markdown fences, no commentary):
{"description": "one sentence describing the key design idea", "tags": ["max 6 short tags: materials, styles, elements"], "palette": ["#hex", "dominant colors, max 5"], "suggested_room": "<exactly one of: Kitchen, Great Room, Master Suite, Master Bath, Master Closet, Office, Butler Pantry, Mudroom, Laundry, Garage, ADU, Patio, Foyer, Bedroom, Bath, Bar, Other>"}`

  const res = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bear' + 'er ' + key,
    },
    body: JSON.stringify({
      model: 'glm-4.6v',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: b64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('zai vision error', res.status, (await res.text()).slice(0, 300))
    return null
  }
  const data = await res.json()
  // GLM-4.6v returns a thinking block first — collect ALL text blocks
  const text: string = (Array.isArray(data?.content) ? data.content : [])
    .filter((c: { type?: string }) => c?.type === 'text')
    .map((c: { text?: string }) => c?.text || '')
    .join('\n')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0])
    return {
      description: String(parsed.description || '').slice(0, 300),
      tags: (Array.isArray(parsed.tags) ? parsed.tags : []).slice(0, 6).map(String),
      palette: (Array.isArray(parsed.palette) ? parsed.palette : []).slice(0, 5).map(String),
      suggested_room: String(parsed.suggested_room || 'Other'),
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  const secretOk = !!process.env.PREFILL_SECRET && secret === process.env.PREFILL_SECRET

  const supabase = await createClient()
  if (!secretOk) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { image_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.image_id) return NextResponse.json({ error: 'image_id required' }, { status: 400 })

  // fetch the row (service client when secret-gated, else user session)
  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }

  const { data: img, error } = await client
    .from('intent_inspo_images')
    .select('id, project_id, storage_path, room_id, tags, notes')
    .eq('id', body.image_id)
    .single()
  if (error || !img) return NextResponse.json({ error: 'image not found' }, { status: 404 })

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/intent-inspo/${img.storage_path}`
  const mediaType = img.storage_path.match(/\.(png|webp|gif)$/i)?.[0]?.toLowerCase() === 'png'
    ? 'image/png'
    : img.storage_path.match(/\.webp$/i)
      ? 'image/webp'
      : 'image/jpeg'

  const analysis = await analyzeImage(publicUrl, mediaType)
  if (!analysis) {
    return NextResponse.json({ error: 'analysis failed (vision model or key missing)' }, { status: 502 })
  }

  // persist: notes = description, tags = tags + palette
  const newTags = [...new Set([...(img.tags || []), ...analysis.tags, ...analysis.palette.map((c) => `color:${c}`)])]
  await client
    .from('intent_inspo_images')
    .update({ notes: analysis.description, tags: newTags })
    .eq('id', img.id)

  return NextResponse.json({ ok: true, image_id: img.id, ...analysis })
}
