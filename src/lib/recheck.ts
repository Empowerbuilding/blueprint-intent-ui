// When the rulebook changes, drawings that are still AWAITING REVIEW are measured again against the
// new rules, so nobody reviews a result from an older rulebook. Approved drawings are never rewritten
// (the approval was given against the rulebook shown on the card); they are only measured, under the
// rulebook before this change and after it, and the ones that fail BECAUSE of this change are reported.
import { runMathGate, type Geometry, type MathCheck, type RuleRow } from '@/lib/rules'

// the two Supabase clients (user session, service role) have different generics; only .from() is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

export type RecheckLine = {
  outline_id: string
  project: string
  room: string
  outline_type: string
  label: string | null
  now: 'fails' | 'passes' | 'nothing measured'
  failing: string[]
}
export type RecheckSummary = {
  rulebookVersion: number | null
  rechecked: number
  changed: RecheckLine[]
  approvedNowFailing: RecheckLine[]
}

const failingKeys = (m: Partial<MathCheck> | null | undefined) =>
  (m?.results || [])
    .filter((r) => r.status === 'fail')
    .map((r) => r.rule_key)
    .sort()

type OutlineRow = {
  id: string
  project_id: string
  room_id: string
  outline_type: string
  label: string | null
  status: string
  geometry: Geometry | null
  checks: Record<string, unknown> | null
}

export async function recheckAfterRuleChange(client: AnyClient): Promise<RecheckSummary> {
  const [{ data: ruleRows }, { data: latest }, { data: outlineRows }] = await Promise.all([
    client.from('intent_rules').select('*').eq('active', true),
    client.from('intent_rulebook_versions').select('version, snapshot').order('version', { ascending: false }).limit(2),
    client
      .from('intent_outlines')
      .select('id, project_id, room_id, outline_type, label, status, geometry, checks')
      .in('status', ['pushed', 'approved']),
  ])
  const version: number | null = latest?.[0]?.version ?? null
  const out: RecheckSummary = { rulebookVersion: version, rechecked: 0, changed: [], approvedNowFailing: [] }
  const outlines = (outlineRows || []) as OutlineRow[]
  if (!outlines.length) return out
  // the rulebook as it was before this change (every change stores a snapshot of the active rules)
  const previous: RuleRow[] | null = Array.isArray(latest?.[1]?.snapshot)
    ? (latest[1].snapshot as Record<string, unknown>[]).map((r) => ({ ...r, active: true }) as unknown as RuleRow)
    : null

  const [{ data: rooms }, { data: projects }] = await Promise.all([
    client.from('intent_rooms').select('id, name, section_code').in('id', [...new Set(outlines.map((o) => o.room_id))]),
    client.from('intent_projects').select('id, name').in('id', [...new Set(outlines.map((o) => o.project_id))]),
  ])
  const roomById = new Map(((rooms || []) as { id: string; name: string; section_code: string }[]).map((r) => [r.id, r]))
  const projectName = new Map(((projects || []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))

  for (const o of outlines) {
    const room = roomById.get(o.room_id)
    if (!room) continue
    const math = runMathGate(
      (ruleRows || []) as unknown as RuleRow[],
      { name: room.name, section_code: room.section_code },
      o.outline_type,
      (o.geometry || {}) as Geometry,
      version,
    )
    const before = failingKeys(o.checks?.math as Partial<MathCheck> | undefined)
    const after = failingKeys(math)
    const line: RecheckLine = {
      outline_id: o.id,
      project: projectName.get(o.project_id) || 'project',
      room: room.section_code + ' ' + room.name,
      outline_type: o.outline_type,
      label: o.label,
      now: after.length ? 'fails' : math.passed === true ? 'passes' : 'nothing measured',
      failing: after,
    }

    if (o.status === 'pushed') {
      // read the checks again right before writing, so a decision check that landed meanwhile is kept
      const { data: fresh } = await client.from('intent_outlines').select('checks, status').eq('id', o.id).single()
      if (!fresh || fresh.status !== 'pushed') continue
      const { error } = await client
        .from('intent_outlines')
        .update({ checks: { ...((fresh.checks as Record<string, unknown>) || {}), math } })
        .eq('id', o.id)
        .eq('status', 'pushed')
      if (error) continue
      out.rechecked++
      if (JSON.stringify(before) !== JSON.stringify(after)) out.changed.push(line)
    } else {
      // approved: what did it fail under the rulebook before this change?
      const was = previous
        ? failingKeys(runMathGate(previous, { name: room.name, section_code: room.section_code }, o.outline_type, (o.geometry || {}) as Geometry, null))
        : before
      if (after.some((k) => !was.includes(k))) out.approvedNowFailing.push({ ...line, failing: after.filter((k) => !was.includes(k)) })
    }
  }
  return out
}

/** the message Blueprint gets when the rulebook changes */
export function ruleChangeMessage(what: string, by: string | null, s: RecheckSummary): string {
  const row = (l: RecheckLine) =>
    '- ' + l.project + ' · ' + l.room + ' (' + l.outline_type + (l.label ? ' "' + l.label + '"' : '') + '): now ' + l.now +
    (l.failing.length ? ' — ' + l.failing.join(', ') : '')
  const lines = [
    '📏 **Rulebook changed → v' + (s.rulebookVersion ?? '?') + '.** ' + what + (by ? ' by ' + by : '') + '.',
    s.rechecked
      ? 'Re-checked ' + s.rechecked + ' drawing' + (s.rechecked === 1 ? '' : 's') + ' awaiting review; ' +
        (s.changed.length ? s.changed.length + ' changed result:' : 'no result changed.')
      : 'No drawings were awaiting review.',
    ...s.changed.map(row),
  ]
  if (s.approvedNowFailing.length) {
    lines.push('Approved drawings that would fail the new rulebook (left approved, not rewritten):', ...s.approvedNowFailing.map(row))
  }
  lines.push('Sync the local rule mirror: python3 automation/intent_client.py rules --write. This is a notice, not a go.')
  return lines.join('\n')
}
