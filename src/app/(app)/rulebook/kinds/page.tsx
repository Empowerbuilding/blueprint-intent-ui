export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { loadKinds, ruleNumbers, TARGET_NEEDS, TARGET_NEED_LABEL } from '@/lib/model-rules'
import { setKindNumber, setKindTargetNeed } from '@/app/kinds-actions'
import { approverNames, loadApprovers } from '@/lib/lessons'
import { ROLE_ALIASES, ROOM_ROLES, roleLabel } from '@/lib/vocab'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · KINDS OF WORK — the controlled words the typed contract (v2) is written in.
// Read-only here. Two tiers: a kind is LOCKED when every bridge command it names is on the live bridge and its
// parameters were read from the bridge source; whether a command has actually been run is PROVEN, per command,
// on the Capabilities page. A kind that is not locked is a draft, and says why.
// Each kind is built one of three ways: by named bridge commands, by a recipe (direct Revit calls that already ran on a
// real project; the projects and scripts are listed with it), or by nothing yet.

export default async function KindsPage({ searchParams }: { searchParams: Promise<{ err?: string; saved?: string }> }) {
  const { err, saved } = await searchParams
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    approvers,
    loaded,
  ] = await Promise.all([supabase.auth.getUser(), loadApprovers(supabase), loadKinds(supabase)])
  const isApprover = !!user && approvers.some((a) => a.user_id === user.id)
  const names = approverNames(approvers)
  // context is not a kind of work: it is the mark for a line that asks for nothing to be built
  const kinds = (loaded || []).filter((k) => k.active && k.executable)
  const hasContext = (loaded || []).some((k) => k.active && !k.executable)
  const families = [...new Set(kinds.map((k) => k.family))]
  const lockedKinds = kinds.filter((k) => k.status === 'locked')
  const locked = kinds.length > 0 && lockedKinds.length === kinds.length
  const build = lockedKinds.find((k) => k.locked_build)?.locked_build || null
  const later = kinds.filter((k) => k.stage_scope).length
  const byRecipe = kinds.filter((k) => k.backing === 'recipe').length
  const noPath = kinds.filter((k) => k.backing === 'unmapped').length

  return (
    <main>
      <RulebookHeader active="kinds" />
      <div className="app-container py-8 max-w-5xl space-y-8">
        {err && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err}</div>}
        {saved && <div className="bg-emerald-950/50 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">Saved: {saved}. Blueprint has been told.</div>}
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
          <p className="text-xs text-slate-500">
            Each kind also says what a line of that kind must be pinned to before anything is built: an existing element, a drawn
            position on the approved 2D, either, or nothing. A line that is not pinned is listed on the build plan as not resolved.{' '}
            {isApprover ? 'You can change it here.' : 'Only ' + names + ' can change it.'}
          </p>
          {(byRecipe > 0 || noPath > 0) && (
            <p className="text-xs text-slate-500">
              {byRecipe > 0 && (
                <>
                  {byRecipe} kind{byRecipe === 1 ? ' is' : 's are'} built by a <Pill tone="outline">recipe</Pill> instead of a named command: a
                  set of direct Revit calls that already ran on a real project. The projects and scripts are listed with the kind. A recipe
                  has fewer safety checks than a named command.{' '}
                </>
              )}
              {noPath > 0 && (
                <>
                  {noPath} kind{noPath === 1 ? ' has' : 's have'} no way to be built yet.
                </>
              )}
            </p>
          )}
        </div>

        {families.map((f) => (
          <section key={f} className="space-y-2">
            <h2 className="section-title">{f}</h2>
            <div className="card divide-y divide-slate-800/60">
              {kinds
                .filter((k) => k.family === f)
                .map((k) => (
                  <div key={k.kind} id={'k-' + k.kind} className="px-4 py-2.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 scroll-mt-32">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100">{k.label}</div>
                      <div className="text-xs text-slate-500 break-words">{k.description}</div>
                      {k.status_note && (
                        <div className={'text-[11px] break-words ' + (k.status === 'locked' ? 'text-amber-400/80' : 'text-slate-500')}>{k.status_note}</div>
                      )}
                      <div className="text-[11px] text-slate-500 break-words">
                        pinned to: {k.target_need ? TARGET_NEED_LABEL[k.target_need] : 'not set (either is accepted)'}
                        {k.target_need_by ? ' · set by ' + k.target_need_by : ''}
                      </div>
                      {isApprover && (
                        <form action={setKindTargetNeed} className="flex flex-wrap items-center gap-2 mt-1">
                          <input type="hidden" name="kind" value={k.kind} />
                          <select name="target_need" defaultValue={k.target_need || 'any'} className="field !w-auto !py-1 text-xs" aria-label={'Pinned to, for ' + k.label}>
                            {TARGET_NEEDS.map((n) => (
                              <option key={n} value={n}>
                                {TARGET_NEED_LABEL[n]}
                              </option>
                            ))}
                          </select>
                          <button className="btn-secondary-sm">Save</button>
                        </form>
                      )}
                      {ruleNumbers(k.params).length > 0 && (
                        <div className="mt-1 space-y-1">
                          {k.params_note && <div className="text-[11px] text-slate-500 break-words">{k.params_note}</div>}
                          {ruleNumbers(k.params).map((n) => (
                            <div key={n.key} className="text-[11px] break-words">
                              <span className={n.value === null ? 'text-amber-400/80' : 'text-slate-300'}>
                                {n.label}: {n.value === null ? 'no value yet' : String(n.value) + (n.unit ? ' ' + n.unit : '')}
                              </span>
                              <span className="text-slate-500">
                                {n.value === null
                                  ? ' · waiting for ' + names + ' to type it'
                                  : k.params_by
                                    ? ' · set by ' + k.params_by
                                    : ''}
                              </span>
                              {isApprover && (
                                <form action={setKindNumber} className="flex flex-wrap items-center gap-2 mt-1">
                                  <input type="hidden" name="kind" value={k.kind} />
                                  <input type="hidden" name="param" value={n.key} />
                                  <input
                                    name="value"
                                    type="number"
                                    step="any"
                                    min="0"
                                    defaultValue={n.value === null ? '' : n.value}
                                    className="field !w-24 !py-1 text-xs"
                                    aria-label={n.label + (n.unit ? ' in ' + n.unit : '') + ', for ' + k.label}
                                  />
                                  {n.unit && <span className="text-[11px] text-slate-500">{n.unit}</span>}
                                  <button className="btn-secondary-sm">{n.value === null ? 'Set' : 'Save'}</button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {k.recipe && (
                        <div className="text-[11px] text-slate-400 break-words">
                          {k.backing === 'recipe' ? 'Recipe: ' : 'Recipe found, not adopted: '}
                          {k.recipe.summary}
                          {(k.recipe.receipts || []).map((rc, i) => (
                            <div key={i} className="text-slate-500">
                              ran on {rc.project}, {rc.date}: {rc.check} <span className="font-mono text-slate-600">({rc.script})</span>
                            </div>
                          ))}
                          {!k.recipe.proven && k.recipe.proven_note && <div className="text-amber-400/80">Not proven: {k.recipe.proven_note}.</div>}
                        </div>
                      )}
                      {(k.bridge_commands || []).length > 0 && (
                        <div className="text-[11px] text-slate-600 break-words">
                          bridge: {(k.bridge_commands || []).map((c) => c.replace('revit.', '')).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Pill tone={k.status === 'locked' ? 'green' : 'gold'}>{k.status === 'locked' ? 'locked' : 'draft'}</Pill>
                      {k.backing === 'recipe' && <Pill tone="outline">recipe</Pill>}
                      {k.backing === 'recipe' && k.recipe?.proven && <Pill tone="green">proven</Pill>}
                      {k.backing === 'unmapped' && <Pill tone="outline">no way yet</Pill>}
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
