// Slot-matched accepted exceptions: a person's ruling that one failed check is accepted for a
// drawing SLOT (room + outline type + label). Survives re-pushes of the slot, unlike an
// outline-id-keyed ruling. Consulted by the push route (math) and the vision gate; the compiler
// reads them via GET /api/check-exceptions (Blueprint's rulings.json is the id-exact interim form).
import type { SupabaseClient } from '@supabase/supabase-js'

export type SlotException = { check_key: string; ruled_by: string; ruled_at: string; quote: string; measured?: string }

export async function fetchSlotExceptions(
  client: Pick<SupabaseClient, 'from'>,
  slot: { projectId: string; roomId: string; outlineType: string; label: string }
): Promise<Map<string, SlotException>> {
  const { data } = await client
    .from('intent_check_exceptions')
    .select('check_key, ruled_by, ruled_at, quote, measured')
    .eq('project_id', slot.projectId)
    .eq('room_id', slot.roomId)
    .eq('outline_type', slot.outlineType)
    .eq('label', slot.label)
    .eq('active', true)
  return new Map((data || []).map((e: SlotException) => [e.check_key, e]))
}

/** annotate math fails: status stays 'fail' (the record), an `exception` field says who accepted it */
export function annotateMath(results: { rule_key: string; status: string; exception?: unknown }[], exc: Map<string, SlotException>): number {
  let n = 0
  for (const r of results) {
    if (r.status !== 'fail') continue
    const e = exc.get('math:' + r.rule_key)
    if (e) { r.exception = e; n++ }
  }
  return n
}

/** annotate vision conflicts the same way */
export function annotateVision(results: { verdict?: string; exception?: unknown }[], exc: Map<string, SlotException>): number {
  let n = 0
  for (const r of results) {
    if (r.verdict !== 'conflict') continue
    const e = exc.get('vision')
    if (e) { r.exception = e; n++ }
  }
  return n
}

/** same drawing, different meta: elements identical (order-insensitive), ignoring geometry.meta
 *  (version stamp + view metadata change between contract versions by design).
 *  VALUE compare, not text: Postgres jsonb reorders object keys on storage (by length, then
 *  bytewise), so a stored row never stringifies like the sender's draft. Both sides are
 *  canonicalized — every object's keys sorted recursively — before stringifying. Numbers
 *  normalize through JS parse (6.0 === 6). The Whitaker Foyer carry-over failure (2026-11-14
 *  23:41Z) was exactly this: value-equal drawings comparing unequal on key order. */
export function sameElements(a: unknown, b: unknown): boolean {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon)
    if (v && typeof v === 'object') {
      const src = v as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(src).sort()) out[k] = canon(src[k])
      return out
    }
    return v
  }
  const norm = (g: unknown) => {
    const els = (Array.isArray((g as { elements?: unknown[] })?.elements) ? (g as { elements: unknown[] }).elements : []) as { id?: unknown }[]
    return JSON.stringify(canon([...els].sort((x, y) => String(x?.id ?? '').localeCompare(String(y?.id ?? '')))))
  }
  return norm(a) === norm(b)
}
