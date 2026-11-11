// CAPABILITIES — what the Revit bridge on each machine can do (reported by Blueprint from the bridge's
// own command list), which commands have been proven live, and the gap log.

export type BridgeCommand = { name: string; description?: string | null }
export type BridgeReport = {
  id: string
  machine: string
  bridge_build: string
  revit_version: string | null
  commands: BridgeCommand[]
  first_reported_at: string
  reported_at: string
}
export type Proven = { command: string; machine: string | null; bridge_build: string | null; note: string | null; proven_at: string }
export type Gap = {
  id: string
  status: 'open' | 'closed'
  title: string
  detail: string
  workaround: string | null
  project_name: string | null
  source_ref: string | null
  proposed_by: string
  created_at: string
  closed_by_email: string | null
  closed_at: string | null
  close_note: string | null
}

export const MACHINE_RE = /^[a-z0-9][a-z0-9_-]{0,30}$/
export const COMMAND_RE = /^[a-z][a-z0-9_.]{1,80}$/
export const GAP_COLUMNS =
  'id, status, title, detail, workaround, project_name, source_ref, proposed_by, created_at, closed_by_email, closed_at, close_note'

export const machineLabel = (m: string) => m.charAt(0).toUpperCase() + m.slice(1)
/** whole days since an instant */
export const daysSince = (iso: string, now = Date.now()) => (now - Date.parse(iso)) / 86400000
export const commandNames = (r: Pick<BridgeReport, 'commands'>) =>
  (Array.isArray(r.commands) ? r.commands : []).map((c) => c.name).filter((n): n is string => typeof n === 'string')

/** "revit.create_wall" -> group "create", short "create_wall" */
export function splitCommand(name: string): { group: string; short: string } {
  const short = name.replace(/^revit\./, '')
  return { group: short.split('_')[0] || 'other', short }
}

export type MachineState = { latest: BridgeReport; previousBuild: string | null }

/** newest report per machine, plus the build it had before */
export function latestPerMachine(reports: BridgeReport[]): MachineState[] {
  const byMachine = new Map<string, BridgeReport[]>()
  for (const r of [...reports].sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1))) {
    byMachine.set(r.machine, [...(byMachine.get(r.machine) || []), r])
  }
  return [...byMachine.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, list]) => ({ latest: list[0], previousBuild: list.find((x) => x.bridge_build !== list[0].bridge_build)?.bridge_build || null }))
}

export type CommandRow = { name: string; short: string; description: string | null; on: string[]; missingOn: string[]; proven: Proven | null }

/** every command any machine has, with which machines have it and whether it has been proven live */
export function commandTable(machines: MachineState[], proven: Proven[]): Map<string, CommandRow[]> {
  const all = machines.map((m) => m.latest.machine)
  const provenBy = new Map(proven.map((p) => [p.command, p]))
  const rows = new Map<string, CommandRow>()
  for (const m of machines) {
    for (const c of Array.isArray(m.latest.commands) ? m.latest.commands : []) {
      if (!c || typeof c.name !== 'string') continue
      const row = rows.get(c.name) || { name: c.name, short: splitCommand(c.name).short, description: c.description || null, on: [], missingOn: [], proven: provenBy.get(c.name) || null }
      row.on.push(m.latest.machine)
      if (!row.description && c.description) row.description = c.description
      rows.set(c.name, row)
    }
  }
  const groups = new Map<string, CommandRow[]>()
  for (const row of [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    row.missingOn = all.filter((m) => !row.on.includes(m))
    const g = splitCommand(row.name).group
    groups.set(g, [...(groups.get(g) || []), row])
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

// the two Supabase clients (user session, service role) have different generics; only .from() is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

export async function loadCapabilities(client: AnyClient): Promise<{ reports: BridgeReport[]; proven: Proven[]; gaps: Gap[] }> {
  const [{ data: reports }, { data: proven }, { data: gaps }] = await Promise.all([
    client
      .from('intent_bridge_reports')
      .select('id, machine, bridge_build, revit_version, commands, first_reported_at, reported_at')
      .order('reported_at', { ascending: false })
      .limit(60),
    client.from('intent_bridge_proven').select('command, machine, bridge_build, note, proven_at').order('command'),
    client.from('intent_gaps').select(GAP_COLUMNS).order('created_at', { ascending: false }),
  ])
  return { reports: (reports || []) as BridgeReport[], proven: (proven || []) as Proven[], gaps: (gaps || []) as Gap[] }
}
