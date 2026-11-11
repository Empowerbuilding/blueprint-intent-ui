import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// POST /api/gaps — Blueprint logs something it needed and the Revit bridge (or its own tooling) could
// not do. { title, detail, workaround?, project?, source_ref? } -> 201 { id, status: "open" }
// (200 with duplicate:true when an open gap already has that title).
// A machine caller can only ADD a gap. Closing one is done by an approver, signed in, in the app.
// Reading: GET /api/capabilities returns the open gaps.
// Auth: x-prefill-secret header (PREFILL_SECRET env).

export async function POST(request: NextRequest) {
  if (!process.env.PREFILL_SECRET || request.headers.get('x-prefill-secret') !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  const supabase = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  for (const k of ['status', 'closed_at', 'closed_by', 'closed_by_email', 'close_note']) {
    if (k in body && !(k === 'status' && body[k] === 'open')) {
      return NextResponse.json({ error: 'a gap can only be added here ("' + k + '" is not accepted). Closing is done by an approver in the app.' }, { status: 400 })
    }
  }
  const text = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
  const title = text('title')
  const detail = text('detail')
  if (!title || !detail) return NextResponse.json({ error: 'title and detail are required' }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: 'title is one line: 200 characters at most' }, { status: 400 })

  const { data: open } = await supabase.from('intent_gaps').select('id, title').eq('status', 'open')
  const twin = ((open || []) as { id: string; title: string }[]).find((g) => g.title.trim().toLowerCase() === title.toLowerCase())
  if (twin) return NextResponse.json({ id: twin.id, status: 'open', duplicate: true })

  const { data: row, error } = await supabase
    .from('intent_gaps')
    .insert({
      status: 'open',
      title,
      detail,
      workaround: text('workaround') || null,
      project_name: text('project') || null,
      source_ref: text('source_ref') || null,
      proposed_by: 'blueprint',
    })
    .select('id, status')
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 })
  return NextResponse.json({ id: row.id, status: row.status }, { status: 201 })
}
