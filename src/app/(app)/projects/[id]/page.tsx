export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createStandardRooms, setProjectStatus, deleteProject } from '@/app/actions'
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
  searchParams: Promise<{ delete_error?: string }>
}) {
  const { id } = await params
  const { delete_error } = await searchParams

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
  const outlinesByRoom = new Map<string, { pending: number; approved: number; rejected: number }>()
  for (const o of outlines) {
    const cur = outlinesByRoom.get(o.room_id) || { pending: 0, approved: 0, rejected: 0 }
    if (o.status === 'pushed') cur.pending++
    if (o.status === 'approved') cur.approved++
    if (o.status === 'rejected') cur.rejected++
    outlinesByRoom.set(o.room_id, cur)
  }

  const emitted = project.emitted_version || 0
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

        {/* where it stands + what is next */}
        <section className="card p-5 space-y-5">
          <ProgressTracker progress={progress} />
          <div className="border-t border-bh-border pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <NextStep progress={progress} compact />
            </div>
            {total === 0 && (
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

        {/* room board */}
        <section className="space-y-4">
          <h2 className="section-title">Rooms ({total})</h2>
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
              No rooms yet. Blueprint pushes them from the model scan.
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
