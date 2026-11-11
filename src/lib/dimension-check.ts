// Code-only comparison of decided sizes with the pushed geometry. No imports on purpose: it is unit-tested
// directly (scripts/test-libs.mjs) and used by the decision check (vision-gate.ts).

export type VisionVerdict = {
  topic: string
  verdict: 'confirmed' | 'missing' | 'conflict' | 'na'
  note?: string
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
  elements: { kind: string; label?: string; w?: number; h?: number }[],
  outlineType: string = 'plan'
): { verdicts: VisionVerdict[]; remaining: { topic: string; value: string }[] } {
  // A decision like "84 x 42 island" is a PLAN size (length x depth). An elevation or section draws
  // width x HEIGHT, so the pair cannot be compared there: a correct island cut in section is 42 x 36.
  const isPlan = outlineType === 'plan'
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
    } else if (!isPlan) {
      // not a plan: the drawn WIDTH can still be one side of the plan size. Anything else is left to the
      // plan drawing — it is never a conflict here.
      const side = matches.find(
        (e) => typeof e.w === 'number' && (Math.abs(e.w - dims[0]) <= tol || Math.abs(e.w - dims[1]) <= tol)
      )
      const drawn = matches
        .filter((e) => typeof e.w === 'number' && typeof e.h === 'number')
        .map((e) => `${e.w} wide x ${e.h} high`)
        .join(', ')
      verdicts.push(
        side
          ? {
              topic: d.topic,
              verdict: 'confirmed',
              note: `geometry check: drawn ${kind} is ${side.w} wide, one side of the decided ${dims[0]}x${dims[1]} (this ${outlineType} shows width and height; the plan size is checked on the plan)`,
            }
          : {
              topic: d.topic,
              verdict: 'missing',
              note: `the plan size ${dims[0]}x${dims[1]} is checked on the plan drawing; this ${outlineType} shows width and height (drawn ${kind}: ${drawn || 'no size'})`,
            }
      )
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
