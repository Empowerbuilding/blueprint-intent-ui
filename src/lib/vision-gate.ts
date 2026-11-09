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

export async function runVisionGate(opts: {
  imageUrl: string
  mediaType: string
  outlineType: string
  roomName: string
  decisions: { topic: string; value: string }[]
}): Promise<VisionCheck> {
  const ranAt = new Date().toISOString()

  if (!opts.decisions.length) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'skipped', skipped: 'no active decisions for this room (nothing to verify)' }
  }

  const imgRes = await fetch(opts.imageUrl)
  if (!imgRes.ok) {
    return { ran_at: ranAt, model: 'glm-4.6v', status: 'error', error: `could not load outline image (HTTP ${imgRes.status})` }
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const b64 = buf.toString('base64')

  const typeLabel = TYPE_LABEL[opts.outlineType] || `2D ${opts.outlineType} drawing`
  const decisionLines = opts.decisions.map((d) => `- ${d.topic}: ${d.value}`).join('\n')

  const prompt = `You are checking a ${typeLabel} for the "${opts.roomName}" of a custom home against CONFIRMED design decisions.

DECISIONS:
${decisionLines}

For EACH decision, judge only what this drawing type can show:
- "confirmed" — the drawing visibly reflects the decision
- "missing" — the decision is not visible in this drawing (may belong to another view — that is still "missing" here)
- "conflict" — the drawing contradicts the decision

Return ONLY valid JSON, no markdown fences, no commentary:
{"results": [{"topic": "<the topic exactly as given>", "verdict": "confirmed|missing|conflict", "note": "<one short sentence of evidence>"}]}`

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
  const results: VisionVerdict[] = parsed.results
    .filter((r) => r && typeof r.topic === 'string')
    .map((r) => ({
      topic: String(r.topic),
      verdict: (allowed.includes(String(r.verdict)) ? String(r.verdict) : 'na') as VisionVerdict['verdict'],
      note: r.note ? String(r.note).slice(0, 200) : undefined,
    }))

  return { ran_at: ranAt, model: 'glm-4.6v', status: 'ok', results }
}
