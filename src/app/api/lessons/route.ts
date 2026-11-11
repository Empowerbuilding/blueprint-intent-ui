import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { LESSON_COLUMNS, LESSON_KINDS, lessonRule, type Lesson } from '@/lib/lessons'

// /api/lessons — the lessons ledger for machine clients (Blueprint).
//
// GET  ?status=accepted (default) | proposed | dismissed | retired | all   &since=<ISO time>
//      -> { lessons: [...], counts: {...}, approvers: ["Mitch", "Michael"] }
//      Blueprint reads ACCEPTED lessons at the start of work. "rule" is the wording to follow.
// POST { title, proposed_rule, what_happened?, kind?, project? | project_id?, source_ref? }
//      -> 201 { id, status: "proposed" }   (200 with duplicate:true if the same title is already on the ledger)
//      A machine caller can only PROPOSE. There is no machine route that accepts, dismisses or
//      retires a lesson: that is done by an approver, signed in, in the app.
//
// Auth: x-prefill-secret header (PREFILL_SECRET env). GET also works for a signed-in user.

type Out = ReturnType<typeof shape>
function shape(l: Lesson) {
  return {
    id: l.id,
    status: l.status,
    kind: l.kind,
    title: l.title,
    rule: lessonRule(l),
    what_happened: l.what_happened,
    project: l.project_name,
    source_ref: l.source_ref,
    proposed_by: l.proposed_by,
    proposed_at: l.created_at,
    decided_by: l.decided_by_email,
    decided_at: l.decided_at,
    note: l.decision_note,
  }
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
const secretOk = (request: NextRequest) =>
  !!process.env.PREFILL_SECRET && request.headers.get('x-prefill-secret') === process.env.PREFILL_SECRET

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
  if (!['accepted', 'proposed', 'dismissed', 'retired', 'all'].includes(want)) {
    return NextResponse.json({ error: 'status must be accepted | proposed | dismissed | retired | all' }, { status: 400 })
  }
  const since = request.nextUrl.searchParams.get('since')

  const [{ data, error }, { data: approvers }] = await Promise.all([
    client.from('intent_lessons').select(LESSON_COLUMNS).order('created_at', { ascending: false }),
    client.from('intent_approvers').select('name').order('name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const all = (data || []) as unknown as Lesson[]
  const counts = { proposed: 0, accepted: 0, dismissed: 0, retired: 0 }
  for (const l of all) counts[l.status]++
  const lessons: Out[] = all
    .filter((l) => want === 'all' || l.status === want)
    .filter((l) => !since || (l.decided_at || l.created_at) > since)
    .map(shape)
  return NextResponse.json({
    lessons,
    counts,
    approvers: ((approvers || []) as { name: string }[]).map((a) => a.name),
  })
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
  // proposing is all this route does, whatever is sent
  for (const k of ['status', 'accepted_rule', 'decided_by', 'decided_by_email', 'decided_at', 'accepted_at']) {
    if (k in body && !(k === 'status' && body[k] === 'proposed')) {
      return NextResponse.json(
        { error: 'lessons can only be proposed here ("' + k + '" is not accepted). Accepting is done by an approver in the app.' },
        { status: 400 },
      )
    }
  }
  const text = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
  const title = text('title')
  const rule = text('proposed_rule')
  if (!title || !rule) return NextResponse.json({ error: 'title and proposed_rule are required' }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: 'title is one line: 200 characters at most' }, { status: 400 })
  const kind = text('kind') || 'process'
  if (!LESSON_KINDS.some((k) => k.key === kind)) {
    return NextResponse.json({ error: 'kind must be one of: ' + LESSON_KINDS.map((k) => k.key).join(', ') }, { status: 400 })
  }

  // same title already waiting or accepted -> not added twice
  const { data: existing } = await supabase.from('intent_lessons').select('id, status, title').in('status', ['proposed', 'accepted'])
  const twin = ((existing || []) as { id: string; status: string; title: string }[]).find(
    (l) => l.title.trim().toLowerCase() === title.toLowerCase(),
  )
  if (twin) return NextResponse.json({ id: twin.id, status: twin.status, duplicate: true })

  let projectId: string | null = null
  let projectName: string | null = null
  const wantId = text('project_id')
  const wantName = text('project')
  if (wantId || wantName) {
    const q = supabase.from('intent_projects').select('id, name')
    const { data: p } = await (wantId ? q.eq('id', wantId) : q.eq('name', wantName)).maybeSingle()
    if (p) {
      projectId = p.id
      projectName = p.name
    } else {
      projectName = wantName || null // a project that is not in this app (yet): keep the name as written
    }
  }

  const { data: row, error } = await supabase
    .from('intent_lessons')
    .insert({
      status: 'proposed',
      kind,
      title,
      what_happened: text('what_happened'),
      proposed_rule: rule,
      project_id: projectId,
      project_name: projectName,
      source: 'blueprint',
      source_ref: text('source_ref') || null,
      proposed_by: 'blueprint',
    })
    .select('id, status')
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message || 'insert failed' }, { status: 500 })
  return NextResponse.json({ id: row.id, status: row.status }, { status: 201 })
}
