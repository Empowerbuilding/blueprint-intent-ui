export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createStandardRooms, setProjectStatus, deleteProject, setProjectProcess } from '@/app/actions'
import { loadProcesses, processOf } from '@/lib/processes'
import { decisionGaps, decisionFreshness } from '@/lib/decision-gaps'
import { loadOverview } from '@/lib/overview'
import { Pill, REVIEW_STATE_TONE } from '@/components/pill'
import { PageHeader } from '@/components/page-header'
import { ProgressTracker, NextStep } from '@/components/progress-tracker'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// PROJECT — where it stands (derived, never set by hand), the one next step,
// then the room board. Delete lives at the bottom behind a typed confirmation.

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ delete_error?: string; process_error?: string; process_saved?: string }>
}) {
  const { id } = await params
  const { delete_error, process_error, process_saved } = await searchParams

  const [overview] = await loadOverview(id)
  if (!overview) notFound()
  const { project, rooms, progress, openQuestions, outlines, unassignedImages, changesSinceLock } = overview

  const supabase = await createClient()
  const { data: decisionRows } = await supabase
    .from('intent_decisions')
    .select('room_id')
    .eq('project_id', id)
    .eq('status', 'active')

  const decisionsByRoom = new Map<string, number>()
  for (const d of (decisionRows || []) as { room_id: string | null }[]) {
    if (d.room_id) decisionsByRoom.set(d.room_id, (decisionsByRoom.get(d.room_id) || 0) + 1)
  }
  const questionsByRoom = new Map<string, { open: number; blocking: number }>()
  for (const q of openQuestions) {
    if (!q.room_id) continue
    const cur = questionsByRoom.get(q.room_id) || { open: 0, blocking: 0 }
    cur.open++
    if (q.blocking) cur.blocking++
    questionsByRoom.set(q.room_id, cur)
  }
  const gaps = await decisionGaps(supabase, id, rooms.map((r) => ({ id: r.id, section_code: r.section_code, name: r.name })))
  const gapsByRoom = new Map(gaps.map((g) => [g.roomId, g]))
  const fresh = await decisionFreshness(supabase, id)

  const outlinesByRoom = new Map<string, { pending: number; approved: number; rejected: number }>()
  for (const o of outlines) {
    const cur = outlinesByRoom.get(o.room_id) || { pending: 0, approved: 0, rejected: 0 }
    if (o.status === 'pushed') cur.pending++
    if (o.status === 'approved') cur.approved++
    if (o.status === 'rejected') cur.rejected++
    outlinesByRoom.set(o.room_id, cur)
  }

  const emitted = project.emitted_version || 0
  const processes = await loadProcesses(supabase)
  const proc = processOf(processes, project.process)
  const status = project.status || ''
  const total = rooms.length

  return (
    <main>
      <PageHeader back="/projects" backLabel="Projects" eyebrow={project.client || undefined} title={project.name}>
        {total > 0 && (
          <>
            <Link href={'/projects/' + id + '/images'} className="btn-secondary">
              Inspo images{unassignedImages ? ' (' + unassignedImages + ' unassigned)' : ''}
            </Link>
            <Link href={'/projects/' + id + '/emit'} className="btn-secondary">
              {emitted ? 'Contract v' + emitted : 'Lock & Emit'}
            </Link>
          </>
        )}
      </PageHeader>

      <div className="app-container py-8 space-y-8">
        {delete_error && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{delete_error}</div>
        )}

        {/* which process this project follows (picks the playbook its work order is set up from) */}
        <section className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Process</span>
              <span className="text-sm font-semibold text-white">{proc.title}</span>
              {proc.status === 'draft' && <Pill tone="outline">draft playbook</Pill>}
            </div>
            {emitted === 0 && processes.length > 1 ? (
              <form action={setProjectProcess.bind(null, id)} className="flex items-center gap-2">
                <select name="process" defaultValue={proc.key} className="field py-1.5 text-sm w-auto" aria-label="Process">
                  {processes.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.title + (p.status === 'draft' ? ' (draft)' : '')}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary">Change process</button>
              </form>
            ) : emitted > 0 ? (
              <span className="text-xs text-slate-500">Set at Lock &amp; Emit; it cannot be changed now.</span>
            ) : null}
          </div>
          {proc.description && <p className="text-sm text-slate-400">{proc.description}</p>}
          {process_saved && <p className="text-sm text-emerald-300">Process saved. Blueprint sets up the work order from this playbook.</p>}
          {process_error && <p className="text-sm text-red-300">{process_error}</p>}
          {proc.status === 'draft' && (
            <p className="text-sm text-amber-300">
              This playbook is a draft: Blueprint cannot compile a work order for it yet.
              {proc.board === 'frame'
                ? ''
                : ' The steps below (room board, Lock & Emit, 2D, build) belong to Draft 1 to Draft 2 and do not describe this process.'}
            </p>
          )}
        </section>

        {/* where it stands + what is next */}
        <section className="card p-5 space-y-5">
          <ProgressTracker progress={progress} />
          <div className="border-t border-bh-border pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <NextStep progress={progress} compact />
            </div>
            {/* a frame process has no rooms: no standard room set to generate */}
            {total === 0 && proc.board !== 'frame' && (
              <form action={createStandardRooms.bind(null, id)}>
                <button className="btn-secondary" title="For a project with no model yet">
                  Generate standard room set (B1–B18 + HOUSE)
                </button>
              </form>
            )}
            {progress.current === 'build' && status !== 'building' && (
              <form action={setProjectStatus.bind(null, id, 'building')}>
                <button className="btn-secondary">Mark build started</button>
              </form>
            )}
            {progress.current === 'build' && status === 'building' && (
              <form action={setProjectStatus.bind(null, id, 'done')}>
                <button className="btn-secondary">Mark build complete</button>
              </form>
            )}
          </div>
          {progress.stale && (
            <div className="bg-red-950/40 border border-red-900/70 rounded-lg px-4 py-3 text-sm text-red-300">
              <span className="font-semibold">Contract v{emitted} is out of date.</span> {changesSinceLock}{' '}
              {changesSinceLock === 1 ? 'item was' : 'items were'} added after it was locked. Blueprint is still working
              from v{emitted} until you re-emit.
            </div>
          )}
        </section>

        {gaps.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-800/70 rounded-lg px-4 py-3 text-sm text-amber-200">
            <span className="font-semibold">Decision gaps: {gaps.length} room{gaps.length === 1 ? '' : 's'} with evidence but no covering decision.</span>{' '}
            {gaps.filter((g) => g.noDecisions).length} have no decisions at all. These are the rooms the 3D build will
            skip pieces in — open the room and add the lines, or leave them out on purpose.{' '}
            <span className="text-amber-400">(2026-11-14 pilot lesson: Bath 3's vanity shipped exactly this way.)</span>
          </div>
        )}
        {fresh.totalStale > 0 && (
          <div className="bg-sky-950/40 border border-sky-800/70 rounded-lg px-4 py-3 text-sm text-sky-200">
            <span className="font-semibold">Decision freshness: {fresh.totalStale} line{fresh.totalStale === 1 ? '' : 's'} from before your latest meeting ({fresh.latestMeeting}) still stand.</span>{' '}
            They carry only because no newer meeting re-mentioned them — confirm or supersede before locking.{' '}
            <span className="text-sky-400">(2026-11-15 pilot lesson: the Master Bath 12×12 windows stood exactly this way.)</span>
          </div>
        )}
        {/* room board */}
        <section className="space-y-4">
          <h2 className="section-title">{proc.board === 'frame' ? 'Frame board' : 'Rooms (' + total + ')'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rooms.map((r) => {
              const o = outlinesByRoom.get(r.id)
              const q = questionsByRoom.get(r.id)
              return (
                <Link
                  key={r.id}
                  href={'/projects/' + id + '/rooms/' + r.id}
                  className="group card p-4 hover:border-gold/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono text-slate-500">{r.section_code}</span>
                    <Pill tone={REVIEW_STATE_TONE[r.review_state] || 'neutral'}>{r.review_state.replace('_', ' ')}</Pill>
                  </div>
                  <div className="text-sm font-medium text-white group-hover:text-gold-light transition-colors mb-3">
                    {r.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{decisionsByRoom.get(r.id) || 0} decisions</span>
                    {gapsByRoom.get(r.id) ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-amber-400 font-medium" title={gapsByRoom.get(r.id)!.missingPieces.join(", ")}>
                          ⚠ {gapsByRoom.get(r.id)!.noDecisions ? "no decisions, evidence exists" : "gap: " + gapsByRoom.get(r.id)!.missingPieces.join(", ")}
                        </span>
                      </>
                    ) : null}
                    {(fresh.staleByRoom.get(r.id) || 0) > 0 ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span
                          className="text-sky-400 font-medium"
                          title={'active lines from before the latest meeting (' + fresh.latestMeeting + ') — standing unconfirmed'}
                        >
                          ↻ {fresh.staleByRoom.get(r.id)} older-word line{(fresh.staleByRoom.get(r.id) || 0) === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null}
                    {r.area_sf ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-400">{Math.round(r.area_sf)} SF</span>
                      </>
                    ) : null}
                    {q ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className={q.blocking ? 'text-red-400' : 'text-slate-400'}>
                          {q.blocking ? q.blocking + ' blocking' : q.open + ' open'} {q.open === 1 ? 'question' : 'questions'}
                        </span>
                      </>
                    ) : null}
                    {o && o.pending + o.approved > 0 ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span
                          className={o.pending ? 'text-amber-400' : 'text-violet-300'}
                          title="2D outlines approved / total"
                        >
                          2D {o.approved}/{o.approved + o.pending}
                          {o.pending ? ' — ' + o.pending + ' to review' : ''}
                        </span>
                      </>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
          {total === 0 && (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-8 text-center">
              {proc.board === 'frame'
                ? "No frame lines yet. Blueprint pushes them from the engineer's set and the open model. This process has no room scan."
                : 'No rooms yet. Blueprint pushes them from the model scan.'}
            </div>
          )}
        </section>

        {/* delete */}
        <section id="delete" className="pt-4">
          <details className="text-sm" open={!!delete_error}>
            <summary className="cursor-pointer text-xs text-slate-600 hover:text-red-300 transition-colors">
              Delete this project…
            </summary>
            <form action={deleteProject} className="mt-3 card border-red-900/50 p-4 space-y-3 max-w-xl">
              <input type="hidden" name="project_id" value={id} />
              <p className="text-slate-400 leading-relaxed">
                This permanently removes the project from this app: its {total} {total === 1 ? 'room' : 'rooms'}, every
                decision, question, redline note, inspo image, 2D outline and emitted contract. It cannot be undone. The
                Revit model and Blueprint&apos;s own project files are not touched.
              </p>
              <label className="block text-xs text-slate-500">
                Type the project name <span className="font-mono text-slate-300">{project.name}</span> to confirm
                <input name="confirm_name" required autoComplete="off" className="field mt-1.5" />
              </label>
              <button className="btn-danger-sm">Delete project permanently</button>
            </form>
          </details>
        </section>
      </div>
    </main>
  )
}
