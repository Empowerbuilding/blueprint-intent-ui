// Plain-language view of a math-gate rule, and the mapping between the rule
// editor's form fields and the JSON the gate executes (src/lib/rules.ts).
//
// The stored shape does NOT change: params + applies_to stay exactly what the
// gate reads. This file only translates. Rules whose JSON does not fit the form
// (unknown keys, flat "between" lists) report fits=false and are edited as raw
// JSON instead, so nothing is silently rewritten.
//
// Pure: no imports, no I/O.

export type RuleLike = {
  rule_type: string
  params: Record<string, unknown> | null
  applies_to: Record<string, unknown> | null
}

export const RULE_TYPE_INFO: { value: string; label: string; says: string }[] = [
  { value: 'min_clearance', label: 'Clearance', says: 'Something must stay a minimum distance clear of other things' },
  { value: 'min_dimension', label: 'Minimum size', says: 'Something must be at least a certain size' },
  { value: 'max_dimension', label: 'Maximum size', says: 'Something must not exceed a certain size' },
  { value: 'elevation_bottom_height', label: 'Mounting height', says: 'The bottom edge of something sits at a set height above the floor' },
  { value: 'no_overlap', label: 'No overlap', says: 'Things must never overlap each other' },
  { value: 'forbidden_kind', label: 'Not allowed', says: 'Something must not appear (or only a limited number of times)' },
  { value: 'required_kind', label: 'Required', says: 'Something must appear at least a number of times' },
]

export const RULE_TYPE_VALUES = RULE_TYPE_INFO.map((t) => t.value)

// vocabulary the drawings use (free text is allowed; this feeds the suggestions list)
export const KNOWN_KINDS = [
  'counter', 'island', 'appliance', 'fridge', 'range', 'sink', 'dishwasher', 'walkway', 'door', 'window', 'wall',
  'closet_rod', 'closet_shelf', 'upper_cabinet', 'base_cabinet', 'tall_cabinet', 'soffit', 'beam', 'column', 'bed',
  'vanity', 'toilet', 'shower', 'tub', 'table', 'seating', 'blind_corner',
]

export const OUTLINE_TYPES = ['plan', 'elevation', 'section'] as const

const isStr = (v: unknown): v is string => typeof v === 'string'
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : [])
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const nice = (kind: string) => kind.replace(/_/g, ' ')

function list(items: string[], joiner: 'and' | 'or'): string {
  const xs = items.map(nice)
  if (xs.length === 0) return '(nothing)'
  if (xs.length === 1) return xs[0]!
  return xs.slice(0, -1).join(', ') + ' ' + joiner + ' ' + xs[xs.length - 1]
}

const inches = (n: number | null) => (n == null ? '?' : String(Math.round(n * 100) / 100)) + ' in'

const AXIS_TEXT: Record<string, string> = {
  min: 'on its narrowest side',
  w: 'wide',
  h: 'tall (deep, on a plan)',
}

// ---- scope ----

export type Scope = { allRooms: boolean; roomNames: string[]; sectionCodes: string[]; outlineTypes: string[] }

// mirrors ruleAppliesToRoom / ruleAppliesToOutlineType in src/lib/rules.ts
export function scopeOf(rule: RuleLike): Scope {
  const at = rule.applies_to || {}
  const names = strArr(at.room_names)
  const codes = strArr(at.section_codes)
  const types = strArr(at.outline_types)
  const allRooms = names.includes('*') || (names.length === 0 && codes.length === 0)
  return {
    allRooms,
    roomNames: names.filter((n) => n !== '*'),
    sectionCodes: codes,
    outlineTypes: types.length ? types : [...OUTLINE_TYPES],
  }
}

export function describeScope(rule: RuleLike): string {
  const s = scopeOf(rule)
  const rooms = s.allRooms
    ? 'All rooms'
    : [s.roomNames.join(', '), s.sectionCodes.length ? 'rooms numbered ' + s.sectionCodes.join(', ') : '']
        .filter(Boolean)
        .join(' + ')
  const all = OUTLINE_TYPES.every((t) => s.outlineTypes.includes(t))
  const types = all ? 'every drawing type' : s.outlineTypes.map((t) => t + 's').join(' and ')
  return rooms + ' · ' + types
}

// ---- sentence ----

