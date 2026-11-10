export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { saveRule, toggleRule } from '@/app/rules-actions'
import { Pill } from '@/components/pill'
import Link from 'next/link'

const RULE_TYPES: { value: string; label: string; params: string }[] = [
  { value: 'min_clearance', label: 'min clearance', params: '{"between": ["island","counter"], "min_in": 42}' },
  { value: 'min_dimension', label: 'min dimension', params: '{"kind": "walkway", "min_in": 36, "axis": "min"}' },
  { value: 'max_dimension', label: 'max dimension', params: '{"kind": "soffit", "max_in": 18, "axis": "h"}' },
  { value: 'no_overlap', label: 'no overlap', params: '{"between": ["door","island"]}' },
  { value: 'forbidden_kind', label: 'forbidden kind', params: '{"kind": "blind_corner", "max_count": 0}' },
  { value: 'required_kind', label: 'required kind', params: '{"kind": "island", "min_count": 1}' },
  { value: 'elevation_bottom_height', label: 'bottom edge height (AFF)', params: '{"kind": "upper_cabinet", "aff": 54, "tolerance": 1}' },
]

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()

  const [{ data: rules }, { data: versions }] = await Promise.all([
    supabase.from('intent_rules').select('*').order('rule_key'),
    supabase
      .from('intent_rulebook_versions')
      .select('version, created_at, created_by, snapshot')
      .order('version', { ascending: false })
      .limit(10),
  ])

  return (
    <main>
      <header className="border-b border-bh-border bg-bh-panel/40">
        <div className="app-container py-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors">
              ← Projects
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl font-semibold text-white">Rulebook</h1>
              <Pill tone="outline">math gate · v{versions?.[0]?.version || 1} latest</Pill>
            </div>
          </div>
          <span className="text-xs text-slate-500">Michael&apos;s clearance rules — executed against pushed 2D geometry</span>
        </div>
      </header>

      <div className="app-container py-8 space-y-10">
        {error && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{error}</div>
        )}

        {/* HOW IT WORKS */}
        <section className="bg-bh-card border border-bh-border rounded-xl p-5 text-sm text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-200 mb-2">How the math gate works</div>
          Blueprint pushes 2D zone maps (top-down plans) and elevations with real geometry — labeled
          rectangles in inches. Every push is checked against these rules by plain code (no AI): clearances,
          dimensions, mounting heights, overlaps. Failures show on the outline card in each room; Michael
          reviews and approves or rejects.
          <div className="mt-3 grid gap-2 text-xs text-slate-500">
            <div>
              <span className="text-slate-300">Plans:</span> x-right, y-down from top-left, inches.
            </div>
            <div>
              <span className="text-slate-300">Elevations/sections:</span> x-right, y-UP from the floor line
              (y = height above finished floor), inches.
            </div>
            <div>
              <span className="text-slate-300">Element kinds</span> are a vocabulary, not a fixed list —
              counter · island · appliance · fridge · range · sink · dishwasher · walkway · door · window ·
              wall · closet_rod · closet_shelf · upper_cabinet · base_cabinet · tall_cabinet · soffit · beam ·
              column · bed · vanity · toilet · shower · tub · table · seating · blind_corner
            </div>
            <div>
              <span className="text-slate-300">applies_to:</span>{' '}
              <code>{'{"room_names": ["Kitchen","Butler Pantry"], "section_codes": ["B3"], "outline_types": ["plan"]}'}</code>{' '}
              — <code>&quot;*&quot;</code> = all rooms; omit outline_types for all.
            </div>
          </div>
        </section>

        {/* ACTIVE RULES */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Rules ({rules?.filter((r) => r.active).length || 0} active / {rules?.length || 0} total)
          </h2>
          {(rules || []).map((r) => (
            <div
              key={r.id}
              className={`border rounded-xl p-4 ${r.active ? 'border-bh-border bg-bh-card' : 'border-slate-800 bg-bh-panel/40 opacity-70'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gold-light">{r.rule_key}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">
                    {RULE_TYPES.find((t) => t.value === r.rule_type)?.label || r.rule_type}
                  </span>
                  <span className="text-[9px] text-slate-600">v{r.version} · edited {new Date(r.updated_at).toLocaleDateString()}</span>
                </div>
                <form action={toggleRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-slate-800 text-slate-400 hover:text-white transition-colors">
                    {r.active ? 'deactivate' : 'reactivate'}
                  </button>
                </form>
              </div>
              <form action={saveRule} className="grid grid-cols-2 gap-3 text-sm">
                <input type="hidden" name="id" value={r.id} />
                <label className="col-span-2 -mb-1 text-[10px] uppercase tracking-wider text-slate-500">Description (shown on fail)</label>
                <input
                  name="description"
                  defaultValue={r.description || ''}
                  className="col-span-2 bg-bh-black border border-bh-border rounded-lg px-3 py-2"
                />
                <label className="text-[10px] uppercase tracking-wider text-slate-500">rule_key</label>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">type</label>
                <input
                  name="rule_key"
                  defaultValue={r.rule_key}
                  className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs"
                />
                <select
                  name="rule_type"
                  defaultValue={r.rule_type}
                  className="bg-bh-black border border-bh-border rounded-lg px-3 py-2"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <label className="col-span-2 -mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                  params (JSON — see examples below)
                </label>
                <textarea
                  name="params"
                  defaultValue={JSON.stringify(r.params || {}, null, 1)}
                  rows={3}
                  className="col-span-2 bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs"
                />
                <label className="col-span-2 -mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                  applies_to (JSON — rooms + outline types)
                </label>
                <textarea
                  name="applies_to"
                  defaultValue={JSON.stringify(r.applies_to || {}, null, 1)}
                  rows={3}
                  className="col-span-2 bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" name="active" defaultChecked={r.active} className="accent-gold" />
                  active
                </label>
                <button className="bg-gold hover:bg-gold-light-light text-slate-950 font-semibold rounded-lg px-3 py-2 transition-colors">
                  Save rule (snapshots rulebook)
                </button>
              </form>
            </div>
          ))}
        </section>

        {/* ADD RULE */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Add a rule</h2>
          <form action={saveRule} className="bg-bh-panel/70 border border-bh-border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <input name="rule_key" required placeholder="rule_key (e.g. vanity_clearance_30)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs" />
            <select name="rule_type" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2">
              {RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Human description (shown on failures)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-2" />
            <textarea name="params" placeholder='params JSON, e.g. {"between":["vanity","wall"],"min_in":30}' rows={2} className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs col-span-2" />
            <textarea name="applies_to" placeholder='applies_to JSON, e.g. {"room_names":["Master Bath"],"outline_types":["plan"]}' rows={2} className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs col-span-2" />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" name="active" defaultChecked className="accent-gold" />
              active
            </label>
            <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 font-medium">Add rule</button>
          </form>

          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400">param examples per rule type</summary>
            <div className="mt-2 space-y-1 font-mono">
              {RULE_TYPES.map((t) => (
                <div key={t.value}>
                  <span className="text-slate-300">{t.label}:</span> {t.params}
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* VERSIONS */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Version history</h2>
          <div className="space-y-2">
            {versions?.map((v) => (
              <div key={v.version} className="flex items-center justify-between bg-bh-card border border-bh-border rounded-lg px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-slate-800 rounded px-2 py-0.5">v{v.version}</span>
                  <span className="text-slate-500">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <span className="text-xs text-slate-500">{Array.isArray(v.snapshot) ? `${v.snapshot.length} rules` : '—'}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Every save snapshots the full active rulebook — outline checks record which version they ran
            against, so any approval can be traced to the exact ruleset.
          </p>
        </section>
      </div>
    </main>
  )
}
