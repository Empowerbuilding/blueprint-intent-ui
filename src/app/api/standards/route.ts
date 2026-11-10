import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// /api/standards — machine access to the modeling + construction-docs standards.
// Auth: x-prefill-secret header (PREFILL_SECRET env) — same as the other machine routes.
//
// GET  /api/standards            → all active standards
// GET  /api/standards?slug=...   → one standard (404 if unknown)
// POST /api/standards            → upsert by slug (Blueprint pushes its own doc
//                                  updates back so the UI stays current as it learns)
//   body: { slug, content, title?, description?, category?, note?, source_path? }
//   categories: modeling | construction_docs | process | components

const CATEGORIES = ['modeling', 'construction_docs', 'process', 'components']

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

  const slug = request.nextUrl.searchParams.get('slug')
  let query = supabase
    .from('intent_standards')
    .select('slug, category, title, description, content, format, source_path, version, updated_at')
    .eq('active', true)
    .order('slug')
  if (slug) query = query.eq('slug', slug)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (slug && (!data || data.length === 0)) {
    return NextResponse.json({ error: `unknown slug: ${slug}` }, { status: 404 })
  }
  return NextResponse.json(slug ? data[0] : { standards: data })
}

export async function POST(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = service()
  if (!supabase) return NextResponse.json({ error: 'server not configured' }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  if (!slug || !content.trim()) {
    return NextResponse.json({ error: 'slug and content are required' }, { status: 400 })
  }
  const category = typeof body.category === 'string' ? body.category : 'process'
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of ${CATEGORIES.join(', ')}` }, { status: 400 })
  }
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : slug
  const description = typeof body.description === 'string' ? body.description : ''
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null
  const sourcePath = typeof body.source_path === 'string' ? body.source_path : null
  const pushedBy = typeof body.pushed_by === 'string' ? body.pushed_by : 'blueprint'

  const { data: existing } = await supabase
    .from('intent_standards')
    .select('id, version')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    const nextVersion = (existing.version || 1) + 1
    const { error: updErr } = await supabase
      .from('intent_standards')
      .update({ content, category, title, description, source_path: sourcePath, version: nextVersion, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    await supabase.from('intent_standards_versions').insert({
      standard_id: existing.id,
      version: nextVersion,
      content,
      note: note || `pushed by ${pushedBy}`,
    })
    return NextResponse.json({ ok: true, slug, version: nextVersion, updated: true })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('intent_standards')
    .insert({ slug, category, title, description, content, source_path: sourcePath, version: 1, active: true })
    .select('id')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  await supabase.from('intent_standards_versions').insert({
    standard_id: inserted.id,
    version: 1,
    content,
    note: note || `created by ${pushedBy}`,
  })
  return NextResponse.json({ ok: true, slug, version: 1, created: true })
}