export function describeRule(rule: RuleLike): string {
  const p = rule.params || {}
  switch (rule.rule_type) {
    case 'min_clearance': {
      const between = Array.isArray(p.between) ? p.between : []
      const nested = between.some((e) => Array.isArray(e))
      const min = inches(numOrNull(p.min_in))
      if (nested) {
        const primary = strArr(between[0])
        const refs = between.slice(1).flatMap((g) => (Array.isArray(g) ? strArr(g) : isStr(g) ? [g] : []))
        return 'Every ' + list(primary, 'or') + ' keeps at least ' + min + ' clear of any ' + list(refs, 'or') + '.'
      }
      return 'Every ' + list(strArr(between), 'and') + ' keep at least ' + min + ' clear of each other.'
    }
    case 'min_dimension': {
      const axis = isStr(p.axis) ? p.axis : 'min'
      return 'Every ' + nice(String(p.kind || '?')) + ' is at least ' + inches(numOrNull(p.min_in)) + ' ' + (AXIS_TEXT[axis] || axis) + '.'
    }
    case 'max_dimension': {
      const axis = isStr(p.axis) ? p.axis : 'min'
      return 'No ' + nice(String(p.kind || '?')) + ' is more than ' + inches(numOrNull(p.max_in)) + ' ' + (AXIS_TEXT[axis] || axis) + '.'
    }
    case 'no_overlap':
      return list(strArr(p.between), 'and').replace(/^./, (c) => c.toUpperCase()) + ' never overlap each other.'
    case 'forbidden_kind': {
      const max = numOrNull(p.max_count) ?? 0
      return max === 0
        ? 'No ' + nice(String(p.kind || '?')) + ' is allowed.'
        : 'No more than ' + max + ' ' + nice(String(p.kind || '?')) + ' elements are allowed.'
    }
    case 'required_kind': {
      const min = numOrNull(p.min_count) ?? 1
      return 'At least ' + min + ' ' + nice(String(p.kind || '?')) + ' is drawn.'
    }
    case 'elevation_bottom_height': {
      const tol = numOrNull(p.tolerance) ?? 1
      return (
        'The bottom of every ' + nice(String(p.kind || '?')) + ' sits ' + inches(numOrNull(p.aff)) +
        ' above the finished floor (± ' + inches(tol) + ').'
      )
    }
    default:
      return 'Unknown rule type "' + rule.rule_type + '".'
  }
}

// ---- rule JSON -> form fields ----

export type RuleFields = Record<string, string>

const onlyKeys = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).every((k) => allowed.includes(k))

export function ruleToFields(rule: RuleLike): { fits: boolean; fields: RuleFields } {
  const p = rule.params || {}
  const at = rule.applies_to || {}
  const s = scopeOf(rule)
  const f: RuleFields = {
    rooms_mode: s.allRooms ? 'all' : 'named',
    room_names: s.roomNames.join(', '),
    section_codes: s.sectionCodes.join(', '),
    type_plan: s.outlineTypes.includes('plan') ? 'on' : '',
    type_elevation: s.outlineTypes.includes('elevation') ? 'on' : '',
    type_section: s.outlineTypes.includes('section') ? 'on' : '',
  }
  let fits = onlyKeys(at, ['room_names', 'section_codes', 'outline_types'])
  // a room_names value the gate ignores (a string other than "*") would be lost by the form
  if (isStr(at.room_names) && at.room_names !== '*') fits = false

  switch (rule.rule_type) {
    case 'min_clearance': {
      const between = Array.isArray(p.between) ? p.between : []
      const nested = between.length >= 2 && between.every((e) => Array.isArray(e))
      if (!nested || !onlyKeys(p, ['between', 'min_in']) || numOrNull(p.min_in) == null) fits = false
      f.primary = nested ? strArr(between[0]).join(', ') : ''
      f.reference = nested ? between.slice(1).flatMap((g) => strArr(g)).join(', ') : ''
      f.min_in = numOrNull(p.min_in) == null ? '' : String(p.min_in)
      break
    }
    case 'min_dimension':
    case 'max_dimension': {
      const key = rule.rule_type === 'min_dimension' ? 'min_in' : 'max_in'
      if (!onlyKeys(p, ['kind', key, 'axis']) || !isStr(p.kind) || numOrNull(p[key]) == null) fits = false
      f.kind = isStr(p.kind) ? p.kind : ''
      f.limit_in = numOrNull(p[key]) == null ? '' : String(p[key])
      f.axis = isStr(p.axis) && ['min', 'w', 'h'].includes(p.axis) ? p.axis : 'min'
      if (p.axis !== undefined && f.axis !== p.axis) fits = false
      break
    }
    case 'no_overlap': {
      const kinds = strArr(p.between)
      if (!onlyKeys(p, ['between']) || !kinds.length || kinds.length !== (Array.isArray(p.between) ? p.between.length : -1)) fits = false
      f.kinds = kinds.join(', ')
      break
    }
    case 'forbidden_kind': {
      if (!onlyKeys(p, ['kind', 'max_count']) || !isStr(p.kind)) fits = false
      f.kind = isStr(p.kind) ? p.kind : ''
      f.max_count = String(numOrNull(p.max_count) ?? 0)
      break
    }
    case 'required_kind': {
      if (!onlyKeys(p, ['kind', 'min_count']) || !isStr(p.kind)) fits = false
      f.kind = isStr(p.kind) ? p.kind : ''
      f.min_count = String(numOrNull(p.min_count) ?? 1)
      break
    }
    case 'elevation_bottom_height': {
      if (!onlyKeys(p, ['kind', 'aff', 'tolerance']) || !isStr(p.kind) || numOrNull(p.aff) == null) fits = false
      f.kind = isStr(p.kind) ? p.kind : ''
      f.aff = numOrNull(p.aff) == null ? '' : String(p.aff)
      f.tolerance = String(numOrNull(p.tolerance) ?? 1)
      break
    }
    default:
      fits = false
  }
  return { fits, fields: f }
}

