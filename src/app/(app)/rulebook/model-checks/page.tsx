export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { decideModelRule, proposeModelRule, setModelRuleNumber } from '@/app/model-rules-actions'
import { CHECKER_LABEL, loadModelRules, missingNumbers, ruleNumbers, type ModelRule } from '@/lib/model-rules'
import { approverNames, loadApprovers, whoLabel } from '@/lib/lessons'
import { fmtDate, viewerTimeZone } from '@/lib/time'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'

// RULEBOOK · MODEL CHECKS — the checks run on the built model at the end of each build phase.
// Blueprint proposes; only an approver accepts or retires. Only accepted checks are attached to
// work items in the typed contract. A check with no checker written yet is a name, not a test.

function Row({ r, isApprover, tz, who }: { r: ModelRule; isApprover: boolean; tz: string; who: (email: string | null) => string }) {
  const kinds = r.kinds || []
  // the numbers the check carries (a tolerance). An approver can change one while the check is proposed or accepted.
  // A number with no value yet (null) is waiting for an approver to type it: the check cannot pass or be accepted without it.
  const numbers = ruleNumbers(r.params)
  const waiting = numbers.filter((n) => n.value === null)
  const canEdit = isApprover && r.status !== 'retired'
  return (
    <div id={'r-' + r.rule_key} className="px-4 py-3 scroll-mt-32">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="text-sm text-slate-100 break-words">{r.description}</div>
          <div className="font-mono text-[11px] text-gold-light/80 break-all">{r.rule_key}</div>
          <div className="text-[11px] text-slate-500 break-words">
            {kinds.length ? 'attached to: ' + kinds.join(', ') : 'attached to a build phase, not to a kind of work'}
            {' · '}
            <span className={r.checker_status === 'none' ? 'text-amber-400/80' : ''}>
              {CHECKER_LABEL[r.checker_status]}
              {r.checker && r.checker_status !== 'none' ? ': ' + r.checker : ''}
            </span>
            {r.source ? ' · from ' + r.source : ''}
          </div>
          {numbers.map((n) =>
            canEdit ? (
              <form key={n.key} action={setModelRuleNumber} className="flex flex-wrap items-center gap-2 mt-1">
                <input type="hidden" name="rule_id" value={r.id} />
                <input type="hidden" name="param" value={n.key} />
                <label htmlFor={'n-' + r.id + '-' + n.key} className="text-[11px] text-slate-400">
                  {n.label}
                </label>
                <input
                  id={'n-' + r.id + '-' + n.key}
                  name="value"
                  type="number"
                  step="any"
                  min="0"
                  required
                  defaultValue={n.value === null ? '' : n.value}
                  placeholder={n.value === null ? 'no value yet' : undefined}
                  className="field !w-24 !py-1 text-xs"
                />
                {n.unit && <span className="text-[11px] text-slate-500">{n.unit}</span>}
                <button className="btn-secondary-sm">Save number</button>
              </form>
            ) : n.value === null ? (
              <div key={n.key} className="text-[11px] text-amber-400/80 mt-1">
                {n.label}: no value yet
              </div>
            ) : (
              <div key={n.key} className="text-[11px] text-slate-400 mt-1">
                {n.label}: {n.value}
                {n.unit ? ' ' + n.unit : ''}
              </div>
            ),
          )}
          {waiting.length > 0 && (
            <div className="text-[11px] text-amber-400/80 break-words mt-1">
              Waiting for a number ({waiting.map((n) => n.label.toLowerCase()).join(', ')}): nothing written gives it, so none was filled in.{' '}
              {canEdit ? 'Type it and save it, then accept the check.' : 'Mitch or Michael type it.'} Until then the check cannot pass and is not
              accepted.
            </div>
          )}
          {(r.params_at || numbers.some((n) => n.value !== null)) && (
            <div className="text-[11px] text-slate-600 break-words">
              {r.params_at ? 'number set by ' + who(r.params_by) + ' · ' + fmtDate(r.params_at, tz) : 'starting value; nobody has changed the number'}
            </div>
          )}
          {r.decided_at && (
            <div className="text-[11px] text-slate-600 break-words">
              {r.status} by {who(r.decided_by_email)} · {fmtDate(r.decided_at, tz)}
              {r.decision_note ? ' — “' + r.decision_note + '”' : ''}
            </div>
          )}
          {/* a check put back to proposed because its meaning changed: nobody has decided on it, the note says why it is here */}
          {!r.decided_at && r.decision_note && <div className="text-[11px] text-amber-400/80 break-words mt-1">{r.decision_note}</div>}
          {/* a wording edit that kept the acceptance: what changed */}
          {r.change_note && <div className="text-[11px] text-slate-500 break-words mt-1">Last edit: {r.change_note}</div>}
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
  const waitingForNumber = rules.filter((r) => r.status !== 'retired' && missingNumbers(r.params).length > 0).length

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
          <p className="text-xs text-slate-500">
            Where a check carries a number, such as a tolerance, {isApprover ? 'you can change it here' : names + ' can change it here'}. Blueprint is
            told, and a work order compiled with the old number has to be compiled again.
            {waitingForNumber > 0 &&
              ' ' +
                waitingForNumber +
                (waitingForNumber === 1 ? ' check waits' : ' checks wait') +
                ' for a number nobody has written down yet: it is typed here before the check is accepted.'}
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
