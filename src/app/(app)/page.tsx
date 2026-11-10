export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createProject } from '@/app/actions'
import { Pill, PROJECT_STATUS_TONE } from '@/components/pill'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const [{ data: projects }, { count: roomCount }] = await Promise.all([
    supabase
      .from('intent_projects')
      .select('id, name, client, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('intent_rooms').select('id', { count: 'exact', head: true }),
  ])

  return (
    <main>
      {/* page header */}
      <header className="border-b border-bh-border bg-bh-panel/40">
        <div className="app-container py-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Barnhaus · Design Intent
            </div>
            <h1 className="text-xl font-semibold text-white mt-0.5">Projects</h1>
          </div>
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
        </div>
      </header>

      <div className="app-container py-8">
        {(!projects || projects.length === 0) && (
          <div className="text-slate-500 text-sm border border-dashed border-bh-border rounded-xl p-12 text-center">
            No projects yet. Create one — then generate the standard room set from the project page.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group card p-5 hover:border-gold/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-base font-semibold text-white group-hover:text-gold-light transition-colors leading-snug">
                  {p.name}
                </span>
                <Pill tone={PROJECT_STATUS_TONE[p.status] || 'neutral'}>{p.status}</Pill>
              </div>
              <div className="text-sm text-slate-400 mb-4">{p.client || '—'}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>
                  Created{' '}
                  {new Date(p.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-slate-700">·</span>
                <span className="text-slate-500 group-hover:text-slate-400 transition-colors">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
