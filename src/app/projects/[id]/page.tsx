export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createStandardRooms, setProjectStatus } from '@/app/actions'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const REVIEW_STYLES: Record<string, string> = {
  unreviewed: 'bg-red-900/60 text-red-300',
  defaults_accepted: 'bg-amber-900/60 text-gold-light',
  confirmed: 'bg-emerald-900/60 text-emerald-300',
  '2d_approved': 'bg-violet-900/60 text-violet-300',
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

  const [{ count: openCount }, { count: unassignedImgs }, { data: outlineCounts }] = await Promise.all([
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
    supabase
      .from('intent_outlines')
      .select('room_id, status')
      .eq('project_id', id)
      .neq('status', 'superseded'),
  ])

  const outlinesByRoom = new Map<string, { pending: number; approved: number }>()
  for (const o of outlineCounts || []) {
    const cur = outlinesByRoom.get(o.room_id) || { pending: 0, approved: 0 }
    if (o.status === 'pushed') cur.pending++
    if (o.status === 'approved') cur.approved++
    outlinesByRoom.set(o.room_id, cur)
  }

  const decisionsByRoom = new Map<string, number>()
  for (const d of counts || []) {
    const k = d.room_id || 'HOUSE'
    decisionsByRoom.set(k, (decisionsByRoom.get(k) || 0) + 1)
  }

  const confirmed = rooms?.filter((r) => r.review_state === 'confirmed').length || 0
  const total = rooms?.length || 0

  return (
    <div className="min-h-screen bg-bh-black text-white">
      <header className="border-b border-bh-border bg-bh-panel/70">
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
                      ? 'bg-gold text-slate-950'
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
            <span className={total && confirmed === total ? 'text-emerald-400' : 'text-gold-light'}>
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
                  className="text-sm bg-gold hover:bg-gold-light-light text-slate-950 font-semibold rounded-lg px-4 py-2 transition-colors"
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
              className="group bg-bh-card border border-bh-border hover:border-gold/50 rounded-xl p-4 transition-colors"
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
              <div className="text-sm font-medium group-hover:text-gold-light transition-colors">
                {r.name}
              </div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <span>{decisionsByRoom.get(r.id) || 0} decisions</span>
                {r.area_sf ? <span className="text-slate-400">· {Math.round(r.area_sf)} SF</span> : null}
                {r.source === 'model_scan' ? (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-sky-300 bg-sky-950/60 rounded-full px-1.5 py-0.5">model</span>
                ) : null}
                {outlinesByRoom.get(r.id) ? (
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
                      outlinesByRoom.get(r.id)!.pending ? 'text-amber-300 bg-amber-950/60' : 'text-violet-300 bg-violet-950/60'
                    }`}
                    title="2D outlines: approved / awaiting review"
                  >
                    2D {outlinesByRoom.get(r.id)!.approved}/{outlinesByRoom.get(r.id)!.approved + outlinesByRoom.get(r.id)!.pending}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
