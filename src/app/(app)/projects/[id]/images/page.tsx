import { createClient } from '@/lib/supabase/server'
import { assignImageForm } from '@/app/emit-actions'
import UploadInspo from '@/components/UploadInspo'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/intent-inspo/${path}`
}

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('intent_projects')
    .select('id, name')
    .eq('id', id)
    .single()
  if (!project) notFound()

  const [{ data: images }, { data: rooms }] = await Promise.all([
    supabase.from('intent_inspo_images').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('intent_rooms').select('id, section_code, name').eq('project_id', id).order('sort_order'),
  ])

  const roomName = new Map((rooms || []).map((r) => [r.id, `${r.section_code} ${r.name}`]))
  const unassigned = (images || []).filter((i) => !i.room_id && !i.parked)
  const parked = (images || []).filter((i) => !i.room_id && i.parked)
  const assigned = (images || []).filter((i) => i.room_id)

  type InspoImg = { id: string; storage_path: string; notes: string | null; room_id: string | null; parked: boolean; tags: string[] | null }
  const card = (img: InspoImg, state: 'unassigned' | 'parked' | 'assigned') => (
    <div
      key={img.id}
      className={`card overflow-hidden ${
        state === 'unassigned' ? 'border-amber-900/50' : state === 'assigned' ? 'border-emerald-900/40' : ''
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={publicUrl(img.storage_path)} alt={img.notes || 'inspo'} className="w-full h-40 object-cover" />
      <div className="p-3 space-y-2">
        <div className="text-xs text-slate-500">
          {state === 'assigned'
            ? `→ ${roomName.get(img.room_id!) || 'room'}`
            : state === 'parked'
              ? 'Parked — explicitly not used'
              : 'Unassigned — blocks Lock & Emit'}
        </div>
        {(img.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(img.tags as string[]).slice(0, 6).map((t) => (
              <span key={t} className="text-[10px] bg-bh-border/60 text-slate-400 rounded-full px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </div>
        )}
        {img.notes && <div className="text-[11px] text-slate-400 leading-snug">{img.notes}</div>}
        <form action={assignImageForm} className="flex gap-2">
          <input type="hidden" name="image_id" value={img.id} />
          <input type="hidden" name="project_id" value={id} />
          <select
            name="room_id"
            defaultValue={img.room_id ?? (img.parked ? 'PARK' : '')}
            className="field flex-1 !px-2 !py-1.5 !text-xs"
          >
            <option value="">— unassigned —</option>
            <option value="PARK">Park (not used)</option>
            {(rooms || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.section_code} · {r.name}
              </option>
            ))}
          </select>
          <button className="btn-secondary-sm">Set</button>
        </form>
      </div>
    </div>
  )

  const grid = (children: React.ReactNode) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  )

  return (
    <main>
      <PageHeader back={`/projects/${id}`} backLabel={project.name} title="Inspo Images">
        <UploadInspo projectId={id} />
      </PageHeader>

      <div className="app-container py-8 space-y-10">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Unassigned ({unassigned.length})</h2>
            <span className="text-xs text-slate-600">every image must be assigned or parked before Lock &amp; Emit</span>
          </div>
          {unassigned.length ? (
            grid(unassigned.map((i) => card(i, 'unassigned')))
          ) : (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              All clean — nothing waiting on assignment.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="section-title">Assigned ({assigned.length})</h2>
          {assigned.length ? (
            grid(assigned.map((i) => card(i, 'assigned')))
          ) : (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              Nothing assigned yet.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="section-title">Parked ({parked.length})</h2>
          {parked.length ? (
            grid(parked.map((i) => card(i, 'parked')))
          ) : (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
              Nothing parked.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
