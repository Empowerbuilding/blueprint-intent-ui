// Math gate — executes the Michael-editable rulebook (intent_rules) against
// outline geometry. Pure dumb math, no LLM: Michael's orthographic process
// (11/7 juanito-blueprint thread) — clearance/position checks belong to code,
// vision is only for vibes.
//
// GEOMETRY CONTRACT (Blueprint pushes this alongside the outline image):
// {
//   "units": "in",
//   "extent": { "w": 240, "h": 180 },            // drawn extent in inches
//   "elements": [
//     { "id": "island1", "kind": "island", "label": "Island",
//       "x": 40, "y": 60, "w": 96, "h": 48 }
//   ]
// }
//   plan:              x-right, y-DOWN from top-left (image coords), inches
//   elevation/section: x-right, y-UP from floor (y = height above finished floor)
//
// Element kinds are a vocabulary, not an enum — rules match by kind string.
// Common: counter island appliance fridge range sink dishwasher walkway door
// window wall closet_rod closet_shelf upper_cabinet base_cabinet tall_cabinet
// soffit beam column bed vanity toilet shower tub table seating blind_corner

export type RuleRow = {
  id: string
  rule_key: string
  description: string | null
  rule_type: string
  params: Record<string, unknown> | null
  applies_to: Record<string, unknown> | null
  active: boolean
}

export type GeoElement = {
  id?: string
  kind: string
  label?: string
  x: number
  y: number
  w: number
  h: number
}

export type Geometry = {
  units?: string
  extent?: { w?: number; h?: number }
  elements?: GeoElement[]
}

export type RuleResult = {
  rule_key: string
  description: string
  status: 'pass' | 'fail' | 'na'
  measured?: string
  required?: string
  detail?: string
}

export type MathCheck = {
  ran_at: string
  rulebook_version: number | null
  passed: boolean
  results: RuleResult[]
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []

// ---- rect helpers (axis-aligned, inches) ----
function gapBetween(a: GeoElement, b: GeoElement): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)))
  return Math.hypot(dx, dy)
}
function overlaps(a: GeoElement, b: GeoElement): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w &&
    a.y < b.y + b.h && b.y < a.y + a.h
  )
}

function ruleAppliesToRoom(rule: RuleRow, room: { name: string; section_code: string }): boolean {
  const at = rule.applies_to || {}
  const names = strArr(at.room_names)
  const codes = strArr(at.section_codes)
  if (!names.length && !codes.length) return true
  const nameHit =
    names.includes('*') ||
    names.some((n) => n.toLowerCase() === room.name.toLowerCase())
  const codeHit = codes.includes(room.section_code)
  return nameHit || codeHit
}

function ruleAppliesToOutlineType(rule: RuleRow, outlineType: string): boolean {
  const at = rule.applies_to || {}
  const types = strArr(at.outline_types)
  return !types.length || types.includes(outlineType)
}

const fmt = (n: number) => `${Math.round(n * 10) / 10}"`

