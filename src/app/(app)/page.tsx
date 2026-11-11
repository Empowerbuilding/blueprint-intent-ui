export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { loadOverview, type ProjectOverview } from '@/lib/overview'
import { summariseChecks, ago, type CheckSummary } from '@/lib/outline-summary'
import { Pill } from '@/components/pill'
import { PageHeader } from '@/components/page-header'

// INBOX — everything waiting on a person, across all projects, grouped by project.
// One card per project that needs you: the single next step, plus the individual
// outlines and blocking questions behind it. Projects waiting on Blueprint are
// listed underneath so nothing looks forgotten.

const TONE_TEXT: Record<CheckSummary['visionTone'], string> = {
  red: 'text-red-400',
  gold: 'text-amber-400',
  green: 'text-emerald-400',
  blue: 'text-sky-400',
  neutral: 'text-slate-500',
}

const MAX_ROWS = 8

function ProjectCard({ o, now }: { o: ProjectOverview; now: number }) {
  const { project, progress } = o
  const roomById = new Map(o.rooms.map((r) => [r.id, r]))
  const roomLabel = (id: string | null) => {
    const r = id ? roomById.get(id) : null
    return r ? r.section_code + ' ' + r.name : 'House-level'
  }
  const pending = o.outlines.filter((x) => x.status === 'pushed')
  const blocking = o.openQuestions.filter((q) => q.blocking)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={'/projects/' + project.id} className="text-base font-semibold text-white hover:text-gold-light transition-colors">
              {project.name}
            </Link>
            <Pill tone="outline">{progress.currentLabel}</Pill>
            {progress.stale && <Pill tone="red">contract out of date</Pill>}
          </div>
          <div className="text-xs text-slate-500 mt-1">{progress.next.detail}</div>
        </div>
        <Link href={progress.next.href} className="btn-primary shrink-0">
          {progress.next.label} →
        </Link>
      </div>

      {pending.length > 0 && (
        <div className="border-t border-bh-border px-4 py-3">
          <div className="section-title mb-2">2D outlines to review ({pending.length})</div>
          <div className="divide-y divide-slate-800/60">
            {pending.slice(0, MAX_ROWS).map((x) => {
              const c = summariseChecks(x.checks, now)
              return (
                <Link
                  key={x.id}
                  href={'/projects/' + project.id + '/rooms/' + x.room_id + '?view=2d#o-' + x.id}
                  className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <span className="min-w-0 text-slate-200 group-hover:text-gold-light transition-colors">
                    {roomLabel(x.room_id)}
                    <span className="text-slate-500">
                      {' '}
                      · {x.outline_type}
                      {x.label ? ' “' + x.label + '”' : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs shrink-0">
                    <span className={TONE_TEXT[c.mathTone]}>{c.mathText}</span>
                    <span className={TONE_TEXT[c.visionTone]}>{c.visionText}</span>
                    <span className="text-slate-600">{ago(x.pushed_at, now)}</span>
                  </span>
                </Link>
              )
            })}
          </div>
          {pending.length > MAX_ROWS && (
            <div className="text-xs text-slate-600 pt-2">+ {pending.length - MAX_ROWS} more in this project</div>
          )}
        </div>
      )}

      {blocking.length > 0 && (
        <div className="border-t border-bh-border px-4 py-3">
          <div className="section-title mb-2">Blocking questions ({blocking.length})</div>
          <div className="divide-y divide-slate-800/60">
            {blocking.slice(0, MAX_ROWS).map((q) => (
              <Link
                key={q.id}
                href={
                  q.room_id
                    ? '/projects/' + project.id + '/rooms/' + q.room_id + '?view=decide#questions'
                    : '/projects/' + project.id
                }
                className="group block py-2 text-sm"
              >
                <span className="text-slate-500">{roomLabel(q.room_id)} — </span>
                <span className="text-slate-200 group-hover:text-gold-light transition-colors">{q.question}</span>
                {q.default_if_unanswered && (
                  <span className="block text-xs text-slate-600 mt-0.5">Default if unanswered: {q.default_if_unanswered}</span>
                )}
              </Link>
            ))}
          </div>
          {blocking.length > MAX_ROWS && (
            <div className="text-xs text-slate-600 pt-2">+ {blocking.length - MAX_ROWS} more in this project</div>
          )}
        </div>
      )}
    </div>
  )
}

export default async function InboxPage() {
  const all = await loadOverview()
  const now = Date.now()
  const onYou = all.filter((o) => o.progress.next.who === 'you')
  const onBlueprint = all.filter((o) => o.progress.next.who === 'blueprint')
  const complete = all.filter((o) => o.progress.next.who === 'nobody')

  return (
    <main>
      <PageHeader eyebrow="Everything waiting on a person" title="Inbox">
        <Link href="/projects" className="btn-secondary">
          All projects
        </Link>
      </PageHeader>

      <div className="app-container py-8 space-y-10 max-w-5xl">
        <section className="space-y-4">
          <h2 className="section-title">Waiting on you ({onYou.length})</h2>
          {onYou.map((o) => (
            <ProjectCard key={o.project.id} o={o} now={now} />
          ))}
          {onYou.length === 0 && (
            <div className="text-sm text-slate-500 border border-dashed border-bh-border rounded-xl p-10 text-center">
              {all.length === 0 ? (
                <>
                  No projects yet.{' '}
                  <Link href="/projects" className="text-gold-light hover:text-gold">
                    Create one →
                  </Link>
                </>
              ) : (
                'Nothing is waiting on you.'
              )}
            </div>
          )}
        </section>

        {onBlueprint.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Waiting on Blueprint ({onBlueprint.length})</h2>
            <div className="card divide-y divide-slate-800/60">
              {onBlueprint.map((o) => (
                <Link
                  key={o.project.id}
                  href={'/projects/' + o.project.id}
                  className="group flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-slate-200 group-hover:text-gold-light transition-colors">
                      {o.project.name}
                    </span>
                    <span className="text-slate-500"> — {o.progress.next.label}</span>
                    <span className="block text-xs text-slate-600 mt-0.5">{o.progress.next.detail}</span>
                  </span>
                  <Pill tone="blue">{o.progress.currentLabel}</Pill>
                </Link>
              ))}
            </div>
          </section>
        )}

        {complete.length > 0 && (
          <section className="space-y-3">
            <h2 className="section-title">Complete ({complete.length})</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {complete.map((o) => (
                <Link key={o.project.id} href={'/projects/' + o.project.id} className="btn-secondary-sm">
                  {o.project.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
