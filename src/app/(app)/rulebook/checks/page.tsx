export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { saveRule, saveRuleForm, toggleRule } from '@/app/rules-actions'
import { Pill } from '@/components/pill'
import { RulebookHeader } from '@/components/rulebook-header'
import {
  describeRule,
  describeScope,
  ruleToFields,
  KNOWN_KINDS,
  RULE_TYPE_INFO,
  RULE_TYPE_VALUES,
  type RuleFields,
} from '@/lib/rule-text'
import Link from 'next/link'

// RULEBOOK · CHECKS — the rules the math gate runs on every pushed drawing.
// Each rule reads as a sentence; editing is a sentence with blanks, not JSON.
// What is stored is unchanged (params + applies_to) — see src/lib/rule-text.ts.

type Rule = {
  id: string
  rule_key: string
  description: string | null
  rule_type: string
  params: Record<string, unknown> | null
  applies_to: Record<string, unknown> | null
  active: boolean
  version: number
  updated_at: string
}

const NEW_DEFAULTS: Record<string, RuleFields> = {
  min_clearance: { min_in: '36' },
  min_dimension: { limit_in: '36', axis: 'min' },
  max_dimension: { limit_in: '18', axis: 'h' },
  elevation_bottom_height: { aff: '54', tolerance: '1' },
  no_overlap: {},
  forbidden_kind: { max_count: '0' },
  required_kind: { min_count: '1' },
}

const inline = 'field !w-auto !py-1.5 !text-sm'

function Kind({ name, value, placeholder }: { name: string; value?: string; placeholder: string }) {
  return <input name={name} defaultValue={value} required list="kinds" placeholder={placeholder} className={inline + ' w-44'} />
}
function Kinds({ name, value, placeholder }: { name: string; value?: string; placeholder: string }) {
  return (
    <input name={name} defaultValue={value} required placeholder={placeholder} className={inline + ' min-w-[16rem] flex-1'} />
  )
}
function Num({ name, value }: { name: string; value?: string }) {
  return <input name={name} type="number" min="0" step="any" required defaultValue={value} className={inline + ' w-24'} />
}
function Axis({ value }: { value?: string }) {
  return (
    <select name="axis" defaultValue={value || 'min'} className={inline}>
      <option value="min">on its narrowest side</option>
      <option value="w">wide</option>
      <option value="h">tall (deep, on a plan)</option>
    </select>
  )
}

function Sentence({ ruleType, f }: { ruleType: string; f: RuleFields }) {
  const row = 'flex flex-wrap items-center gap-2 text-sm text-slate-300'
  switch (ruleType) {
    case 'min_clearance':
      return (
        <div className={row}>
          Every <Kinds name="primary" value={f.primary} placeholder="island" /> must stay at least
          <Num name="min_in" value={f.min_in} /> in clear of any
          <Kinds name="reference" value={f.reference} placeholder="counter, fridge, range" />
        </div>
      )
    case 'min_dimension':
      return (
        <div className={row}>
          Every <Kind name="kind" value={f.kind} placeholder="walkway" /> must be at least
          <Num name="limit_in" value={f.limit_in} /> in <Axis value={f.axis} />
        </div>
      )
    case 'max_dimension':
      return (
        <div className={row}>
          No <Kind name="kind" value={f.kind} placeholder="soffit" /> may be more than
          <Num name="limit_in" value={f.limit_in} /> in <Axis value={f.axis} />
        </div>
      )
    case 'elevation_bottom_height':
      return (
        <div className={row}>
          The bottom of every <Kind name="kind" value={f.kind} placeholder="upper_cabinet" /> sits
          <Num name="aff" value={f.aff} /> in above the finished floor, give or take
          <Num name="tolerance" value={f.tolerance} /> in
        </div>
      )
    case 'no_overlap':
      return (
        <div className={row}>
          These must never overlap each other: <Kinds name="kinds" value={f.kinds} placeholder="door, island" />
        </div>
      )
    case 'forbidden_kind':
      return (
        <div className={row}>
          No more than <Num name="max_count" value={f.max_count} />
          <Kind name="kind" value={f.kind} placeholder="blind_corner" /> may be drawn (0 = none at all)
        </div>
      )
    case 'required_kind':
      return (
        <div className={row}>
          At least <Num name="min_count" value={f.min_count} />
          <Kind name="kind" value={f.kind} placeholder="island" /> must be drawn
        </div>
      )
    default:
      return null
  }
}

