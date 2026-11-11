export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { decideModelRule, proposeModelRule } from '@/app/model-rules-actions'
import { CHECKER_LABEL, loadModelRules, type ModelRule } from '@/lib/model-rules'
import { approverNames, loadApprovers, whoLabel } from '@/lib/lessons'
import { fmtDate, viewerTimeZone } from '@/lib/time'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · MODEL CHECKS — the checks run on the built model at the end of each build phase.
// Blueprint proposes; only an approver accepts or retires. Only accepted checks are attached to
// work items in the typed contract. A check with no checker written yet is a name, not a test.

function Row({ r, isApprover, tz, who }: { r: ModelRule; isApprover: boolean; tz: string; who: (email: string | null) => string }) {
  const kinds = r.kinds || []
  return (
    <div id={'r-' + r.rule_key} className="px-4 py-3 scroll-mt-32">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="text-sm text-slate-100 break-words">{r.description}</div>
          <div className="font-mono text-[11px] text-gold-light/80 break-all">{r.rule_key}</div>
          <div className="text-[11px] text-slate-500 break-words">
            {kinds.length ? 'attached to: ' + kinds.join(', ') : 'attached to a build phase, not to a kind of work'}
            {' · '}
            <span className={r.checker_status === 'none' ? 'text-amber-400/80' : ''}>{CHECKER_LABEL[r.checker_status]}</span>
            {r.source ? ' · from ' + r.source : ''}
          </div>
          {r.decided_at && (
            <div className="text-[11px] text-slate-600 break-words">
              {r.status} by {who(r.decided_by_email)} · {fmtDate(r.decided_at, tz)}
              {r.decision_note ? ' — “' + r.decision_note + '”' : ''}
            </div>
          )}
        </div>
        {isApprover && (
          <form action={decideModelRule} className="flex flex-wrap items-center gap-2 shrink-0">
            <input type="hidden" name="rule_id" value={r.id} />
            <input name="note" placeholder="Note — optional" className="field !w-40 !py-1 text-xs" aria-label="Note" />
            {r.status === 'proposed' && (
              <button name="decision" value="accept" className="btn-primary-sm">
                Accept
              </button>
            )}
            {r.status !== 'retired' && (
              <button name="decision" value="retire" className="btn-secondary-sm">
                {r.status === 'proposed' ? 'Dismiss' : 'Retire'}
              </button>
            )}
            {r.status === 'retired' && (
              <button name="decision" value="reopen" className="btn-secondary-sm">
                Put back as proposed
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

export default async function ModelChecksPage({ searchParams }: { searchParams: Promise<{ err?: string; saved?: string }> }) {
  const { err, saved } = await searchParams
  const tz = await viewerTimeZone()
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    approvers,
    loaded,
  ] = await Promise.all([supabase.auth.getUser(), loadApprovers(supabase), loadModelRules(supabase)])
  const isApprover = !!user && approvers.some((a) => a.user_id === user.id)
  const names = approverNames(approvers)
  const who = (email: string | null) => whoLabel(email, approvers)
  const rules = loaded || []
  const proposed = rules.filter((r) => r.status === 'proposed')
  const accepted = rules.filter((r) => r.status === 'accepted')
  const retired = rules.filter((r) => r.status === 'retired')
  const noChecker = rules.filter((r) => r.status !== 'retired' && r.checker_status === 'none').length

  return (
    <main>
      <RulebookHeader active="model-checks" />
      <div className="app-container py-8 max-w-5xl space-y-8">
        {err && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err}</div>}
        {saved && <div className="bg-emerald-950/50 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">Saved: {saved}. Blueprint has been told.</div>}
        {loaded === null && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">The list of model checks could not be read.</div>
        )}

        <div className="text-sm text-slate-400 leading-relaxed space-y-2">
          <p>
            These are checked on the built model at the end of each build phase. {accepted.length} accepted · {proposed.length} to accept ·{' '}
            {retired.length} retired.
          </p>
          <p className="text-xs text-slate-500">
            {isApprover ? 'You can accept, dismiss or retire a check.' : 'Only ' + names + ' can accept or retire a check.'} Only accepted checks
            are attached to work items in the typed contract. {noChecker} of the checks listed have no checker written yet: until one is
            written, the check is a name and proves nothing.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="section-title">
            To accept <span className="text-slate-500 normal-case tracking-normal font-normal">({proposed.length})</span>
          </h2>
          <div className="card divide-y divide-slate-800/60">
            {proposed.map((r) => (
              <Row key={r.id} r={r} isApprover={isApprover} tz={tz} who={who} />
            ))}
            {!proposed.length && <div className="px-4 py-6 text-sm text-slate-600 text-center">Nothing waiting.</div>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="section-title">
            Accepted <span className="text-slate-500 normal-case tracking-normal font-normal">({accepted.length})</span>
          </h2>
          <div className="card divide-y divide-slate-800/60">
            {accepted.map((r) => (
              <Row key={r.id} r={r} isApprover={isApprover} tz={tz} who={who} />
            ))}
            {!accepted.length && (
              <div className="px-4 py-6 text-sm text-slate-600 text-center">
                No check is accepted yet, so no work item carries one. <Pill tone="outline">nothing in force</Pill>
              </div>
            )}
          </div>
        </section>

        {retired.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">
              Retired or dismissed <span className="text-slate-500 normal-case tracking-normal font-normal">({retired.length})</span>
            </h2>
            <div className="card divide-y divide-slate-800/60">
              {retired.map((r) => (
                <Row key={r.id} r={r} isApprover={isApprover} tz={tz} who={who} />
              ))}
            </div>
          </section>
        )}

        <details id="new" className="scroll-mt-32">
          <summary className="btn-secondary-sm cursor-pointer">+ Propose a check</summary>
          <form action={proposeModelRule} className="card p-4 mt-2 grid gap-3 sm:grid-cols-3 text-sm">
            <input name="rule_key" required placeholder="name, e.g. casework.no_overlap" className="field font-mono text-xs" />
            <input name="description" required placeholder="What the check proves, in one sentence" className="field sm:col-span-2" />
            <button className="btn-secondary-sm justify-self-start">Propose — {names} accept</button>
          </form>
        </details>
      </div>
    </main>
  )
}
