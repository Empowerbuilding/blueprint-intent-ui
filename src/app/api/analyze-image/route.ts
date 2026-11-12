import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { analyseStoredImage } from '@/lib/inspo-analyse-run'

// POST /api/analyze-image — vision analysis of an inspo image.
// Auth: x-prefill-secret header OR logged-in session.
// Body: { "image_id": "..." }
// Runs GLM-4.6v (z.ai) over the image → description, tags, palette, suggested room, and layout_details:
// up to 8 short facts a floor plan can show (spec A97). Saves notes, tags, layout_details and analyzed_at on the
// intent_inspo_images row and returns the analysis. Calling it again reads the picture again and replaces the details.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

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

  // service client when secret-gated, else the user's session
  let client = supabase
  if (secretOk && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    client = createServiceClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as typeof supabase
  }

  const r = await analyseStoredImage(client, body.image_id)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, image_id: r.image_id, ...r.analysis })
}
