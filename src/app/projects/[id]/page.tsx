export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createStandardRooms, setProjectStatus } from '@/app/actions'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const REVIEW_STYLES: Record<string, string> = {
  unreviewed: 'bg-red-900/60 text-red-300',
  defaults_accepted: 'bg-amber-900/60 text-amber-300',
  confirmed: 'bg-emerald-900/60 text-emerald-300',
}

const STATUSES = ['intake', 'review', 'locked', 'building', 'done']

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('intent_projects')
    .select('id, name, client, status, emitted_version')
    .eq('id', id)
    .single()
  if (!project) notFound()

  const [{ data: rooms }, { data: counts }] = await Promise.all([
    supabase.from('intent_rooms').select('*').eq('project_id', id).order('sort_order'),
    supabase
      .from('intent_decisions')
      .select('room_id, status')
      .eq('project_id', id)
      .eq('status', 'active'),
  ])

  const [{ count: openCount }, { count: unassignedImgs }] = await Promise.all([
    supabase
      .from('intent_open_questions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .is('answer', null),
    supabase
      .from('intent_inspo_images')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .is('room_id', null)
      .eq('parked', false),
  ])

  const decisionsByRoom = new Map<string, number>()
  for (const d of counts || []) {
    const k = d.room_id || 'HOUSE'
    decisionsByRoom.set(k, (decisionsByRoom.get(k) || 0) + 1)
  }

  const confirmed = rooms?.filter((r) => r.review_state === 'confirmed').length || 0
  const total = rooms?.length || 0

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 hover:text-white text-sm transition-colors">
              ← Projects
            </Link>
            <span className="text-lg font-bold">{project.name}</span>
            <span className="text-xs text-slate-400">{project.client}</span>
          </div>
          <div className="flex items-center gap-2">
            {STATUSES.map((s) => (
              <form key={s} action={setProjectStatus.bind(null, id, s)}>
                <button
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 transition-colors ${
                    project.status === s
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              </form>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-slate-400">
            Room board —{' '}
            <span className={total && confirmed === total ? 'text-emerald-400' : 'text-amber-400'}>
              {confirmed}/{total} confirmed
            </span>
            {openCount ? <span className="text-red-400"> · {openCount} open questions</span> : null}
            {unassignedImgs ? <span className="text-red-400"> · {unassignedImgs} unassigned images</span> : null}
            <span className="text-slate-600"> · every room must be confirmed before Lock &amp; Emit</span>
          </div>
          <div className="flex items-center gap-2">
            {total === 0 && (
              <form action={createStandardRooms.bind(null, id)}>
                <button className="bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                  Generate room set (B1–B18 + HOUSE)
                </button>
              </form>
            )}
            {total > 0 && (
              <>
                <Link
                  href={`/projects/${id}/images`}
                  className="text-sm bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 transition-colors"
                >
                  Image pool
                </Link>
                <Link
                  href={`/projects/${id}/emit`}
                  className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-4 py-2 transition-colors"
                >
                  Lock &amp; Emit{project.emitted_version ? ` (v${project.emitted_version})` : ''}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {rooms?.map((r) => (
            <Link
              key={r.id}
              href={`/projects/${id}/rooms/${r.id}`}
              className="group bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-500">{r.section_code}</span>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                    REVIEW_STYLES[r.review_state]
                  }`}
                >
                  {r.review_state.replace('_', ' ')}
                </span>
              </div>
              <div className="text-sm font-medium group-hover:text-amber-400 transition-colors">
                {r.name}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {decisionsByRoom.get(r.id) || 0} active decisions
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
