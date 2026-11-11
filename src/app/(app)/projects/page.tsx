export const dynamic = 'force-dynamic'

import { fmtDate, viewerTimeZone } from '@/lib/time'
import Link from 'next/link'
import { createProject } from '@/app/actions'
import { loadOverview } from '@/lib/overview'
import { Pill } from '@/components/pill'
import { PageHeader } from '@/components/page-header'
import { WhoPill } from '@/components/progress-tracker'

// PROJECTS — every project with where it stands and what is next (both derived
// from the data). Create here; delete from the project's own page.

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; files_left?: string }>
}) {
  const { deleted, files_left } = await searchParams
  const tz = await viewerTimeZone()
  const all = await loadOverview()

  return (
    <main>
      <PageHeader title="Projects">
        <details className="relative">
          <summary className="btn-primary cursor-pointer list-none">+ New project</summary>
          <form
            action={createProject}
            className="absolute right-0 top-11 z-30 card p-4 w-80 space-y-3 shadow-2xl shadow-black/60"
          >
            <input name="name" required placeholder="Project name (e.g. Whitaker)" className="field" />
            <input name="client" placeholder="Client (optional)" className="field" />
            <button type="submit" className="btn-primary w-full">
              Create
            </button>
          </form>
        </details>
      </PageHeader>

      <div className="app-container py-8 space-y-6">
        {deleted && (
          <div className="bg-emerald-950/40 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">
            Project “{deleted}” was deleted.
            {files_left ? (
              <span className="block text-amber-300 mt-1">
                {files_left} stored image file(s) could not be removed and are still in storage.
              </span>
            ) : null}
          </div>
        )}

        {all.length === 0 && (
          <div className="text-slate-500 text-sm border border-dashed border-bh-border rounded-xl p-12 text-center">
            No projects yet. Create one — Blueprint then pushes the room board from the model scan.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {all.map(({ project, progress }) => (
            <Link
              key={project.id}
              href={'/projects/' + project.id}
              className="group card p-5 hover:border-gold/50 transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <span className="text-base font-semibold text-white group-hover:text-gold-light transition-colors leading-snug">
                  {project.name}
                </span>
                <Pill tone={progress.current === 'done' ? 'green' : 'outline'}>{progress.currentLabel}</Pill>
              </div>
              <div className="text-sm text-slate-400 mb-4">{project.client || '—'}</div>

              {/* five-dot progress */}
              <div className="flex items-center gap-1.5 mb-4" aria-label={'Stage: ' + progress.currentLabel}>
                {progress.steps.map((s) => (
                  <span
                    key={s.key}
                    title={s.label + ' — ' + s.detail}
                    className={
                      'h-1.5 flex-1 rounded-full ' +
                      (s.state === 'done' ? 'bg-emerald-600/70' : s.state === 'current' ? 'bg-gold' : 'bg-bh-border')
                    }
                  />
                ))}
              </div>

              <div className="mt-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <WhoPill who={progress.next.who} />
                  {progress.stale && <Pill tone="red">contract out of date</Pill>}
                </div>
                <div className="text-sm text-slate-200 mt-2">{progress.next.label}</div>
                <div className="text-xs text-slate-600 mt-2">
                  Created{' '}
                  {fmtDate(project.created_at, tz)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
