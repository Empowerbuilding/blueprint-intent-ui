export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { addGap, closeGap, reopenGap } from '@/app/capabilities-actions'
import { commandNames, commandTable, daysSince, latestPerMachine, loadCapabilities, machineLabel } from '@/lib/capabilities'
import { approverNames, loadApprovers, loadLessons, whoLabel } from '@/lib/lessons'
import { ago } from '@/lib/outline-summary'
import { fmtDate, fmtDateTime, viewerTimeZone } from '@/lib/time'
import { BlueprintHeader } from '@/components/blueprint-header'
import { Pill } from '@/components/pill'

// BLUEPRINT · CAPABILITIES — what the Revit bridge on each machine can do, and what it cannot.
// Everything here is reported by Blueprint from the bridge's own command list each time it connects.
// The app never talks to a bridge.

const STALE_DAYS = 7

export default async function CapabilitiesPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams
  const tz = await viewerTimeZone()
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    approvers,
    lessons,
    { reports, proven, gaps },
  ] = await Promise.all([supabase.auth.getUser(), loadApprovers(supabase), loadLessons(supabase), loadCapabilities(supabase)])
  const isApprover = !!user && approvers.some((a) => a.user_id === user.id)
  const names = approverNames(approvers)

  const machines = latestPerMachine(reports)
  const groups = commandTable(machines, proven)
  const builds = [...new Set(machines.map((m) => m.latest.bridge_build))]
  const uneven = [...groups.values()].flat().filter((c) => c.missingOn.length > 0)
  const open = gaps.filter((g) => g.status === 'open')
  const closed = gaps.filter((g) => g.status === 'closed')
  const proposer = (p: string) => (p === 'blueprint' ? 'Blueprint' : whoLabel(p, approvers))

  return (
    <main>
      <BlueprintHeader active="capabilities" toAccept={lessons.filter((l) => l.status === 'proposed').length} />

      <div className="app-container py-8 space-y-10 max-w-5xl">
        <p className="text-sm text-slate-400 leading-relaxed">
          What the Revit bridge on each machine can do. Blueprint reads this from the bridge itself each time it
          connects and reports it here; the app never talks to a bridge. A command counts as proven only after
          Blueprint has run it on a live model and checked the result.
        </p>
        {err && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err}</div>}

        {/* MACHINES */}
        <section className="space-y-3">
          <h2 className="section-title">Machines</h2>
          {machines.length === 0 ? (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              No report yet. Blueprint sends one the next time it connects to a bridge.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {machines.map((m) => {
                const days = daysSince(m.latest.reported_at)
                return (
                  <div key={m.latest.machine} className="card p-4 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-semibold text-white">{machineLabel(m.latest.machine)}</span>
                      {days > STALE_DAYS ? <Pill tone="gold">not seen lately</Pill> : <Pill tone="green">reported</Pill>}
                    </div>
                    <div className="text-sm text-slate-300">
                      Bridge build <span className="font-mono text-gold-light">{m.latest.bridge_build}</span>
                      {m.latest.revit_version ? ' · Revit ' + m.latest.revit_version : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Last confirmed {ago(m.latest.reported_at)} ({fmtDateTime(m.latest.reported_at, tz)})
                    </div>
                    <div className="text-[11px] text-slate-600">
                      On this build since {fmtDate(m.latest.first_reported_at, tz)}
                      {m.previousBuild ? ' · before that: ' + m.previousBuild : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {builds.length > 1 && (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
              The machines are on different bridge builds ({machines.map((m) => machineLabel(m.latest.machine) + ' ' + m.latest.bridge_build).join(', ')}).
              {uneven.length > 0
                ? ' These commands are not on every machine: ' +
                  uneven.map((c) => c.short + ' (not on ' + c.missingOn.map(machineLabel).join(', ') + ')').join('; ') +
                  '.'
                : ' Their command lists are the same.'}
            </div>
          )}
          {builds.length === 1 && machines.length > 1 && uneven.length === 0 && (
            <div className="text-xs text-slate-500">Every machine is on the same build with the same commands.</div>
          )}
        </section>

        {/* COMMANDS */}
        {machines.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="section-title">Commands</h2>
              <p className="text-xs text-slate-600 mt-1">
                Grouped by what they do. <span className="text-emerald-400">proven</span> = run on a live model and
                checked. No mark = the bridge lists it, but Blueprint has not proven it yet.
              </p>
            </div>
            <div className="card divide-y divide-slate-800/60">
              {[...groups.entries()].map(([group, rows]) => (
                <details key={group} className="px-4 py-2.5">
                  <summary className="cursor-pointer text-sm text-slate-200 hover:text-gold-light">
                    <span className="font-mono">{group}</span>
                    <span className="ml-2 text-[11px] text-slate-600">
                      {rows.some((r) => r.proven) ? (rows.every((r) => r.proven) ? 'all proven' : 'some proven') : 'none proven yet'}
                      {rows.some((r) => r.missingOn.length) ? ' · differs between machines' : ''}
                    </span>
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {rows.map((c) => (
                      <li key={c.name} className="text-xs break-words">
                        <span className="font-mono text-slate-300">{c.short}</span>
                        {c.proven ? (
                          <span className="ml-2 text-emerald-400" title={(c.proven.note || '') + ' · ' + fmtDate(c.proven.proven_at, tz)}>
                            proven
                          </span>
                        ) : null}
                        {c.missingOn.length > 0 && <span className="ml-2 text-amber-400">not on {c.missingOn.map(machineLabel).join(', ')}</span>}
                        {c.proven?.note && <span className="ml-2 text-slate-600">{c.proven.note}</span>}
                        {c.description && <span className="block text-slate-600">{c.description}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
            <p className="text-[11px] text-slate-600">
              Anything not listed here does not exist on any machine, whatever a document says.
              {machines.some((m) => commandNames(m.latest).length === 0) ? ' One machine reported an empty list.' : ''}
            </p>
          </section>
        )}

        {/* GAP LOG */}
        <section id="gaps" className="space-y-3 scroll-mt-24">
          <div>
            <h2 className="section-title">Gap log — open ({open.length})</h2>
            <p className="text-xs text-slate-600 mt-1">
              Things that were needed and could not be done, with what was done instead. Only {names} can close one.
            </p>
          </div>
          {open.map((g) => (
            <div key={g.id} id={'g-' + g.id} className="card scroll-mt-24 overflow-hidden">
              <div className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 text-sm font-semibold text-white break-words">{g.title}</div>
                  <Pill tone="gold">open</Pill>
                </div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap break-words">{g.detail}</div>
                {g.workaround && (
                  <div className="text-xs text-slate-400 break-words">
                    <span className="text-slate-500">Done instead: </span>
                    {g.workaround}
                  </div>
                )}
                <div className="text-[11px] text-slate-500 break-words">
                  Logged by {proposer(g.proposed_by)} · {fmtDate(g.created_at, tz)}
                  {g.project_name ? ' · ' + g.project_name : ''}
                  {g.source_ref ? ' · ' + g.source_ref : ''}
                </div>
              </div>
              {isApprover && (
                <form action={closeGap} className="border-t border-bh-border bg-bh-black/30 px-4 py-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="gap_id" value={g.id} />
                  <input name="close_note" required placeholder="How it was closed (fixed in which build, or why it no longer matters)" className="field flex-1 min-w-[220px]" />
                  <button className="btn-secondary-sm">Close gap</button>
                </form>
              )}
            </div>
          ))}
          {open.length === 0 && (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">No open gap.</div>
          )}

          <details>
            <summary className="btn-secondary-sm cursor-pointer">+ Add a gap yourself</summary>
            <form action={addGap} className="card p-4 mt-2 grid gap-3 text-sm">
              <input name="title" required maxLength={200} placeholder="The gap in one line" className="field" />
              <textarea name="detail" required rows={2} placeholder="What was needed and what happened" className="field" />
              <input name="workaround" placeholder="What was done instead — optional" className="field" />
              <button className="btn-primary-sm justify-self-start">Add gap</button>
            </form>
          </details>

          {closed.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-gold-light">Closed ({closed.length})</summary>
              <div className="card divide-y divide-slate-800/60 mt-2">
                {closed.map((g) => (
                  <div key={g.id} id={'g-' + g.id} className="px-4 py-3 scroll-mt-24">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0 text-sm text-slate-400 break-words">{g.title}</div>
                      <Pill tone="neutral">closed</Pill>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 break-words">
                      Closed by {whoLabel(g.closed_by_email, approvers)} · {fmtDate(g.closed_at, tz)}
                      {g.close_note ? ' · “' + g.close_note + '”' : ''}
                    </div>
                    {isApprover && (
                      <form action={reopenGap} className="mt-1">
                        <input type="hidden" name="gap_id" value={g.id} />
                        <button className="text-[11px] text-slate-500 underline hover:text-gold-light">Reopen</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </div>
    </main>
  )
}
