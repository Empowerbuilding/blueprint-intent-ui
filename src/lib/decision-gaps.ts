// Decision-gap audit (pilot review 2026-11-14, item 2 — Mitch asked three times).
// Flags rooms where EVIDENCE exists (inspiration pictures with analyzed layout details,
// redline notes) but no decision line covers it. Tonight this exact gap shipped a contract
// missing the Bath 3 vanity (inspo said "double vanity against back wall"; no line existed).
// Evidence suggests; only a person decides — but the app ASKS at board time instead of
// surprising everyone after the 2D is drawn.
import type { SupabaseClient } from '@supabase/supabase-js'

export type DecisionGap = {
  roomId: string
  sectionCode: string
  name: string
  noDecisions: boolean
  missingPieces: string[]
}

const PIECE_NOUNS = [
  'vanity', 'shower', 'tub', 'toilet', 'sink', 'cabinet', 'counter',
  'island', 'shelf', 'shelving', 'bench', 'bar', 'pantry', 'desk',
  'wardrobe', 'washer', 'dryer', 'fireplace', 'fire pit', 'sauna',
]

function nounsIn(text: string): Set<string> {
  const t = String(text || '').toLowerCase()
  const hits = new Set<string>()
  for (const n of PIECE_NOUNS) if (t.includes(n)) hits.add(n)
  return hits
}

type SB = Pick<SupabaseClient, 'from'>

// #28 - decision freshness: active transcript-sourced lines whose meeting_date
// predates the project's latest meeting. They stand only because no newer
// meeting re-mentioned them (silent drift between meetings; the Master Bath
// 12x12-window class). Read-only: flags, never blocks.
export type Freshness = {
  latestMeeting: string | null
  staleByRoom: Map<string, number> // room_id -> stale count; '' = house/global
  totalStale: number
}

export async function decisionFreshness(supabase: SB, projectId: string): Promise<Freshness> {
  const { data } = await supabase
    .from('intent_decisions')
    .select('room_id, meeting_date')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .not('meeting_date', 'is', null)
    .eq('source', 'transcript')
  const rows = (data || []) as { room_id: string | null; meeting_date: string | null }[]
  const dates = rows.map((r) => r.meeting_date).filter((d): d is string => !!d)
  if (!dates.length) return { latestMeeting: null, staleByRoom: new Map(), totalStale: 0 }
  const latestMeeting = dates.reduce((a, b) => (a > b ? a : b))
  const staleByRoom = new Map<string, number>()
  let totalStale = 0
  for (const r of rows) {
    if (r.meeting_date && r.meeting_date < latestMeeting) {
      const key = r.room_id || ''
      staleByRoom.set(key, (staleByRoom.get(key) || 0) + 1)
      totalStale++
    }
  }
  return { latestMeeting, staleByRoom, totalStale }
}

export async function decisionGaps(
  supabase: SB,
  projectId: string,
  rooms: { id: string; section_code: string; name: string }[]
): Promise<DecisionGap[]> {
  const [{ data: decisionRows }, { data: inspoRows }, { data: noteRows }] = await Promise.all([
    supabase.from('intent_decisions').select('room_id, topic, value').eq('project_id', projectId).eq('status', 'active'),
    supabase.from('intent_inspo_images').select('room_id, layout_details').eq('project_id', projectId).not('room_id', 'is', null),
    supabase.from('intent_redline_notes').select('room_id, text').eq('project_id', projectId).not('room_id', 'is', null),
  ])
  const covered = new Map<string, Set<string>>()
  const decisionCount = new Map<string, number>()
  for (const d of (decisionRows || []) as { room_id: string | null; topic: string | null; value: string | null }[]) {
    if (!d.room_id) continue
    decisionCount.set(d.room_id, (decisionCount.get(d.room_id) || 0) + 1)
    const set = covered.get(d.room_id) || new Set<string>()
    for (const n of nounsIn(String(d.topic || '') + ' ' + String(d.value || ''))) set.add(n)
    covered.set(d.room_id, set)
  }
  const evidence = new Map<string, Set<string>>()
  for (const i of (inspoRows || []) as { room_id: string | null; layout_details: unknown }[]) {
    if (!i.room_id) continue
    const set = evidence.get(i.room_id) || new Set<string>()
    const details = Array.isArray(i.layout_details) ? i.layout_details.join(' ') : String(i.layout_details || '')
    for (const n of nounsIn(details)) set.add(n)
    evidence.set(i.room_id, set)
  }
  for (const n of (noteRows || []) as { room_id: string | null; text: string | null }[]) {
    if (!n.room_id) continue
    const set = evidence.get(n.room_id) || new Set<string>()
    for (const x of nounsIn(String(n.text || ''))) set.add(x)
    evidence.set(n.room_id, set)
  }
  const gaps: DecisionGap[] = []
  for (const r of rooms) {
    const dec = decisionCount.get(r.id) || 0
    const ev = evidence.get(r.id)
    const cov = covered.get(r.id) || new Set<string>()
    if (!ev || ev.size === 0) continue
    if (dec === 0) {
      gaps.push({ roomId: r.id, sectionCode: String(r.section_code), name: r.name, noDecisions: true, missingPieces: [...ev].sort() })
      continue
    }
    const missing = [...ev].filter((n) => !cov.has(n))
    if (missing.length > 0) {
      gaps.push({ roomId: r.id, sectionCode: String(r.section_code), name: r.name, noDecisions: false, missingPieces: missing.sort() })
    }
  }
  return gaps.sort((a, b) => Number(b.noDecisions) - Number(a.noDecisions) || a.sectionCode.localeCompare(b.sectionCode))
}