// ---- form fields -> rule JSON ----

export function splitList(v: string): string[] {
  return [...new Set(v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))]
}
const kindOf = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '_')
const kindList = (v: string) => [...new Set(splitList(v).map(kindOf))]

export type BuiltRule =
  | { ok: true; params: Record<string, unknown>; applies_to: Record<string, unknown> }
  | { ok: false; error: string }

export function fieldsToRule(ruleType: string, get: (name: string) => string): BuiltRule {
  const number = (name: string, label: string): number | string => {
    const raw = get(name).trim()
    const n = Number(raw)
    if (raw === '' || !Number.isFinite(n) || n < 0) return label + ' must be a number, zero or more'
    return n
  }
  const fail = (error: string): BuiltRule => ({ ok: false, error })

  // scope
  const types = OUTLINE_TYPES.filter((t) => get('type_' + t) === 'on')
  if (!types.length) return fail('Pick at least one drawing type (plans, elevations or sections)')
  const applies_to: Record<string, unknown> = {}
  if (get('rooms_mode') === 'named') {
    const names = splitList(get('room_names'))
    const codes = splitList(get('section_codes'))
    if (!names.length && !codes.length) return fail('Name at least one room (or switch to "All rooms")')
    if (names.length) applies_to.room_names = names
    if (codes.length) applies_to.section_codes = codes
  } else {
    applies_to.room_names = '*'
  }
  applies_to.outline_types = [...types]

  let params: Record<string, unknown>
  switch (ruleType) {
    case 'min_clearance': {
      const primary = kindList(get('primary'))
      const reference = kindList(get('reference'))
      const min = number('min_in', 'Clearance')
      if (!primary.length || !reference.length) return fail('Say what must stay clear, and clear of what')
      if (isStr(min)) return fail(min)
      params = { between: [primary, reference], min_in: min }
      break
    }
    case 'min_dimension':
    case 'max_dimension': {
      const kind = kindOf(get('kind'))
      const limit = number('limit_in', 'Size')
      const axis = ['min', 'w', 'h'].includes(get('axis')) ? get('axis') : 'min'
      if (!kind) return fail('Say what is being measured')
      if (isStr(limit)) return fail(limit)
      params = ruleType === 'min_dimension' ? { kind, min_in: limit, axis } : { kind, max_in: limit, axis }
      break
    }
    case 'no_overlap': {
      const kinds = kindList(get('kinds'))
      if (!kinds.length) return fail('List the things that must not overlap')
      params = { between: kinds }
      break
    }
    case 'forbidden_kind': {
      const kind = kindOf(get('kind'))
      const max = number('max_count', 'Allowed count')
      if (!kind) return fail('Say what is not allowed')
      if (isStr(max)) return fail(max)
      params = { kind, max_count: max }
      break
    }
    case 'required_kind': {
      const kind = kindOf(get('kind'))
      const min = number('min_count', 'Required count')
      if (!kind) return fail('Say what is required')
      if (isStr(min)) return fail(min)
      params = { kind, min_count: min }
      break
    }
    case 'elevation_bottom_height': {
      const kind = kindOf(get('kind'))
      const aff = number('aff', 'Height')
      const tol = number('tolerance', 'Tolerance')
      if (!kind) return fail('Say what is being mounted')
      if (isStr(aff)) return fail(aff)
      if (isStr(tol)) return fail(tol)
      params = { kind, aff, tolerance: tol }
      break
    }
    default:
      return fail('Unknown rule type')
  }
  return { ok: true, params, applies_to }
}

// rule_key for a brand-new rule: readable, stable, unique-ish (the DB enforces uniqueness)
export function keyFromDescription(description: string, ruleType: string): string {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
    .replace(/_+$/g, '')
  return slug || ruleType + '_' + Date.now().toString(36)
}
