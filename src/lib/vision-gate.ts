// Vision gate — GLM-4.6v reads a pushed 2D outline (zone map / elevation)
// against the room's confirmed decisions: confirmed / missing / conflict per
// decision. Vision is for what math can't see (did the decision make it into
// the drawing at all); clearance numbers stay in the math gate.

import { zaiVisionText, parseJsonLoose } from '@/lib/vision'

export type VisionVerdict = {
  topic: string
  verdict: 'confirmed' | 'missing' | 'conflict' | 'na'
  note?: string
}

export type VisionCheck = {
  ran_at: string
  model: string
  status: 'ok' | 'skipped' | 'error'
  results?: VisionVerdict[]
  error?: string
  skipped?: string
}

const TYPE_LABEL: Record<string, string> = {
  plan: '2D top-down zone map (color-blocked rectangles for counters, islands, walkways, appliances, cabinets — labeled by kind)',
  elevation: '2D elevation drawing (vertical view: wall, cabinets, windows, soffits — heights measured from the floor line)',
  section: '2D cross-section drawing (cut through the room showing vertical relationships)',
}

// ---- deterministic dimension cross-check ----
// Numbers are ground truth in the geometry JSON (it's what the math gate
// measures). LLMs echo decision text instead of reading pixels — so any
// decision whose dimensions parse and whose kind matches a geometry element
// is compared by CODE, never by the model.

const KIND_KEYWORDS: [RegExp, string][] = [
  [/island/i, 'island'],
  [/vanity/i, 'vanity'],
  [/range|stove|cooktop/i, 'range'],
  [/fridge|refrigerator/i, 'fridge'],
  [/sink|farmhouse/i, 'sink'],
  [/shower/i, 'shower'],
  [/tub|bath(?!room)/i, 'tub'],
  [/closet/i, 'closet_rod'],
  [/soffit/i, 'soffit'],
  [/fireplace/i, 'fireplace'],
  [/desk/i, 'desk'],
  [/table/i, 'table'],
]

function parseDims(text: string): [number, number] | null {
  const m = /\b(\d{1,3}(?:\.\d)?)\s*[xX×]\s*(\d{1,3}(?:\.\d)?)\b/.exec(text)
  if (!m) return null
  const a = parseFloat(m[1])
  const b = parseFloat(m[2])
  if (!a || !b || a < 6 || b < 6) return null // avoid "2x4 framing" style noise
  return a >= b ? [a, b] : [b, a]
}

function kindFromText(text: string): string | null {
  for (const [re, kind] of KIND_KEYWORDS) if (re.test(text)) return kind
  return null
}

export function deterministicDimensionCheck(
  decisions: { topic: string; value: string }[],
  elements: { kind: string; label?: string; w?: number; h?: number }[]
): { verdicts: VisionVerdict[]; remaining: { topic: string; value: string }[] } {
  const verdicts: VisionVerdict[] = []
  const remaining: { topic: string; value: string }[] = []

  for (const d of decisions) {
    const text = `${d.topic} ${d.value}`
    const dims = parseDims(text)
    const kind = kindFromText(text)
    if (!dims || !kind) {
      remaining.push(d)
      continue
    }
    // find geometry elements of that kind (or kind-prefix match for closet_rod etc.)
    const matches = (elements || []).filter(
      (e) => e.kind === kind || (kind === 'closet_rod' && (e.kind === 'closet_rod' || e.kind === 'closet_shelf'))
    )
    if (!matches.length) {
      remaining.push(d)
      continue
    }
    // compare against EVERY element of that kind — the drawn set must contain
    // at least one that matches the decision dimensions (within 1.5in)
    const tol = 1.5
    const hit = matches.some((e) => {
      if (typeof e.w !== 'number' || typeof e.h !== 'number') return false
      const drawn = e.w >= e.h ? [e.w, e.h] : [e.h, e.w]
      return Math.abs(drawn[0] - dims[0]) <= tol && Math.abs(drawn[1] - dims[1]) <= tol
    })
    if (hit) {
      verdicts.push({
        topic: d.topic,
        verdict: 'confirmed',
        note: `geometry check: drawn ${kind} matches ${dims[0]}x${dims[1]} (from pushed geometry, code-verified)`,
      })
    } else {
      const drawnList = matches
        .filter((e) => typeof e.w === 'number' && typeof e.h === 'number')
        .map((e) => `${Math.max(e.w!, e.h!)}x${Math.min(e.w!, e.h!)}`)
        .join(', ')
      verdicts.push({
        topic: d.topic,
        verdict: 'conflict',
        note: `geometry check: decision says ${dims[0]}x${dims[1]} but drawn ${kind} is ${drawnList || 'present with unparsed size'} (from pushed geometry, code-verified)`,
      })
    }
  }
  return { verdicts, remaining }
}

