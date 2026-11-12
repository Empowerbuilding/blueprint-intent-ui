// Has anything that goes into a contract changed since an emission was written? (flag 52, spec A56)
//
// Lock & Emit used to write a new version at every press: v1 to v4 of one project went out within 30 seconds,
// each with its own message to Blueprint. A press that would write exactly what the last emission holds now
// writes nothing. This file is the comparison, with no database in it, so it can be tested on its own.
//
// Two emissions of the same content still differ in the fields that say nothing about the house: the version,
// the time, and (typed contract) the fingerprint taken over both. Those are left out. Everything else counts.

type Obj = Record<string, unknown>

// what the database would hold: no undefined values, no class instances
const plain = (v: unknown): unknown => (v === undefined ? null : JSON.parse(JSON.stringify(v)))
const sorted = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v as Obj).sort().map((k) => [k, sorted((v as Obj)[k])]))
      : v

/** the content of a contract (v1) without its version and its time */
export function contentOfV1(v1: unknown): string {
  const a = plain(v1)
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const o = a as Obj
    if (o.project && typeof o.project === 'object') {
      const p = { ...(o.project as Obj) }
      delete p.emitted_version
      delete p.emitted_at
      o.project = p
    }
  }
  return JSON.stringify(sorted(a))
}

/** the content of the typed contract (v2), or of the list of what is missing when it was not written */
export function contentOfV2(v2: unknown, v2Errors: unknown): string {
  const b = plain(v2)
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    const o = b as Obj
    delete o.version
    delete o.emitted_at
    delete o.sha256_intent
    return JSON.stringify(sorted(o))
  }
  return JSON.stringify({ missing: Array.isArray(v2Errors) && v2Errors.length ? plain(v2Errors) : null })
}

export type EmittedRow = { version: number; emitted_at?: string | null; intent_json: unknown; intent_v2_json?: unknown; v2_errors?: unknown; brief_md?: string | null }

/** a stored emission that really holds a contract (an empty or foreign row is never "the same") */
const holdsContract = (row: EmittedRow | null | undefined): row is EmittedRow =>
  !!row && !!row.intent_json && typeof row.intent_json === 'object' && Array.isArray((row.intent_json as Obj).rooms)

/** true when emitting now would write exactly what this emission already holds */
export function sameAsEmitted(row: EmittedRow | null | undefined, v1: unknown, v2: unknown, v2Errors: unknown): boolean {
  if (!holdsContract(row)) return false
  return contentOfV1(row.intent_json) === contentOfV1(v1) && contentOfV2(row.intent_v2_json, row.v2_errors) === contentOfV2(v2, v2Errors)
}

/** two presses in the same instant: the other one has written the contract, and maybe not yet the typed half */
export function sameAsBeingWritten(row: EmittedRow | null | undefined, v1: unknown, v2: unknown, v2Errors: unknown): boolean {
  if (!holdsContract(row)) return false
  if (contentOfV1(row.intent_json) !== contentOfV1(v1)) return false
  const typedNotYet = row.intent_v2_json == null && (row.v2_errors == null || (Array.isArray(row.v2_errors) && row.v2_errors.length === 0))
  return typedNotYet || contentOfV2(row.intent_v2_json, row.v2_errors) === contentOfV2(v2, v2Errors)
}
