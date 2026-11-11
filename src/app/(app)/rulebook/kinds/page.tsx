export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { loadKinds } from '@/lib/model-rules'
import { ROLE_ALIASES, ROOM_ROLES, roleLabel } from '@/lib/vocab'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · KINDS OF WORK — the controlled words the typed contract (v2) is written in.
// Read-only here. Two tiers: a kind is LOCKED when every bridge command it names is on the live bridge and its
// parameters were read from the bridge source; whether a command has actually been run is PROVEN, per command,
// on the Capabilities page. A kind that is not locked is a draft, and says why.

export default async function KindsPage() {
  const supabase = await createClient()
  const loaded = await loadKinds(supabase)
  // context is not a kind of work: it is the mark for a line that asks for nothing to be built
  const kinds = (loaded || []).filter((k) => k.active && k.executable)
  const hasContext = (loaded || []).some((k) => k.active && !k.executable)
  const families = [...new Set(kinds.map((k) => k.family))]
  const lockedKinds = kinds.filter((k) => k.status === 'locked')
  const locked = kinds.length > 0 && lockedKinds.length === kinds.length
  const build = lockedKinds.find((k) => k.locked_build)?.locked_build || null
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
              <>Every kind is locked.</>
            ) : lockedKinds.length ? (
              <>
                {lockedKinds.length} of {kinds.length} kinds are locked{build ? ' (bridge build ' + build + ')' : ''}: every command they name is
                on the bridge and its settings were read from the bridge&apos;s own code. Locked does not mean a command has been run; that is
                recorded on the Capabilities page. The other {kinds.length - lockedKinds.length} are drafts, each with the reason.
              </>
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
                      {k.status_note && (
                        <div className={'text-[11px] break-words ' + (k.status === 'locked' ? 'text-amber-400/80' : 'text-slate-500')}>{k.status_note}</div>
                      )}
                      {(k.bridge_commands || []).length > 0 && (
                        <div className="text-[11px] text-slate-600 break-words">
                          bridge: {(k.bridge_commands || []).map((c) => c.replace('revit.', '')).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Pill tone={k.status === 'locked' ? 'green' : 'gold'}>{k.status === 'locked' ? 'locked' : 'draft'}</Pill>
                      {k.stage_scope && <Pill tone="outline">later stage</Pill>}
                      <span className="font-mono text-[11px] text-gold-light/80">{k.kind}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}

        {hasContext && (
          <section className="space-y-2">
            <h2 className="section-title">Not a kind of work: context</h2>
            <p className="text-xs text-slate-500">
              Some lines ask for nothing to be built — “leave the space under the stairs open”. They are marked as context: carried
              with the room, with where they came from, so the work around them respects them. They are never built and never sent to
              a build phase.
            </p>
          </section>
        )}

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
