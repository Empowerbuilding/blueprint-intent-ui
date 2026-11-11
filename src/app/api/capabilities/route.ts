import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { COMMAND_RE, MACHINE_RE, MARK_LABEL, commandNames, latestPerMachine, loadCapabilities, type BridgeCommand, type BridgeReport } from '@/lib/capabilities'

// /api/capabilities — what the Revit bridge on each machine can do. The app never calls a bridge:
// Blueprint reads the bridge's own /health and /tools and reports them here.
//
// POST { machine, bridge_build, revit_version?, commands: ["revit.x", ...] | [{ name, description? }],
//        proven?: [{ command, note? }] }
//      -> { ok, machine, bridge_build, new_build, added: [...], removed: [...] }
//      Same build and same command list as the last report for that machine -> only its "last
//      confirmed" time moves. Anything different -> a new report row (history is kept).
//      proven: commands Blueprint has run live on this machine and checked the result of.
// GET  -> { machines: [{ machine, bridge_build, revit_version, reported_at, commands: [...] }],
//           proven: [...], gaps_open: [...],
//           marked: [{ command, mark: 'stub' | 'disabled', label, bridge_build, note }] }
//      marked = commands on the list that do not act. No work order may call one.
// Auth: x-prefill-secret header (PREFILL_SECRET env). GET also works for a signed-in user.

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
  const { reports, proven, gaps, marks } = await loadCapabilities((machine && service()) || userClient)
  return NextResponse.json({
    machines: latestPerMachine(reports).map((m) => ({
      machine: m.latest.machine,
      bridge_build: m.latest.bridge_build,
      previous_build: m.previousBuild,
      revit_version: m.latest.revit_version,
      first_reported_at: m.latest.first_reported_at,
      reported_at: m.latest.reported_at,
      commands: commandNames(m.latest),
    })),
    proven: proven.map((p) => ({ command: p.command, machine: p.machine, bridge_build: p.bridge_build, note: p.note, proven_at: p.proven_at })),
    gaps_open: gaps
      .filter((g) => g.status === 'open')
      .map((g) => ({ id: g.id, title: g.title, detail: g.detail, workaround: g.workaround, project: g.project_name, proposed_at: g.created_at })),
    marked: marks.map((m) => ({ command: m.command, mark: m.mark, label: MARK_LABEL[m.mark], bridge_build: m.bridge_build, note: m.note })),
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
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

  const machine = typeof body.machine === 'string' ? body.machine.trim().toLowerCase() : ''
  if (!MACHINE_RE.test(machine)) return bad('machine is required: a short lower-case name such as "mitch"')
  const build = typeof body.bridge_build === 'string' ? body.bridge_build.trim() : ''
  if (!build || build.length > 40) return bad('bridge_build is required (the build the bridge itself reports)')
  const revit = typeof body.revit_version === 'string' ? body.revit_version.trim().slice(0, 40) : null
  if (!Array.isArray(body.commands) || body.commands.length === 0 || body.commands.length > 2000) {
    return bad('commands is required: the command list the bridge itself returned')
  }
  const commands: BridgeCommand[] = []
  const seen = new Set<string>()
  for (const c of body.commands as unknown[]) {
    const name = typeof c === 'string' ? c : c && typeof c === 'object' ? (c as { name?: unknown }).name : null
    if (typeof name !== 'string' || !COMMAND_RE.test(name)) return bad('not a command name: ' + JSON.stringify(c).slice(0, 80))
    if (seen.has(name)) continue
    seen.add(name)
    const description = c && typeof c === 'object' && typeof (c as { description?: unknown }).description === 'string' ? String((c as { description: string }).description).slice(0, 300) : null
    commands.push({ name, description })
  }
  commands.sort((a, b) => a.name.localeCompare(b.name))
  const provenIn = body.proven === undefined ? [] : body.proven
  if (!Array.isArray(provenIn)) return bad('proven must be a list of { command, note }')
  const proven: { command: string; note: string | null }[] = []
  for (const p of provenIn as unknown[]) {
    const command = p && typeof p === 'object' ? (p as { command?: unknown }).command : null
    if (typeof command !== 'string' || !seen.has(command)) {
      return bad('proven lists a command that is not in this report: ' + JSON.stringify(command).slice(0, 80))
    }
    const note = typeof (p as { note?: unknown }).note === 'string' ? String((p as { note: string }).note).trim().slice(0, 300) : ''
    proven.push({ command, note: note || null })
  }

  // the last report for this machine
  const { data: prior, error: priorErr } = await supabase
    .from('intent_bridge_reports')
    .select('id, machine, bridge_build, revit_version, commands, first_reported_at, reported_at')
    .eq('machine', machine)
    .order('reported_at', { ascending: false })
    .limit(1)
  if (priorErr) return NextResponse.json({ error: priorErr.message }, { status: 500 })
  const last = ((prior || []) as BridgeReport[])[0] || null
  const before = last ? commandNames(last) : []
  const now = commands.map((c) => c.name)
  const added = last ? now.filter((n) => !before.includes(n)) : []
  const removed = before.filter((n) => !now.includes(n))
  const same = !!last && last.bridge_build === build && added.length === 0 && removed.length === 0
  const at = new Date().toISOString()

  if (same) {
    const { error } = await supabase.from('intent_bridge_reports').update({ reported_at: at, revit_version: revit ?? last!.revit_version }).eq('id', last!.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('intent_bridge_reports')
      .insert({ machine, bridge_build: build, revit_version: revit, commands, reported_by: 'blueprint', first_reported_at: at, reported_at: at })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let provenAdded = 0
  if (proven.length) {
    const { data: have } = await supabase.from('intent_bridge_proven').select('command')
    const known = new Set(((have || []) as { command: string }[]).map((x) => x.command))
    for (const p of proven) {
      if (known.has(p.command)) continue // the first proof stands; it is not overwritten
      const { error } = await supabase.from('intent_bridge_proven').insert({ command: p.command, machine, bridge_build: build, note: p.note, proven_at: at })
      if (!error) provenAdded++
    }
  }

  return NextResponse.json({
    ok: true,
    machine,
    bridge_build: build,
    new_build: !last || last.bridge_build !== build,
    previous_build: last && last.bridge_build !== build ? last.bridge_build : null,
    added,
    removed,
    proven_added: provenAdded,
  })
}