export function runMathGate(
  rules: RuleRow[],
  room: { name: string; section_code: string },
  outlineType: string,
  geometry: Geometry | null,
  rulebookVersion: number | null
): MathCheck {
  const ranAt = new Date().toISOString()
  const elements = (geometry?.elements || []).filter(
    (e) => e && typeof e.kind === 'string' && num(e.x) != null && num(e.y) != null && num(e.w) != null && num(e.h) != null
  ) as GeoElement[]

  const results: RuleResult[] = []

  // Empty geometry is a hard fail, not a vacuous pass — an outline with no
  // valid elements has nothing to check and must be redrawn.
  if (elements.length === 0) {
    results.push({
      rule_key: 'geometry',
      description: 'Outline geometry has no valid elements',
      status: 'fail',
      detail: 'nothing drawn — push geometry with elements (kind, x, y, w, h in inches)',
    })
  }

  for (const rule of rules) {
    if (!rule.active) continue
    if (!ruleAppliesToRoom(rule, room) || !ruleAppliesToOutlineType(rule, outlineType)) {
      continue
    }
    const p = rule.params || {}
    const desc = rule.description || rule.rule_key

    if (!elements.length) {
      results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'no geometry elements pushed' })
      continue
    }

    switch (rule.rule_type) {
      case 'min_clearance': {
        // between semantics:
        //   flat string array  ["a","b","c"]            → all pairs among these kinds
        //   nested             [["a"],["b","c"]]         → primary kinds × reference kinds only
        //     (nested is what you want when one thing is checked AGAINST a run of others —
        //      e.g. island vs [counter, fridge, range]: the counter run itself may contain
        //      the fridge, and that adjacency is fine, only the island's clearance matters)
        const rawBetween = Array.isArray(p.between) ? p.between : []
        const isNested = rawBetween.some((e) => Array.isArray(e))
        const flat = (arr: unknown[]) => arr.filter((s): s is string => typeof s === 'string')
        let primaryKinds: string[]
        let referenceKinds: string[]
        if (isNested) {
          primaryKinds = flat(rawBetween[0] as unknown[])
          referenceKinds = rawBetween.slice(1).flatMap((g) => flat(Array.isArray(g) ? (g as unknown[]) : [g]))
        } else {
          primaryKinds = flat(rawBetween)
          referenceKinds = primaryKinds
        }
        const minIn = num(p.min_in)
        if (!primaryKinds.length || !referenceKinds.length || minIn == null) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'rule params incomplete' })
          break
        }
        const primaries = elements.filter((e) => primaryKinds.includes(e.kind))
        const references = elements.filter((e) => referenceKinds.includes(e.kind))
        let minGap = Infinity
        let pair = ''
        for (const a of primaries) {
          for (const b of references) {
            if (a === b) continue
            const g = gapBetween(a, b)
            if (g < minGap) {
              minGap = g
              pair = `${a.label || a.kind} ↔ ${b.label || b.kind}`
            }
          }
        }
        if (primaries.length < 1 || references.length < 1 || (primaries.length + references.length < 2 && !isNested)) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: `needs elements of kinds [${[...primaryKinds, ...referenceKinds].join(', ')}]` })
        } else if (minGap >= minIn) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'pass', measured: fmt(minGap), required: `≥ ${fmt(minIn)}`, detail: pair })
        } else {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'fail', measured: fmt(minGap), required: `≥ ${fmt(minIn)}`, detail: pair })
        }
        break
      }

      case 'min_dimension':
      case 'max_dimension': {
        const kind = typeof p.kind === 'string' ? p.kind : ''
        const limit = num(p.min_in ?? p.max_in)
        const axis = (typeof p.axis === 'string' ? p.axis : 'min') as 'min' | 'w' | 'h'
        if (!kind || limit == null) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'rule params incomplete' })
          break
        }
        const pool = elements.filter((e) => e.kind === kind)
        if (!pool.length) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: `no "${kind}" elements in this outline` })
          break
        }
        const dims = pool.map((e) => ({
          e,
          d: axis === 'w' ? e.w : axis === 'h' ? e.h : Math.min(e.w, e.h),
        }))
        const worst = dims.reduce((a, b) => (a.d < b.d ? a : b))
        const ok = rule.rule_type === 'min_dimension' ? worst.d >= limit : worst.d <= limit
        results.push({
          rule_key: rule.rule_key,
          description: desc,
          status: ok ? 'pass' : 'fail',
          measured: fmt(worst.d),
          required: rule.rule_type === 'min_dimension' ? `≥ ${fmt(limit)}` : `≤ ${fmt(limit)}`,
          detail: `${worst.e.label || worst.e.id || worst.e.kind} (${axis === 'min' ? 'min(w,h)' : axis})`,
        })
        break
      }

      case 'no_overlap': {
        const between = strArr(p.between)
        if (!between.length) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'rule params incomplete' })
          break
        }
        const pool = elements.filter((e) => between.includes(e.kind))
        let bad: string | null = null
        outer: for (let i = 0; i < pool.length; i++) {
          for (let j = i + 1; j < pool.length; j++) {
            if (overlaps(pool[i]!, pool[j]!)) {
              bad = `${pool[i]!.label || pool[i]!.kind} overlaps ${pool[j]!.label || pool[j]!.kind}`
              break outer
            }
          }
        }
        results.push({
          rule_key: rule.rule_key,
          description: desc,
          status: bad ? 'fail' : pool.length < 2 ? 'na' : 'pass',
          detail: bad || (pool.length < 2 ? `needs ≥2 elements of kinds [${between.join(', ')}]` : 'no overlaps'),
        })
        break
      }

      case 'forbidden_kind':
      case 'required_kind': {
        const kind = typeof p.kind === 'string' ? p.kind : ''
        if (!kind) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'rule params incomplete' })
          break
        }
        const count = elements.filter((e) => e.kind === kind).length
        if (rule.rule_type === 'forbidden_kind') {
          const max = num(p.max_count) ?? 0
          results.push({
            rule_key: rule.rule_key,
            description: desc,
            status: count > max ? 'fail' : 'pass',
            measured: `${count}`,
            required: `≤ ${max}`,
            detail: `"${kind}" elements`,
          })
        } else {
          const min = num(p.min_count) ?? 1
          results.push({
            rule_key: rule.rule_key,
            description: desc,
            status: count < min ? 'fail' : 'pass',
            measured: `${count}`,
            required: `≥ ${min}`,
            detail: `"${kind}" elements`,
          })
        }
        break
      }

      case 'elevation_bottom_height': {
        const kind = typeof p.kind === 'string' ? p.kind : ''
        const aff = num(p.aff)
        const tol = num(p.tolerance) ?? 1
        if (!kind || aff == null) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: 'rule params incomplete' })
          break
        }
        const pool = elements.filter((e) => e.kind === kind)
        if (!pool.length) {
          results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: `no "${kind}" elements in this outline` })
          break
        }
        // elevation convention: y = bottom edge height above finished floor (y-up)
        const worst = pool.reduce((a, b) => (Math.abs(a.y - aff) > Math.abs(b.y - aff) ? a : b))
        const ok = Math.abs(worst.y - aff) <= tol
        results.push({
          rule_key: rule.rule_key,
          description: desc,
          status: ok ? 'pass' : 'fail',
          measured: `bottom @ ${fmt(worst.y)} AFF`,
          required: `${fmt(aff)} ± ${fmt(tol)}`,
          detail: `${worst.label || worst.id || worst.kind}`,
        })
        break
      }

      default:
        results.push({ rule_key: rule.rule_key, description: desc, status: 'na', detail: `unknown rule_type "${rule.rule_type}"` })
    }
  }

  // A gate that measured nothing is not a pass: no fails AND at least one rule
  // actually evaluated (empty/na-only outlines must not pass vacuously).
  const passed =
    results.every((r) => r.status !== 'fail') && results.some((r) => r.status === 'pass')

  return {
    ran_at: ranAt,
    rulebook_version: rulebookVersion,
    passed,
    results,
  }
}
