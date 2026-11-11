import { DEFAULTS, type DefaultRule } from '@/lib/defaults'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · DEFAULTS — what gets built when nobody decided otherwise.
// Read-only for now: the list is still built into the app (src/lib/defaults.ts).

const SCOPE_LABEL: Record<DefaultRule['scope'], string> = {
  house: 'Whole house',
  public: 'Public rooms',
  secondary: 'Secondary rooms',
  master: 'Master suite',
  bath: 'Baths (and the master suite)',
  garage: 'Garage and gym',
  adu: 'ADU',
  outdoor: 'Outdoor living',
}
const ORDER: DefaultRule['scope'][] = ['house', 'public', 'master', 'secondary', 'bath', 'garage', 'adu', 'outdoor']

export default function DefaultsPage() {
  const groups = ORDER.map((scope) => ({ scope, rows: DEFAULTS.filter((d) => d.scope === scope) })).filter(
    (g) => g.rows.length
  )
  return (
    <main>
      <RulebookHeader active="defaults" />
      <div className="app-container py-8 space-y-8 max-w-5xl">
        <p className="text-sm text-slate-400 leading-relaxed">
          When a room has no decision on a topic, Blueprint builds the value listed here. To change it for one room, open
          the room and use <span className="text-slate-200">Override</span> on that line.
        </p>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
          This list cannot be edited here yet. It is built into the app, separately from the runbook document under
          Standards — editing the runbook does not change this list. Making defaults editable needs a database change
          and is the next step of the reorganisation.
        </div>

        {groups.map((g) => (
          <section key={g.scope} className="space-y-3">
            <h2 className="section-title">
              {SCOPE_LABEL[g.scope]} <span className="text-slate-600">({g.rows.length})</span>
            </h2>
            <div className="card divide-y divide-slate-800/60">
              {g.rows.map((d) => (
                <div key={d.topic} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-slate-500 mr-2">{d.topic}</span>
                    <span className="text-slate-300">{d.value}</span>
                  </div>
                  <Pill tone="outline">default</Pill>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
