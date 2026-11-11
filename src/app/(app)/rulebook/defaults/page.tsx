export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { addDefault, saveDefault, toggleDefault } from '@/app/defaults-actions'
import { DEFAULTS, loadDefaultRows, SCOPES, type DefaultChange, type DefaultRow } from '@/lib/defaults'
import { approverNames, loadApprovers, whoLabel } from '@/lib/lessons'
import { fmtDate, fmtDateTime, viewerTimeZone } from '@/lib/time'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'
import Link from 'next/link'

// RULEBOOK · DEFAULTS — what gets built when nobody decided otherwise.
// The list lives in the database. Anyone signed in can read it; only an approver can change it.
// A default is never deleted: it is turned off, and every change is kept with who and when.

const scopeLabel = (s: string | null) => SCOPES.find((x) => x.key === s)?.label || s || ''

function ScopeSelect({ value }: { value: string }) {
  return (
    <select name="scope" defaultValue={value} className="field !w-auto" aria-label="Where it applies">
      {SCOPES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  )
}

export default async function DefaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; saved?: string; edit?: string }>
}) {
  const { err, saved, edit } = await searchParams
  const tz = await viewerTimeZone()
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    approvers,
    loaded,
    { data: historyRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    loadApprovers(supabase),
    loadDefaultRows(supabase),
    supabase
      .from('intent_defaults_history')
      .select('id, default_id, topic, action, old_value, new_value, old_scope, new_scope, note, changed_by_email, changed_at')
      .order('changed_at', { ascending: false })
      .limit(40),
  ])
  const isApprover = !!user && approvers.some((a) => a.user_id === user.id)
  const names = approverNames(approvers)
  const history = (historyRows || []) as DefaultChange[]

  // the table could not be read: show the built-in list, read-only, and say so
  const unreadable = loaded === null
  const rows: DefaultRow[] =
    loaded ??
    DEFAULTS.map((d, i) => ({ ...d, id: 'builtin-' + i, active: true, sort_order: i, updated_by_email: null, updated_at: null }))
  const on = rows.filter((r) => r.active)
  const off = rows.filter((r) => !r.active)
  const canEdit = isApprover && !unreadable
  const groups = SCOPES.map((s) => ({ scope: s, rows: on.filter((d) => d.scope === s.key) })).filter((g) => g.rows.length)

  return (
    <main>
      <RulebookHeader active="defaults" />
      <div className="app-container py-8 space-y-8 max-w-5xl">
        <div className="space-y-2">
          <p className="text-sm text-slate-400 leading-relaxed">
            When a room has no decision on a topic, Blueprint builds the value listed here. To change it for one room
            only, open the room and use <span className="text-slate-200">Override</span> on that line. To change it for
            every project from now on, change it here.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {canEdit
              ? 'You can change this list. Every change is kept below with who and when, and Blueprint is told.'
              : 'Only ' + names + ' can change this list.'}{' '}
            This list is the one Blueprint builds from. The D1 → D2 runbook under Standards also describes defaults in
            words; where the two differ, this list wins.
          </p>
        </div>

        {unreadable && (
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
            The saved list could not be read, so this is the list built into the app. It cannot be changed until the
            saved list is back.
          </div>
        )}
        {err && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err}</div>}
        {saved && (
          <div className="bg-emerald-950/40 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">
            Saved: {saved}. Rooms that have no decision on it now show the new default. Blueprint has been told.
          </div>
        )}

        {canEdit && (
          <details>
            <summary className="btn-secondary-sm cursor-pointer">+ Add a default</summary>
            <form action={addDefault} className="card p-4 mt-2 grid gap-3 text-sm">
              <input name="topic" required maxLength={60} placeholder="Topic (e.g. pantry shelving)" className="field" />
              <textarea name="value" required rows={2} placeholder="What gets built when nobody decides" className="field" />
              <div className="flex flex-wrap items-center gap-3">
                <ScopeSelect value="house" />
                <input name="note" placeholder="Why — optional" className="field flex-1 min-w-[200px]" />
                <button className="btn-primary-sm">Add default</button>
              </div>
            </form>
          </details>
        )}

        {groups.map((g) => (
          <section key={g.scope.key} className="space-y-3">
            <h2 className="section-title">
              {g.scope.label} <span className="text-slate-600">({g.rows.length})</span>
            </h2>
            <div className="card divide-y divide-slate-800/60">
              {g.rows.map((d) => (
                <div key={d.id} id={'d-' + d.id} className="px-4 py-2.5 text-sm scroll-mt-24">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 break-words">
                      <span className="font-mono text-xs text-slate-500 mr-2">{d.topic}</span>
                      <span className="text-slate-300">{d.value}</span>
                    </div>
                    <span className="flex items-center gap-3 shrink-0">
                      {canEdit && edit !== d.id && (
                        <Link href={'/rulebook/defaults?edit=' + d.id + '#d-' + d.id} className="text-[11px] text-slate-600 hover:text-gold-light">
                          Change
                        </Link>
                      )}
                      <Pill tone="outline">default</Pill>
                    </span>
                  </div>
                  {d.updated_by_email && (
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      changed by {whoLabel(d.updated_by_email, approvers)} · {fmtDate(d.updated_at, tz)}
                    </div>
                  )}
                  {canEdit && edit === d.id && (
                    <div className="mt-2 rounded-lg border border-bh-border bg-bh-black/40 p-3 space-y-3">
                      <form action={saveDefault} className="grid gap-3">
                        <input type="hidden" name="default_id" value={d.id} />
                        <label className="text-[11px] text-slate-500">
                          What gets built for “{d.topic}” when nobody decides
                          <textarea name="value" required rows={2} defaultValue={d.value} className="field mt-1" />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <ScopeSelect value={d.scope} />
                          <input name="note" placeholder="Why — optional" className="field flex-1 min-w-[200px]" />
                          <button className="btn-primary-sm">Save default</button>
                          <Link href={'/rulebook/defaults#d-' + d.id} className="text-[11px] text-slate-500 hover:text-gold-light">
                            Cancel
                          </Link>
                        </div>
                      </form>
                      <form action={toggleDefault} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-bh-border pt-3">
                        <input type="hidden" name="default_id" value={d.id} />
                        <button className="btn-secondary-sm">Turn this default off</button>
                        <span className="text-[11px] text-slate-600">
                          Nothing is built by default for it any more. It stays listed below and can be turned back on.
                        </span>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {on.length === 0 && (
          <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
            No default is in force.
          </div>
        )}

        {off.length > 0 && (
          <section id="off" className="space-y-3 scroll-mt-24">
            <h2 className="section-title">
              Turned off <span className="text-slate-600">({off.length})</span>
            </h2>
            <div className="card divide-y divide-slate-800/60">
              {off.map((d) => (
                <div key={d.id} id={'d-' + d.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <div className="min-w-0 break-words text-slate-500">
                    <span className="font-mono text-xs mr-2">{d.topic}</span>
                    <span className="line-through">{d.value}</span>
                    <span className="ml-2 text-[11px]">({scopeLabel(d.scope)})</span>
                  </div>
                  {canEdit && (
                    <form action={toggleDefault} className="shrink-0">
                      <input type="hidden" name="default_id" value={d.id} />
                      <button className="text-[11px] text-slate-500 underline hover:text-gold-light">Turn back on</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="section-title">Changes</h2>
          {history.length > 0 ? (
            <div className="card divide-y divide-slate-800/60">
              {history.map((h) => (
                <div key={h.id} className="px-4 py-2.5 text-xs">
                  <div className="text-slate-300 break-words">
                    <span className="font-mono text-slate-500 mr-2">{h.topic}</span>
                    {h.action === 'added' && <>added: {h.new_value}</>}
                    {h.action === 'changed' && (
                      <>
                        <span className="line-through text-slate-500">{h.old_value}</span> → {h.new_value}
                        {h.old_scope !== h.new_scope ? ' (' + scopeLabel(h.old_scope) + ' → ' + scopeLabel(h.new_scope) + ')' : ''}
                      </>
                    )}
                    {h.action === 'turned_off' && <>turned off (was: {h.old_value})</>}
                    {h.action === 'turned_on' && <>turned back on: {h.new_value}</>}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 break-words">
                    {whoLabel(h.changed_by_email, approvers)} · {fmtDateTime(h.changed_at, tz)}
                    {h.note ? ' · “' + h.note + '”' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              No change yet. The list is as it was when it moved into the app.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
