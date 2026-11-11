export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { acceptLesson, dismissLesson, proposeLesson, retireLesson } from '@/app/lessons-actions'
import {
  approverNames,
  kindLabel,
  LESSON_KINDS,
  loadApprovers,
  loadLessons,
  proposerLabel,
  whoLabel,
  type Approver,
  type Lesson,
} from '@/lib/lessons'
import { BlueprintHeader } from '@/components/blueprint-header'
import { Pill } from '@/components/pill'

// BLUEPRINT · LESSONS — the ledger of what Blueprint has learned.
// Blueprint proposes. Only an approver accepts, dismisses or retires. Blueprint works from the
// accepted list and nothing else.

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

function Meta({ l, approvers }: { l: Lesson; approvers: Approver[] }) {
  return (
    <div className="text-[11px] text-slate-500 break-words">
      Proposed by {proposerLabel(l, approvers)} · {day(l.created_at)}
      {l.project_name ? ' · ' + l.project_name : ''}
      {l.source_ref ? ' · ' + l.source_ref : ''}
    </div>
  )
}

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    approvers,
    lessons,
  ] = await Promise.all([supabase.auth.getUser(), loadApprovers(supabase), loadLessons(supabase)])
  const isApprover = !!user && approvers.some((a) => a.user_id === user.id)
  const names = approverNames(approvers)

  const proposed = lessons.filter((l) => l.status === 'proposed')
  const accepted = lessons
    .filter((l) => l.status === 'accepted')
    .sort((a, b) => ((a.accepted_at || '') < (b.accepted_at || '') ? 1 : -1))
  const closed = lessons.filter((l) => l.status === 'dismissed' || l.status === 'retired')

  return (
    <main>
      <BlueprintHeader active="lessons" toAccept={proposed.length} />

      <div className="app-container py-8 space-y-10 max-w-4xl">
        <p className="text-sm text-slate-400 leading-relaxed">
          Blueprint proposes what it has learned. Only {names} can accept, dismiss or retire a lesson. Blueprint works
          from the accepted list and nothing else.
          {!isApprover && <span className="block mt-1 text-slate-500">You are signed in without approval rights, so this page is read-only for decisions.</span>}
        </p>

        {err && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err}</div>}

        {/* TO ACCEPT */}
        <section className="space-y-3">
          <h2 className="section-title">To accept ({proposed.length})</h2>
          {proposed.map((l) => (
            <div key={l.id} id={'l-' + l.id} className="card scroll-mt-24 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 text-base font-semibold text-white break-words">{l.title}</div>
                  <Pill tone="outline">{kindLabel(l.kind)}</Pill>
                </div>
                {l.what_happened && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">What happened</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap break-words mt-0.5">{l.what_happened}</div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    What Blueprint would do from now on
                  </div>
                  <div className="text-sm text-slate-100 whitespace-pre-wrap break-words mt-0.5">{l.proposed_rule}</div>
                </div>
                <Meta l={l} approvers={approvers} />
              </div>

              {isApprover ? (
                <div className="border-t border-bh-border bg-bh-black/30 p-4 grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <form action={acceptLesson} className="space-y-2">
                    <input type="hidden" name="lesson_id" value={l.id} />
                    <label className="block text-[11px] text-slate-500">
                      Rule as accepted — reword it if you want
                      <textarea name="accepted_rule" required rows={3} defaultValue={l.proposed_rule} className="field mt-1" />
                    </label>
                    <input name="decision_note" placeholder="Note — optional" className="field" />
                    <button className="btn-success-sm">Accept</button>
                  </form>
                  <form action={dismissLesson} className="space-y-2">
                    <input type="hidden" name="lesson_id" value={l.id} />
                    <label className="block text-[11px] text-slate-500">
                      Or dismiss it — say why
                      <textarea name="decision_note" required rows={3} placeholder="Why this is not a rule to keep" className="field mt-1" />
                    </label>
                    <button className="btn-secondary-sm">Dismiss</button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-bh-border px-4 py-3 text-xs text-slate-500">Waiting on {names} to accept or dismiss.</div>
              )}
            </div>
          ))}
          {proposed.length === 0 && (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              Nothing is waiting to be accepted.
            </div>
          )}

          <details>
            <summary className="btn-secondary-sm cursor-pointer">+ Add a lesson yourself</summary>
            <form action={proposeLesson} className="card p-4 mt-2 grid gap-3 text-sm">
              <input name="title" required maxLength={200} placeholder="The lesson in one line" className="field" />
              <textarea name="what_happened" rows={2} placeholder="What happened — optional" className="field" />
              <textarea name="proposed_rule" required rows={2} placeholder="What Blueprint should do from now on" className="field" />
              <div className="flex flex-wrap items-center gap-3">
                <select name="kind" defaultValue="process" className="field !w-auto" aria-label="What it is about">
                  {LESSON_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <button className="btn-primary-sm">Add to the list above</button>
                <span className="text-[11px] text-slate-600">It still has to be accepted by {names}.</span>
              </div>
            </form>
          </details>
        </section>

        {/* ACCEPTED */}
        <section className="space-y-3">
          <div>
            <h2 className="section-title">Accepted ({accepted.length})</h2>
            <p className="text-xs text-slate-600 mt-1">These are what Blueprint works from.</p>
          </div>
          {accepted.length > 0 && (
            <div className="card divide-y divide-slate-800/60">
              {accepted.map((l) => (
                <div key={l.id} id={'l-' + l.id} className="px-4 py-3 scroll-mt-24">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 text-sm text-slate-100 whitespace-pre-wrap break-words">{l.accepted_rule}</div>
                    <Pill tone="green">accepted</Pill>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 break-words">{l.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1 break-words">
                    Accepted by {whoLabel(l.decided_by_email, approvers)} · {day(l.accepted_at)}
                    {l.accepted_rule !== l.proposed_rule ? ' · reworded on accept' : ''}
                    {l.decision_note ? ' · “' + l.decision_note + '”' : ''}
                    {' · proposed by ' + proposerLabel(l, approvers)}
                    {l.project_name ? ' · ' + l.project_name : ''}
                  </div>
                  {isApprover && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-slate-600 hover:text-gold-light">Retire</summary>
                      <form action={retireLesson} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="lesson_id" value={l.id} />
                        <input name="decision_note" required placeholder="Why it no longer applies" className="field flex-1 min-w-[220px]" />
                        <button className="btn-secondary-sm">Retire this lesson</button>
                      </form>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
          {accepted.length === 0 && (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              No lesson has been accepted yet.
            </div>
          )}
        </section>

        {/* DISMISSED + RETIRED */}
        {closed.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-gold-light">
              Dismissed and retired ({closed.length})
            </summary>
            <div className="card divide-y divide-slate-800/60 mt-2">
              {closed.map((l) => (
                <div key={l.id} id={'l-' + l.id} className="px-4 py-3 scroll-mt-24">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 text-sm text-slate-400 break-words">{l.title}</div>
                    <Pill tone="neutral">{l.status}</Pill>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap break-words">{l.accepted_rule || l.proposed_rule}</div>
                  <div className="text-[11px] text-slate-500 mt-1 break-words">
                    {l.status === 'retired' ? 'Retired' : 'Dismissed'} by {whoLabel(l.decided_by_email, approvers)} · {day(l.decided_at)}
                    {l.decision_note ? ' · “' + l.decision_note + '”' : ''}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  )
}
