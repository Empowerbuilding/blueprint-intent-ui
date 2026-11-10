export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createStandardRooms, setProjectStatus } from '@/app/actions'
import { Pill, REVIEW_STATE_TONE } from '@/components/pill'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { notFound } from 'next/navigation'

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
    <main>
      <PageHeader
        back="/"
        backLabel="Projects"
        eyebrow={project.client || undefined}
        title={project.name}
      >
        {/* project status control */}
        <div className="flex items-center rounded-lg border border-bh-border overflow-hidden">
          {STATUSES.map((s) => (
            <form key={s} action={setProjectStatus.bind(null, id, s)}>
              <button
                className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  project.status === s
                    ? 'bg-gold text-slate-950'
                    : 'bg-bh-card text-slate-500 hover:text-white'
                }`}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      </PageHeader>

      <div className="app-container py-8">
        {/* summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={total && confirmed === total ? 'green' : 'gold'}>
              {confirmed}/{total} rooms confirmed
            </Pill>
            {openCount ? (
              <Link href={`/projects/${id}`}>
                <Pill tone="red">{openCount} open questions</Pill>
              </Link>
            ) : null}
            {unassignedImgs ? (
              <Link href={`/projects/${id}/images`}>
                <Pill tone="red">{unassignedImgs} unassigned images</Pill>
              </Link>
            ) : null}
            <span className="text-xs text-slate-600">
              every room must be confirmed before Lock &amp; Emit
            </span>
          </div>
          <div className="flex items-center gap-2">
            {total === 0 && (
              <form action={createStandardRooms.bind(null, id)}>
                <button className="btn-secondary">
                  Generate room set (B1–B18 + HOUSE)
                </button>
              </form>
            )}
            {total > 0 && (
              <>
                <Link href={`/projects/${id}/images`} className="btn-secondary">
                  Image pool
                </Link>
                <Link href={`/projects/${id}/emit`} className="btn-primary">
                  Lock &amp; Emit{project.emitted_version ? ` (v${project.emitted_version})` : ''}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* room cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rooms?.map((r) => {
            const o = outlinesByRoom.get(r.id)
            return (
              <Link
                key={r.id}
                href={`/projects/${id}/rooms/${r.id}`}
                className="group card p-4 hover:border-gold/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-mono text-slate-500">{r.section_code}</span>
                  <Pill tone={REVIEW_STATE_TONE[r.review_state] || 'neutral'}>
                    {r.review_state.replace('_', ' ')}
                  </Pill>
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
                  {r.source === 'model_scan' ? (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-sky-400">model</span>
                    </>
                  ) : null}
                  {o ? (
                    <>
                      <span className="text-slate-700">·</span>
                      <span
                        className={o.pending ? 'text-amber-400' : 'text-violet-300'}
                        title="2D outlines approved / total"
                      >
                        2D {o.approved}/{o.approved + o.pending}
                      </span>
                    </>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
