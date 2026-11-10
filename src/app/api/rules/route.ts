import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// GET /api/rules — the active math-gate rulebook (rule rows + rulebook version),
// for machine clients that mirror the gate locally. Same shape the gate executes.
// Auth: x-prefill-secret header (PREFILL_SECRET env) — machine-to-machine.

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-prefill-secret')
  if (!process.env.PREFILL_SECRET || secret !== process.env.PREFILL_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  const supabase = createServiceClient(url, key, { auth: { persistSession: false } })

  const [{ data: rules, error: rulesErr }, { data: latest }] = await Promise.all([
    supabase
      .from('intent_rules')
      .select('rule_key, description, rule_type, params, applies_to, version')
      .eq('active', true)
      .order('rule_key'),
    supabase
      .from('intent_rulebook_versions')
      .select('version, created_at')
      .order('version', { ascending: false })
      .limit(1),
  ])
  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 })

  return NextResponse.json({
    rulebook_version: latest?.[0]?.version ?? 1,
    rulebook_version_at: latest?.[0]?.created_at ?? null,
    rules: rules || [],
  })
}
