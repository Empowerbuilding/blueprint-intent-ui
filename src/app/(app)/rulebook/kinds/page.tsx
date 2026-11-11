export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { loadKinds } from '@/lib/model-rules'
import { ROLE_ALIASES, ROOM_ROLES, roleLabel } from '@/lib/vocab'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · KINDS OF WORK — the controlled words the typed contract (v2) is written in.
// Read-only here for now. The list is a DRAFT until it has been checked against a live Revit bridge.

export default async function KindsPage() {
  const supabase = await createClient()
  const loaded = await loadKinds(supabase)
  const kinds = (loaded || []).filter((k) => k.active)
  const families = [...new Set(kinds.map((k) => k.family))]
  const locked = kinds.length > 0 && kinds.every((k) => k.status === 'locked')
  const later = kinds.filter((k) => k.stage_scope).length

  return (
    <main>
      <RulebookHeader active="kinds" />
      <div className="app-container py-8 max-w-5xl space-y-8">
        {loaded === null && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">The list of kinds of work could not be read.</div>
        )}
        <div className="text-sm text-slate-400 leading-relaxed space-y-2">
          <p>
            Every decision and redline note is given one of these {kinds.length} kinds of work. The kind decides which build phase does it
            and which checks it must pass.
          </p>
          <p className="text-xs text-slate-500">
            {locked ? (
              <>The list is locked.</>
            ) : (
              <>
                <Pill tone="gold">draft</Pill> The list has not been checked against a live Revit bridge yet, so nothing is locked: a kind here
                does not prove the bridge can do the work.
              </>
            )}{' '}
            {later} kind{later === 1 ? ' belongs' : 's belong'} to a later draft stage: a line of that kind is carried forward, not built in Draft 2.
          </p>
        </div>

        {families.map((f) => (
          <section key={f} className="space-y-2">
            <h2 className="section-title">{f}</h2>
            <div className="card divide-y divide-slate-800/60">
              {kinds
                .filter((k) => k.family === f)
                .map((k) => (
                  <div key={k.kind} className="px-4 py-2.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100">{k.label}</div>
                      <div className="text-xs text-slate-500 break-words">{k.description}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {k.stage_scope && <Pill tone="outline">later stage</Pill>}
                      {!k.executable && <Pill tone="outline">nothing built</Pill>}
                      <span className="font-mono text-[11px] text-gold-light/80">{k.kind}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="section-title">
            Room roles <span className="text-slate-500 normal-case tracking-normal font-normal">({ROOM_ROLES.length})</span>
          </h2>
          <p className="text-xs text-slate-500">
            What a room is. Every room on the board gets one; checks and defaults attach by role, so there is no “other”.
            {Object.keys(ROLE_ALIASES).length > 0 &&
              ' Also understood: ' +
                Object.entries(ROLE_ALIASES)
                  .map(([a, r]) => roleLabel(a) + ' (= ' + roleLabel(r) + ')')
                  .join(', ') +
                '.'}
          </p>
          <div className="card p-4 flex flex-wrap gap-2">
            {ROOM_ROLES.map((r) => (
              <span key={r} className="rounded-full border border-bh-border px-2.5 py-1 text-xs text-slate-300">
                {roleLabel(r)}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
