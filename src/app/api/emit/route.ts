import { NextResponse, type NextRequest } from 'next/server'
import { buildAndEmit, serviceClient } from '@/lib/emit-core'

// POST /api/emit — programmatic emission (for tests + automation).
// Body: { "project_id": "...", "dry_run": true|false, "again": true|false }
// A call that would write exactly what the last emission holds writes nothing and answers written:false with that
// emission's version; "again": true writes a new version anyway. A dry run reports the same under unchanged_since.
//
// Auth: x-emit-secret header (EMIT_SECRET env) — SEPARATE from the prefill
// secret on purpose: the push secret is shared with automation that must never
// be able to lock/emit. Emission is human-driven (UI) unless this secret is
// explicitly granted.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-emit-secret')
  if (!process.env.EMIT_SECRET) {
    return NextResponse.json({ error: 'emit secret not configured — emission is UI-only' }, { status: 503 })
  }
  if (secret !== process.env.EMIT_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { project_id?: string; dry_run?: boolean; again?: boolean }
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

  const result = await buildAndEmit(body.project_id, null, { dryRun: !!body.dry_run, again: body.again === true, client })
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 })
  }
  return NextResponse.json({
    ok: true,
    version: result.version,
    written: result.written,
    unchanged_since: result.unchanged,
    handoff: result.handoff,
    brief_md: result.briefMd,
    // contract v2 rides beside v1; ok:false means v1 was emitted and v2 still has gaps
    v2: { ok: result.v2.ok, stored: result.v2.stored, work_items: result.v2.work_items, errors: result.v2.errors, warnings: result.v2.warnings },
  })
}
