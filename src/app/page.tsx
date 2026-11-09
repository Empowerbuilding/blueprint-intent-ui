export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createProject, signOut } from '@/app/actions'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  intake: 'bg-slate-800 text-slate-300',
  review: 'bg-amber-900/60 text-amber-300',
  locked: 'bg-emerald-900/60 text-emerald-300',
  building: 'bg-blue-900/60 text-blue-300',
  done: 'bg-slate-700 text-slate-300',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('intent_projects')
    .select('id, name, client, status, created_at')
    .order('created_at', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">Design Intent</span>
            <span className="text-xs text-slate-500 border border-slate-800 rounded-full px-2 py-0.5">
              Work Order UI
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{user?.email}</span>
            <form action={signOut}>
              <button className="text-slate-400 hover:text-white transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <form action={createProject} className="flex gap-2">
            <input
              name="name"
              required
              placeholder="Project name (e.g. Whitaker)"
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <input
              name="client"
              placeholder="Client (optional)"
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
            >
              New project
            </button>
          </form>
        </div>

        {(!projects || projects.length === 0) && (
          <div className="text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl p-10 text-center">
            No projects yet. Create one above — then generate the standard room set from the project page.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold group-hover:text-amber-400 transition-colors">{p.name}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-1 ${
                    STATUS_STYLES[p.status] || STATUS_STYLES.intake
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <div className="text-sm text-slate-400">{p.client || '—'}</div>
              <div className="text-xs text-slate-600 mt-3">
                created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
