// One-line reading of an outline's two gates — shared by the Inbox and the room page.

export type MathResult = {
  rule_key: string
  description: string
  status: string
  measured?: string
  required?: string
  detail?: string
}
export type MathCheck = {
  ran_at?: string
  rulebook_version?: number | null
  passed?: boolean | null
  results?: MathResult[]
}
export type VisionResult = { topic: string; verdict: string; note?: string }
export type VisionCheck = {
  ran_at?: string
  status?: string
  error?: string
  skipped?: string
  results?: VisionResult[]
}
export type Override = { reason: string; by: string | null; at: string }

export type CheckSummary = {
  math: MathCheck | null
  vision: VisionCheck | null
  override: Override | null
  mathFails: MathResult[]
  mathPasses: MathResult[]
  mathNa: MathResult[]
  conflicts: VisionResult[]
  missing: VisionResult[]
  confirmed: VisionResult[]
  visionRunning: boolean
  visionStalled: boolean // "running" for more than 10 minutes — the background job is gone
  mathTone: 'red' | 'green' | 'neutral'
  mathText: string
  visionTone: 'red' | 'gold' | 'green' | 'blue' | 'neutral'
  visionText: string
  needsAttention: boolean
}

const STALL_MS = 10 * 60 * 1000

export function summariseChecks(checks: Record<string, unknown> | null | undefined, now = Date.now()): CheckSummary {
  const math = ((checks || {}).math || null) as MathCheck | null
  const vision = ((checks || {}).vision || null) as VisionCheck | null
  const override = ((checks || {}).override || null) as Override | null

  const results = math?.results || []
  const mathFails = results.filter((r) => r.status === 'fail')
  const mathPasses = results.filter((r) => r.status === 'pass')
  const mathNa = results.filter((r) => r.status !== 'fail' && r.status !== 'pass')

  const vr = vision?.status === 'ok' ? vision.results || [] : []
  const conflicts = vr.filter((v) => v.verdict === 'conflict')
  const missing = vr.filter((v) => v.verdict === 'missing')
  const confirmed = vr.filter((v) => v.verdict === 'confirmed')

  const running = vision?.status === 'running'
  const ranAt = vision?.ran_at ? Date.parse(vision.ran_at) : NaN
  const visionStalled = running && Number.isFinite(ranAt) && now - ranAt > STALL_MS
  const visionRunning = running && !visionStalled

  const plural = (n: number, one: string) => n + ' ' + one + (n === 1 ? '' : 's')

  let mathTone: CheckSummary['mathTone'] = 'neutral'
  let mathText = 'Rules not run'
  if (math) {
    if (mathFails.length) {
      mathTone = 'red'
      mathText = plural(mathFails.length, 'rule') + ' failed'
    } else if (mathPasses.length) {
      mathTone = 'green'
      mathText = plural(mathPasses.length, 'rule') + ' passed'
    } else {
      mathText = 'No rule measured this drawing'
    }
  }

  let visionTone: CheckSummary['visionTone'] = 'neutral'
  let visionText = 'Decisions not checked'
  if (visionStalled) {
    visionTone = 'gold'
    visionText = 'Decision check stalled — re-run'
  } else if (visionRunning) {
    visionTone = 'blue'
    visionText = 'Checking decisions…'
  } else if (vision?.status === 'ok') {
    if (conflicts.length) {
      visionTone = 'red'
      visionText = plural(conflicts.length, 'decision') + ' contradicted'
    } else if (missing.length) {
      visionTone = 'gold'
      visionText = plural(missing.length, 'decision') + ' not shown'
    } else if (confirmed.length) {
      visionTone = 'green'
      visionText = plural(confirmed.length, 'decision') + ' confirmed'
    } else {
      visionText = 'No decision applies to this drawing'
    }
  } else if (vision?.status === 'skipped') {
    visionText = 'Decision check skipped'
  } else if (vision?.status === 'error') {
    visionTone = 'gold'
    visionText = 'Decision check failed — re-run'
  }

  return {
    math,
    vision,
    override,
    mathFails,
    mathPasses,
    mathNa,
    conflicts,
    missing,
    confirmed,
    visionRunning,
    visionStalled,
    mathTone,
    mathText,
    visionTone,
    visionText,
    needsAttention: mathFails.length > 0 || conflicts.length > 0,
  }
}

export function ago(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return min + ' min ago'
  const h = Math.round(min / 60)
  if (h < 24) return h + ' h ago'
  const d = Math.round(h / 24)
  return d + (d === 1 ? ' day ago' : ' days ago')
}
