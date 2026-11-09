import { createClient } from '@/lib/supabase/server'
import { assignImageForm } from '@/app/emit-actions'
import UploadInspo from '@/components/UploadInspo'
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
      className={`rounded-xl overflow-hidden border ${
        state === 'unassigned' ? 'border-red-900/60' : state === 'parked' ? 'border-bh-border' : 'border-emerald-900/50'
      } bg-bh-card`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={publicUrl(img.storage_path)} alt={img.notes || 'inspo'} className="w-full h-40 object-cover" />
      <div className="p-3 space-y-2">
        <div className="text-xs text-slate-500">
          {state === 'assigned'
            ? `→ ${roomName.get(img.room_id!) || 'room'}`
            : state === 'parked'
              ? '🅿️ parked (explicitly not used)'
              : '⚠️ unassigned — blocks Lock & Emit'}
        </div>
        {(img.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(img.tags as string[]).slice(0, 6).map((t) => (
              <span key={t} className="text-[9px] bg-bh-border/60 text-slate-400 rounded-full px-1.5 py-0.5">
                {t.replace('color:', '🎨 ')}
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
            className="flex-1 bg-bh-black border border-bh-border rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">— unassigned —</option>
            <option value="PARK">🅿️ park (not used)</option>
            {(rooms || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.section_code} · {r.name}
              </option>
            ))}
          </select>
          <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium">
            Set
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bh-black text-white">
      <header className="border-b border-bh-border bg-bh-panel/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/projects/${id}`} className="text-slate-500 hover:text-white text-sm transition-colors">
              ← {project.name}
            </Link>
            <span className="text-lg font-bold">Inspo Images</span>
          </div>
          <UploadInspo projectId={id} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">
            Unassigned ({unassigned.length}) — every image must be assigned or parked before Lock &amp; Emit
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {unassigned.map((i) => card(i, 'unassigned'))}
            {!unassigned.length && <div className="text-sm text-slate-600">None — all clean.</div>}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Assigned ({assigned.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {assigned.map((i) => card(i, 'assigned'))}
            {!assigned.length && <div className="text-sm text-slate-600">Nothing assigned yet.</div>}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Parked ({parked.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {parked.map((i) => card(i, 'parked'))}
            {!parked.length && <div className="text-sm text-slate-600">Nothing parked.</div>}
          </div>
        </section>
      </main>
    </div>
  )
}