function RuleForm({
  rule,
  ruleType,
  fields,
}: {
  rule?: Rule
  ruleType: string
  fields: RuleFields
}) {
  const f = fields
  const named = f.rooms_mode === 'named'
  return (
    <form action={saveRuleForm} className="space-y-4">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <input type="hidden" name="rule_type" value={ruleType} />

      <Sentence ruleType={ruleType} f={f} />

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2 text-sm text-slate-300">
          <legend className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Which rooms</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="rooms_mode" value="all" defaultChecked={!named} className="accent-gold" />
            All rooms
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="rooms_mode" value="named" defaultChecked={named} className="accent-gold mt-2.5" />
            <span className="flex-1 space-y-1.5">
              <span className="block">Only these rooms</span>
              <input
                name="room_names"
                defaultValue={f.room_names}
                placeholder="Room names, exactly as on the board: Kitchen, Butler Pantry"
                className="field !py-1.5 !text-sm"
              />
              <input
                name="section_codes"
                defaultValue={f.section_codes}
                placeholder="…and/or room numbers: 103, 104"
                className="field !py-1.5 !text-sm"
              />
              <span className="block text-[11px] text-slate-600">
                Names must match exactly (capitals do not matter). “Bath” does not cover “Bath 2”.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-2 text-sm text-slate-300">
          <legend className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Which drawings</legend>
          {(['plan', 'elevation', 'section'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={'type_' + t}
                defaultChecked={f['type_' + t] === 'on'}
                className="accent-gold"
              />
              {t === 'plan' ? 'Plans (top-down)' : t === 'elevation' ? 'Elevations' : 'Sections'}
            </label>
          ))}
        </fieldset>
      </div>

      <label className="block text-[10px] uppercase tracking-wider text-slate-500">
        Shown to the reviewer when a drawing fails this rule
        <input
          name="description"
          required
          defaultValue={rule?.description || ''}
          placeholder='e.g. Island needs 42" minimum clear to counters and appliances.'
          className="field mt-1.5 normal-case tracking-normal"
        />
      </label>

      <button className="btn-primary-sm">{rule ? 'Save rule' : 'Add rule'}</button>
    </form>
  )
}

