// Inspiration pictures: what the vision model says about one, tidied, and what a 2D drawing says it did with it.
// Mitch 2026-11-12 02:24Z (spec A97): the pictures attached to a room feed that room's 2D drawing, and so do the
// details a vision model reads out of them. Pure functions only: scripts/test-libs.mjs runs them.

/** how many layout details one picture carries at most, and how long one may be */
export const LAYOUT_DETAILS_MAX = 8
export const LAYOUT_DETAIL_CHARS = 120

export type InspoAnalysis = {
  description: string
  tags: string[]
  palette: string[]
  suggested_room: string
  /** short facts a floor plan can show: what is where, next to what. Never a colour, a material or a style word. */
  layout_details: string[]
}

export const ANALYSIS_PROMPT =
  'You are analyzing a design inspiration image for a custom home builder (modern steel-frame houses).\n' +
  'Look at the image and return ONLY valid JSON (no markdown fences, no commentary):\n' +
  '{"description": "one sentence describing the key design idea", "tags": ["max 6 short tags: materials, styles, elements"], "palette": ["#hex", "dominant colors, max 5"], ' +
  '"suggested_room": "<exactly one of: Kitchen, Great Room, Master Suite, Master Bath, Master Closet, Office, Butler Pantry, Mudroom, Laundry, Garage, ADU, Patio, Foyer, Bedroom, Bath, Bar, Other>", ' +
  '"layout_details": ["up to ' + LAYOUT_DETAILS_MAX + ' short facts a FLOOR PLAN could show: what is in the room and where it sits relative to the walls and to each other, for example: island with seating on one side; range on the back wall; double vanity; walk-in shower with a bench; tub under the window. ' +
  'Only what the picture actually shows. No colours, no materials, no finishes, no style words. An empty list when the picture shows nothing a plan can draw."]}'

/** a list of short texts: strings only, one line each, no doubles, at most LAYOUT_DETAILS_MAX */
export function tidyLayoutDetails(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of v) {
    if (typeof x !== 'string') continue
    const t = x.replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '').trim()
    if (!t) continue
    const short = t.length > LAYOUT_DETAIL_CHARS ? t.slice(0, LAYOUT_DETAIL_CHARS - 1).trimEnd() + '…' : t
    const k = short.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(short)
    if (out.length >= LAYOUT_DETAILS_MAX) break
  }
  return out
}

/** the model's answer -> the analysis, or null when it holds no JSON object */
export function parseAnalysis(text: string): InspoAnalysis | null {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const p = JSON.parse(m[0])
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null
    return {
      description: String(p.description || '').slice(0, 300),
      tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 6).map(String),
      palette: (Array.isArray(p.palette) ? p.palette : []).slice(0, 5).map(String),
      suggested_room: String(p.suggested_room || 'Other'),
      layout_details: tidyLayoutDetails(p.layout_details),
    }
  } catch {
    return null
  }
}

/** the tags of a picture after an analysis: what a person typed stays, the model's tags and colours are added once */
export function mergeTags(old: string[] | null | undefined, a: Pick<InspoAnalysis, 'tags' | 'palette'>): string[] {
  return [...new Set([...(old || []), ...a.tags, ...a.palette.map((c) => 'color:' + c)])]
}

// ---- what a drawing says it did with the pictures (geometry.meta.inspo, written by Blueprint's outline_draft.py) ----
export type InspoUsed = { picture: string | null; detail: string; element: string | null; source: 'app' | 'blueprint' }
export type InspoNotUsed = { picture: string | null; detail: string; reason: string }
export type InspoUse = {
  /** false = the drawing was made before pictures fed the drawings, or says nothing about them */
  said: boolean
  used: InspoUsed[]
  not_used: InspoNotUsed[]
}

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

export function inspoUse(geometry: unknown): InspoUse {
  const meta = geometry && typeof geometry === 'object' ? (geometry as Record<string, unknown>).meta : null
  const raw = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).inspo : null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { said: false, used: [], not_used: [] }
  const o = raw as Record<string, unknown>
  const rows = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && str((x as Record<string, unknown>).detail)) : []) as Record<string, unknown>[]
  return {
    said: true,
    used: rows(o.used).map((x) => ({ picture: str(x.picture) || null, detail: str(x.detail), element: str(x.element) || null, source: x.source === 'blueprint' ? 'blueprint' : 'app' })),
    not_used: rows(o.not_used).map((x) => ({ picture: str(x.picture) || null, detail: str(x.detail), reason: str(x.reason) || 'no reason given' })),
  }
}

/** one detail of one picture, as a drawing treated it. 'unsaid' = the drawing does not mention it. */
export function detailState(use: InspoUse, picture: string, detail: string): { state: 'used' | 'not_used' | 'unsaid'; reason: string | null } {
  const same = (a: string, b: string) => a.toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase()
  const hit = (r: { picture: string | null; detail: string }) => same(r.detail, detail) && (!r.picture || r.picture === picture)
  if (use.used.some(hit)) return { state: 'used', reason: null }
  const n = use.not_used.find(hit)
  if (n) return { state: 'not_used', reason: n.reason }
  return { state: 'unsaid', reason: null }
}