export async function runVisionGate(opts: {
  imageUrl: string
  mediaType: string
  outlineType: string
  roomName: string
  decisions: { topic: string; value: string }[]
  geometryElements?: { kind: string; label?: string; w?: number; h?: number }[]
}): Promise<VisionCheck> {
  const ranAt = new Date().toISOString()

  if (!opts.decisions.length) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'skipped', skipped: 'no active decisions for this room (nothing to verify)' }
  }

  // Dimensional decisions with parseable numbers + a matching geometry kind are
  // verified by CODE from the pushed geometry — the LLM never sees them (it
  // echoes decision text instead of reading pixels; verified live 11/10).
  const { verdicts: codeVerdicts, remaining } = deterministicDimensionCheck(
    opts.decisions,
    opts.geometryElements || []
  )

  // all decisions handled deterministically — no LLM call needed
  if (!remaining.length) {
    return { ran_at: ranAt, model: 'glm-4.6v+code', status: 'ok', results: codeVerdicts }
  }

  const imgRes = await fetch(opts.imageUrl)
  if (!imgRes.ok) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'error', error: `could not load outline image (HTTP ${imgRes.status})` }
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const b64 = buf.toString('base64')

  const typeLabel = TYPE_LABEL[opts.outlineType] || `2D ${opts.outlineType} drawing`
  const decisionLines = remaining.map((d) => `- ${d.topic}: ${d.value}`).join('\n')
  const geometryLines = (opts.geometryElements || [])
    .filter((e) => e.kind !== 'walkway' && e.kind !== 'wall')
    .map((e) => `- ${e.kind}${e.label ? ` "${e.label}"` : ''}${typeof e.w === 'number' && typeof e.h === 'number' ? ` — ${Math.max(e.w, e.h)}x${Math.min(e.w, e.h)}in` : ''}`)
    .join('\n')

  const prompt = `You are checking a ${typeLabel} for the "${opts.roomName}" of a custom home against CONFIRMED design decisions.

GROUND TRUTH RULE: numeric dimensions are already verified by code against the pushed geometry JSON (listed below) — you must NOT judge numbers, and you must NOT read numbers off the image. Your job is everything geometry can't express: presence, placement, orientation, adjacency, and overall fidelity to the decision's intent. If a decision's note-worthy evidence would be a number, cite the GEOMETRY list, never the image pixels.

PUSHED GEOMETRY (ground truth, code-verified):
${geometryLines || '(none)'}

DECISIONS still needing visual judgment:
${decisionLines}

Verdicts:
- "confirmed" — the drawing visibly reflects the decision (cite what you see: placement, orientation, adjacency)
- "conflict" — the drawing contradicts the decision (cite drawn vs decided)
- "missing" — not visible in this drawing (may belong to another view — still "missing" here)
- "na" — not something ANY drawing of this type could ever show: hardware, finishes/materials by name, colors, sheens, budgets, brand preferences, non-spatial requirements. Judge the TOPIC's spatialness, not the drawing.

Return ONLY valid JSON, no markdown fences, no commentary:
{"results": [{"topic": "<the topic exactly as given>", "verdict": "confirmed|missing|conflict|na", "note": "<one short sentence citing drawn evidence>"}]}`

  // max_tokens 4000: GLM-4.6v spends a large thinking block FIRST — with a small
  // budget it hits max_tokens inside thinking and never emits text (verified live:
  // stop_reason=max_tokens, blocks=[thinking] only)
  const text = await zaiVisionText(prompt, { b64, mediaType: opts.mediaType || 'image/png' }, 4000)
  if (!text) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'error', error: 'vision model returned nothing (key missing or API error)' }
  }

  const parsed = parseJsonLoose<{ results?: { topic?: string; verdict?: string; note?: string }[] }>(text)
  if (!parsed?.results || !Array.isArray(parsed.results)) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'error', error: 'could not parse vision model JSON' }
  }

  const allowed = ['confirmed', 'missing', 'conflict', 'na']
  const llmResults: VisionVerdict[] = parsed.results
    .filter((r) => r && typeof r.topic === 'string')
    .map((r) => ({
      topic: String(r.topic),
      verdict: (allowed.includes(String(r.verdict)) ? String(r.verdict) : 'na') as VisionVerdict['verdict'],
      note: r.note ? String(r.note).slice(0, 200) : undefined,
    }))

  return { ran_at: ranAt, model: 'glm-4.6v+code', status: 'ok', results: [...codeVerdicts, ...llmResults] }
}