function RawForm({ rule }: { rule: Rule }) {
  return (
    <form action={saveRule} className="grid grid-cols-2 gap-3 text-sm">
      <input type="hidden" name="id" value={rule.id} />
      <input type="hidden" name="rule_key" value={rule.rule_key} />
      <input type="hidden" name="rule_type" value={rule.rule_type} />
      {rule.active && <input type="hidden" name="active" value="on" />}
      <label className="col-span-2 text-[10px] uppercase tracking-wider text-slate-500">
        Shown on failure
        <input name="description" defaultValue={rule.description || ''} className="field mt-1 normal-case tracking-normal" />
      </label>
      <label className="text-[10px] uppercase tracking-wider text-slate-500">
        params (JSON)
        <textarea
          name="params"
          defaultValue={JSON.stringify(rule.params || {}, null, 1)}
          rows={5}
          className="field mt-1 font-mono !text-xs normal-case tracking-normal"
        />
      </label>
      <label className="text-[10px] uppercase tracking-wider text-slate-500">
        applies_to (JSON)
        <textarea
          name="applies_to"
          defaultValue={JSON.stringify(rule.applies_to || {}, null, 1)}
          rows={5}
          className="field mt-1 font-mono !text-xs normal-case tracking-normal"
        />
      </label>
      <button className="btn-secondary-sm justify-self-start">Save raw JSON</button>
    </form>
  )
}

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; new?: string }>
}) {
  const { error, saved, new: newType } = await searchParams
  const supabase = await createClient()

  const [{ data: ruleRows }, { data: versions }] = await Promise.all([
    supabase.from('intent_rules').select('*').order('active', { ascending: false }).order('rule_key'),
    supabase
      .from('intent_rulebook_versions')
      .select('version, created_at, snapshot')
      .order('version', { ascending: false })
      .limit(10),
  ])
  const rules = (ruleRows || []) as Rule[]
  const activeCount = rules.filter((r) => r.active).length
  const latest = versions?.[0]?.version || 1
  const adding = newType && RULE_TYPE_VALUES.includes(newType) ? newType : null
  const addingInfo = RULE_TYPE_INFO.find((t) => t.value === adding)

  return (
    <main>
      <RulebookHeader active="checks" />
      <datalist id="kinds">
        {KNOWN_KINDS.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      <div className="app-container py-8 space-y-8 max-w-5xl">
        <p className="text-sm text-slate-400 leading-relaxed">
          Every 2D drawing Blueprint pushes is measured against these rules by plain code — no AI involved. A failure
          shows on the drawing in the room&apos;s 2D review.{' '}
          <span className="text-slate-500">
            {activeCount} active {activeCount === 1 ? 'rule' : 'rules'} · rulebook v{latest}.
          </span>
        </p>

        {error && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{error}</div>}
        {saved && (
          <div className="bg-emerald-950/40 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">
            Saved — the rulebook is now v{latest}.
            <span className="block text-emerald-400/70 mt-1">
              Drawings that were already pushed keep their earlier result until their checks are re-run (↻ on the
              drawing). New pushes use the new rulebook.
            </span>
          </div>
        )}

        {/* RULES */}
        <section className="card divide-y divide-slate-800/60">
          {rules.map((r) => {
            const { fits, fields } = ruleToFields(r)
            return (
              <div key={r.id} className={'px-4 py-3.5 ' + (r.active ? '' : 'opacity-60')}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{describeRule(r)}</div>
                    <div className="text-xs text-slate-500 mt-1">{describeScope(r)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Pill tone={r.active ? 'green' : 'neutral'}>{r.active ? 'on' : 'off'}</Pill>
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-[11px] text-slate-500 hover:text-white transition-colors">
                        {r.active ? 'Turn off' : 'Turn on'}
                      </button>
                    </form>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-slate-600 hover:text-gold-light">
                    Edit
                    <span className="ml-2 font-mono text-[10px] text-slate-700">
                      {r.rule_key} · v{r.version} · {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                  </summary>
                  <div className="mt-3 rounded-lg border border-bh-border bg-bh-panel/50 p-4 space-y-4">
                    {fits ? (
                      <RuleForm rule={r} ruleType={r.rule_type} fields={fields} />
                    ) : (
                      <p className="text-xs text-amber-300/90">
                        This rule uses settings the simple editor does not cover, so it is edited as raw JSON to avoid
                        changing what it means.
                      </p>
                    )}
                    <details open={!fits}>
                      <summary className="cursor-pointer text-[11px] text-slate-600 hover:text-slate-300">
                        Advanced: raw JSON
                      </summary>
                      <div className="mt-3">
                        <RawForm rule={r} />
                      </div>
                    </details>
                  </div>
                </details>
              </div>
            )
          })}
          {rules.length === 0 && <div className="px-4 py-8 text-sm text-slate-600 text-center">No rules yet.</div>}
        </section>

        {/* ADD */}
        <section id="new" className="scroll-mt-24 space-y-3">
          <h2 className="section-title">Add a rule</h2>
          <div className="flex flex-wrap gap-2">
            {RULE_TYPE_INFO.map((t) => (
              <Link
                key={t.value}
                href={'/rulebook/checks?new=' + t.value + '#new'}
                title={t.says}
                className={adding === t.value ? 'btn-primary-sm' : 'btn-secondary-sm'}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {adding && addingInfo ? (
            <div className="card p-4 space-y-4">
              <div className="text-xs text-slate-500">{addingInfo.says}.</div>
              <RuleForm
                ruleType={adding}
                fields={{
                  rooms_mode: 'all',
                  type_plan: adding === 'elevation_bottom_height' ? '' : 'on',
                  type_elevation: adding === 'elevation_bottom_height' ? 'on' : '',
                  ...(NEW_DEFAULTS[adding] || {}),
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-600">Pick the kind of rule to start.</p>
          )}
        </section>

        {/* HISTORY */}
        <details>
          <summary className="cursor-pointer section-title hover:text-white">Rulebook history</summary>
          <div className="mt-3 space-y-2">
            {(versions || []).map((v) => (
              <div key={v.version} className="card flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-slate-800 rounded px-2 py-0.5">v{v.version}</span>
                  <span className="text-slate-500">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {Array.isArray(v.snapshot) ? v.snapshot.length + ' rules' : '—'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Every save records the full rulebook. Each drawing&apos;s check notes which version it ran against.
          </p>
        </details>
      </div>
    </main>
  )
}
