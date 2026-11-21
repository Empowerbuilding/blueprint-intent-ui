import { NextResponse, type NextRequest } from 'next/server'
import { serviceClient } from '@/lib/emit-core'

// POST /api/run-status — the runner's window into the project (2026-11-21).
// Body: { "project_id": "...", "status": "building"|"sheets"|"done", "phases": [...]? }
//   phases: [{ "phase_key": "e1", "label": "Geometry", "state": "done", "note": "...", "sort": 1 }]
// Sets the project status when given (so the tracker moves: building → sheets → done) and upserts the
// phase rows (one row per phase_key, newest write wins). The project page reads the phases directly.
//
// Auth: x-emit-secret header (EMIT_SECRET env) — same guard as /api/emit, so only automation that
// was granted the emit secret can move a run forward.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-emit-secret')
  if (!process.env.EMIT_SECRET) {
    return NextResponse.json({ error: 'run-status secret not configured' }, { status: 503 })
  }
  if (secret !== process.env.EMIT_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    project_id?: string
    status?: string
    phases?: { phase_key: string; label: string; state?: string; note?: string | null; sort?: number }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const allowed = ['building', 'sheets', 'done', 'locked']
  if (body.status && !allowed.includes(body.status)) {
    return NextResponse.json({ error: 'status must be one of: ' + allowed.join(', ') }, { status: 400 })
  }

  const client = await serviceClient()
  if (!client) {
    return NextResponse.json({ error: 'service key not configured' }, { status: 500 })
  }

  if (body.status) {
    const { error } = await client.from('intent_projects').update({ status: body.status }).eq('id', body.project_id)
    if (error) {
      return NextResponse.json({ error: 'status update failed: ' + error.message }, { status: 500 })
    }
  }

  let written = 0
  for (const p of body.phases || []) {
    if (!p.phase_key || !p.label) continue
    const row = {
      project_id: body.project_id,
      phase_key: p.phase_key,
      label: p.label,
      state: p.state || 'doing',
      note: p.note ?? null,
      sort: p.sort ?? 0,
      updated_at: new Date().toISOString(),
    }
    const { error } = await client.from('intent_run_phases').upsert(row, { onConflict: 'project_id,phase_key' })
    if (error) {
      return NextResponse.json({ error: 'phase upsert failed for ' + p.phase_key + ': ' + error.message }, { status: 500 })
    }
    written++
  }

  return NextResponse.json({ ok: true, status: body.status || null, phases_written: written })
}
