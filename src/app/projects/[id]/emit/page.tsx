import { createClient } from '@/lib/supabase/server'
import { emitContract } from '@/app/emit-actions'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function EmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; emitted?: string; handoff?: string }>
}) {
  const { id } = await params
  const { error, emitted, handoff } = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('intent_projects')
    .select('id, name, client, status, emitted_version')
    .eq('id', id)
    .single()
  if (!project) notFound()

  const { data: rooms } = await supabase
    .from('intent_rooms')
    .select('id, section_code, name, review_state')
    .eq('project_id', id)
    .order('sort_order')

  const [{ count: blockingOpen }, { count: unassignedImgs }] = await Promise.all([
    supabase
      .from('intent_open_questions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .eq('blocking', true)
      .is('answer', null),
    supabase
      .from('intent_inspo_images')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .is('room_id', null)
      .eq('parked', false),
  ])

  const unreviewed = (rooms || []).filter((r) => r.review_state === 'unreviewed')
  const confirmed = (rooms || []).filter((r) => r.review_state === 'confirmed').length
  const defaultsAccepted = (rooms || []).filter((r) => r.review_state === 'defaults_accepted').length
  const total = rooms?.length || 0

  const gates = [
    { label: 'All rooms reviewed', ok: unreviewed.length === 0 && total > 0, detail: `${confirmed} confirmed · ${defaultsAccepted} defaults accepted · ${unreviewed.length} unreviewed` },
    { label: 'Blocking open questions answered', ok: (blockingOpen || 0) === 0, detail: `${blockingOpen || 0} unresolved` },
    { label: 'All images assigned or parked', ok: (unassignedImgs || 0) === 0, detail: `${unassignedImgs || 0} unassigned` },
  ]
  const allPass = gates.every((g) => g.ok)

  const { data: emissions } = await supabase
    .from('intent_emissions')
    .select('id, version, emitted_at, blueprint_status')
    .eq('project_id', id)
    .order('version', { ascending: false })

  return (
    <div className="min-h-screen bg-bh-black text-white">
      <header className="border-b border-bh-border bg-bh-panel/70">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={`/projects/${id}`} className="text-slate-500 hover:text-white text-sm transition-colors">
            ← {project.name}
          </Link>
          <span className="text-lg font-bold">Lock &amp; Emit</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">
            <div className="font-semibold mb-1">Emit blocked — gates failed:</div>
            {error.split(' · ').map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
        {emitted && (
          <div className="bg-emerald-950/50 border border-emerald-900 rounded-xl p-4 text-sm text-emerald-300">
            <div className="font-semibold">✅ Intent contract v{emitted} emitted and persisted.</div>
            <div className="text-emerald-400/80 mt-1">Handoff: {handoff}</div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Lock gates</h2>
          {gates.map((g) => (
            <div
              key={g.label}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                g.ok ? 'border-emerald-900/50 bg-bh-card' : 'border-red-900/60 bg-bh-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={g.ok ? 'text-emerald-400' : 'text-red-400'}>{g.ok ? '✓' : '✗'}</span>
                <span className="text-sm font-medium">{g.label}</span>
              </div>
              <span className="text-xs text-slate-500">{g.detail}</span>
            </div>
          ))}
        </section>

        <section>
          <form action={emitContract}>
            <input type="hidden" name="project_id" value={id} />
            <button
              disabled={!allPass}
              className={`w-full rounded-xl px-4 py-3 font-semibold text-sm transition-colors ${
                allPass
                  ? 'bg-gold hover:bg-gold-light-light text-slate-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {allPass
                ? `Lock & Emit contract v${(project.emitted_version || 0) + 1}`
                : 'Gates not met — finish the review first'}
            </button>
          </form>
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Emits <code className="text-slate-400">intent.json</code> + <code className="text-slate-400">BRIEF.md</code> (established
            format), persists the version, sets the project to <code className="text-slate-400">locked</code>, and posts the handoff
            card to blueprint-mitch. Blueprint compiles the work order from it — approval still requires Mitch&apos;s
            in-thread &quot;go&quot;.
          </p>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            After emit — the 2D-first stage: Blueprint drafts zone maps + elevations and pushes them to each room
            (math + vision gates run automatically). Michael approves/rejects in the room cards; rooms go{' '}
            <span className="text-violet-300">2d approved</span>; the work order compiles from approved 2D.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Emission history
          </h2>
          <div className="space-y-2">
            {emissions?.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between bg-bh-card border border-bh-border rounded-lg px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs bg-slate-800 rounded px-2 py-0.5">v{e.version}</span>
                  <span className="text-slate-500">{new Date(e.emitted_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gold-light">{e.blueprint_status}</span>
                  <a
                    href={`/api/contract/${id}?version=${e.version}&format=brief`}
                    className="text-slate-400 hover:text-white underline"
                  >
                    BRIEF.md
                  </a>
                  <a href={`/api/contract/${id}?version=${e.version}`} className="text-slate-400 hover:text-white underline">
                    intent.json
                  </a>
                </div>
              </div>
            ))}
            {!emissions?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                No emissions yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
