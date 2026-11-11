import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { MODEL_RULE_COLUMNS, type ModelRule } from '@/lib/model-rules'

// /api/model-rules — the registry of checks run on the BUILT model (the 3D rule registry), for machine clients.
//
// GET  ?status=accepted (default) | proposed | retired | all
//      -> { rules: [{ rule_key, description, status, kinds, params, checker, checker_status, source, version, decided_by, decided_at,
//                     decision_note, change_note, params_by, params_at }], counts }
//      decision_note = the note that goes with the last decision (also set when a check is put back to proposed because its
//      meaning changed). change_note = what a wording edit changed on a check that kept its acceptance.
//      params carries the numbers a check uses (tolerance_ft). An approver can change them in the app; the version goes up.
//      Only ACCEPTED checks are attached to work items in contract v2.
// POST { rule_key, description, kinds?, params?, checker?, checker_status?, source? }
//      -> 201 { rule_key, status: "proposed" }   (200 with duplicate:true if the key already exists)
//      A machine caller can only PROPOSE. Accepting or retiring is done by an approver, signed in, in the app.
//
// Auth: x-prefill-secret header (PREFILL_SECRET env). GET also works for a signed-in user.

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
const secretOk = (request: NextRequest) =>
  !!process.env.PREFILL_SECRET && request.headers.get('x-prefill-secret') === process.env.PREFILL_SECRET

const shape = (r: ModelRule) => ({
  rule_key: r.rule_key,
  description: r.description,
  status: r.status,
  kinds: r.kinds || [],
  params: r.params || {},
  checker: r.checker,
  checker_status: r.checker_status,
  source: r.source,
  version: r.version,
  decided_by: r.decided_by_email,
  decided_at: r.decided_at,
  decision_note: r.decision_note,
  change_note: r.change_note,
  // who last changed a number in params, and when (null = the starting value stands)
  params_by: r.params_by,
  params_at: r.params_at,
})

export async function GET(request: NextRequest) {
  const machine = secretOk(request)
  const userClient = await createClient()
  if (!machine) {
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const client = (machine && service()) || userClient
  const want = request.nextUrl.searchParams.get('status') || 'accepted'
  if (!['accepted', 'proposed', 'retired', 'all'].includes(want)) {
    return NextResponse.json({ error: 'status must be accepted | proposed | retired | all' }, { status: 400 })
  }
  const { data, error } = await client.from('intent_model_rules').select(MODEL_RULE_COLUMNS).order('rule_key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const all = (data || []) as unknown as ModelRule[]
  const counts = { proposed: 0, accepted: 0, retired: 0 }
  for (const r of all) counts[r.status]++
  return NextResponse.json({ rules: all.filter((r) => want === 'all' || r.status === want).map(shape), counts })
}

export async function POST(request: NextRequest) {
  if (!secretOk(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = service()
  if (!supabase) return NextResponse.json({ error: 'server not configured' }, { status: 500 })
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  for (const k of ['status', 'decided_by', 'decided_by_email', 'decided_at']) {
    if (k in body && !(k === 'status' && body[k] === 'proposed')) {
      return NextResponse.json(
        { error: 'checks can only be proposed here ("' + k + '" is not accepted). Accepting is done by an approver in the app.' },
        { status: 400 },
      )
    }
  }
  const text = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
  const ruleKey = text('rule_key')
  const description = text('description')
  if (!/^[a-z0-9]+(\.[a-z0-9_]+)+$/.test(ruleKey)) {
    return NextResponse.json({ error: 'rule_key looks like "casework.no_overlap": lower case, a dot between the group and the name' }, { status: 400 })
  }
  if (!description) return NextResponse.json({ error: 'description is required: the sentence a person reads' }, { status: 400 })
  const kinds = Array.isArray(body.kinds) ? (body.kinds as unknown[]).filter((k): k is string => typeof k === 'string') : []
  if (kinds.length) {
    const { data: kindRows } = await supabase.from('intent_kinds').select('kind')
    const known = new Set(((kindRows || []) as { kind: string }[]).map((k) => k.kind))
    const unknown = kinds.filter((k) => !known.has(k))
    if (unknown.length) return NextResponse.json({ error: 'not in the list of kinds: ' + unknown.join(', ') }, { status: 422 })
  }
  const checkerStatus = text('checker_status') || 'none'
  if (!['none', 'script', 'tool', 'app'].includes(checkerStatus)) {
    return NextResponse.json({ error: 'checker_status must be none | script | tool | app' }, { status: 400 })
  }
  const { data: twin } = await supabase.from('intent_model_rules').select('rule_key, status').eq('rule_key', ruleKey).maybeSingle()
  if (twin) return NextResponse.json({ rule_key: twin.rule_key, status: twin.status, duplicate: true })
  const { data: row, error } = await supabase
    .from('intent_model_rules')
    .insert({
      rule_key: ruleKey,
      description,
      status: 'proposed',
      kinds,
      params: body.params && typeof body.params === 'object' ? body.params : {},
      checker: text('checker') || null,
      checker_status: checkerStatus,
      source: text('source') || null,
      proposed_by: 'blueprint',
    })
    .select('rule_key, status')
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 })
  return NextResponse.json({ rule_key: row.rule_key, status: row.status }, { status: 201 })
}
