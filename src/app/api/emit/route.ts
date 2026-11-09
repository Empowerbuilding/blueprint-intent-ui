import { NextResponse, type NextRequest } from 'next/server'
import { buildAndEmit, serviceClient } from '@/lib/emit-core'

// POST /api/emit — programmatic emission (secret-gated, for tests + automation).
// Body: { "project_id": "...", "dry_run": true|false }
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { project_id?: string; dry_run?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const client = await serviceClient()
  if (!client) {
    return NextResponse.json({ error: 'service key not configured' }, { status: 500 })
  }

  const result = await buildAndEmit(body.project_id, null, { dryRun: !!body.dry_run, client })
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 })
  }
  return NextResponse.json({
    ok: true,
    version: result.version,
    handoff: result.handoff,
    brief_md: result.briefMd,
  })
}
