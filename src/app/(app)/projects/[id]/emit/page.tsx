import { fmtDateTime, viewerTimeZone } from '@/lib/time'
import { createClient } from '@/lib/supabase/server'
import { emitContract } from '@/app/emit-actions'
import { buildAndEmit, buildV2 } from '@/lib/emit-core'
import { EmitButton } from '@/components/emit-button'
import { loadModelRules } from '@/lib/model-rules'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function EmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; emitted?: string; handoff?: string; v2?: string; same?: string }>
}) {
  const { id } = await params
  const tz = await viewerTimeZone()
  const { error, emitted, handoff, v2: v2Param, same } = await searchParams
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

  // the typed contract (v2): what would be written if the contract were emitted now, or what is missing
  const [{ data: v2Rooms }, { data: v2Decisions }, { data: v2Opens }, { data: v2Redlines }, { data: v2Images }] = await Promise.all([
    supabase.from('intent_rooms').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('intent_decisions').select('*').eq('project_id', id).eq('status', 'active').order('created_at'),
    supabase.from('intent_open_questions').select('*').eq('project_id', id).order('created_at'),
    supabase.from('intent_redline_notes').select('*').eq('project_id', id).order('created_at'),
    supabase.from('intent_inspo_images').select('*').eq('project_id', id),
  ])
  const v2 = await buildV2(supabase, {
    projectId: id,
    name: project.name,
    client: project.client,
    version: (project.emitted_version || 0) + 1,
    emittedAt: new Date().toISOString(),
    rooms: v2Rooms || [],
    activeDecisions: v2Decisions || [],
    opens: v2Opens || [],
    redlines: v2Redlines || [],
    images: v2Images || [],
  })
  // the queue of model checks: only accepted ones are attached to work items, so an empty accepted list means empty phase exits
  const modelRules = await loadModelRules(supabase)
  const checksAccepted = (modelRules || []).filter((m) => m.status === 'accepted').length
  const checksProposed = (modelRules || []).filter((m) => m.status === 'proposed').length
  const roomIdByCode = new Map((rooms || []).map((r) => [r.section_code, r.id]))
  // a gap names its room ("Room 103 Kitchen: ..." / "House-level — ..."): link it there
  const gapHref = (gap: string) => {
    const m = /^Room (\S+) /.exec(gap)
    const roomId = m ? roomIdByCode.get(m[1]) : gap.startsWith('House-level') ? roomIdByCode.get('HOUSE') : undefined
    return roomId ? `/projects/${id}/rooms/${roomId}?view=decide#typing` : null
  }

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

  // Would a press write anything new? A dry run builds what would be emitted now and compares it with the last
  // emission (flag 52). When they are the same the main button is not offered: there is nothing new to emit.
  const nextVersion = (project.emitted_version || 0) + 1
  let current: { version: number; emitted_at: string | null } | null = null
  if (allPass && (project.emitted_version || 0) > 0) {
    const preview = await buildAndEmit(id, null, { dryRun: true, client: supabase })
    current = preview.ok ? preview.unchanged : null
  }
  const told = (handoff || '').startsWith('portal notified')

  const { data: emissions } = await supabase
    .from('intent_emissions')
    .select('id, version, emitted_at, blueprint_status, v2_work_items, v2_errors')
    .eq('project_id', id)
    .order('version', { ascending: false })

  return (
    <main>
      <PageHeader back={`/projects/${id}`} backLabel={project.name} title="Lock & Emit" />

      <div className="app-container py-8 max-w-3xl space-y-8">
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
            <div className="font-semibold">✓ Intent contract v{emitted} emitted and persisted.</div>
            <div className="text-emerald-400/80 mt-1">Handoff: {handoff}</div>
            {told ? (
              <div className="text-emerald-400/80 mt-1">Blueprint has been told, once. There is no need to press again.</div>
            ) : (
              <div className="text-amber-300 mt-1">
                The message to Blueprint may not have gone out (see the handoff line). The contract itself is saved. Tell Blueprint
                in blueprint-mitch, or use &quot;Emit it again anyway&quot; below.
              </div>
            )}
            {v2Param?.startsWith('ok-') && (
              <div className="text-emerald-400/80 mt-1">Typed contract (v2) written too: {v2Param.slice(3)} work items.</div>
            )}
            {v2Param?.startsWith('no-') && (
              <div className="text-amber-300 mt-1">
                Typed contract (v2) was not written: {v2Param.slice(3)} thing{v2Param.slice(3) === '1' ? '' : 's'} missing, listed below. The
                contract above is complete without it.
              </div>
            )}
          </div>
        )}

        {same && (
          <div className="border border-bh-border rounded-xl p-4 text-sm text-slate-300">
            <div className="font-semibold">Nothing new was emitted: contract v{same} already holds exactly this.</div>
            <div className="text-slate-400 mt-1">No new version was written and Blueprint was not messaged a second time.</div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="section-title">Lock Gates</h2>
          {gates.map((g) => (
            <div
              key={g.label}
              className={`card flex items-center justify-between gap-3 p-4 ${
                g.ok ? '' : 'border-red-900/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    g.ok ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                  }`}
                >
                  {g.ok ? '✓' : '✗'}
                </span>
                <span className="text-sm font-medium text-slate-100">{g.label}</span>
              </div>
              <span className="text-xs text-slate-500 text-right shrink-0">{g.detail}</span>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          {current ? (
            <div className="card p-4 text-sm space-y-2">
              <div className="font-medium text-slate-100">Contract v{current.version} is current.</div>
              <div className="text-xs text-slate-400 leading-relaxed">
                Nothing that goes into the contract has changed since it was emitted
                {current.emitted_at ? ' on ' + fmtDateTime(current.emitted_at, tz) : ''}, so there is nothing new to emit. Change a
                room, a decision, a question, a note or a picture and the Lock &amp; Emit button is back.
              </div>
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-300">Emit it again anyway</summary>
                <div className="mt-2 space-y-2">
                  <p className="leading-relaxed">
                    Writes the same contract once more as v{nextVersion} and messages Blueprint a second time. Only needed when the
                    message for v{current.version} did not arrive.
                  </p>
                  <form action={emitContract}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="again" value="1" />
                    <EmitButton
                      label={`Emit the same contract again as v${nextVersion}`}
                      busy={`Emitting contract v${nextVersion}…`}
                      className="btn-secondary"
                    />
                  </form>
                </div>
              </details>
            </div>
          ) : (
            <form action={emitContract}>
              <input type="hidden" name="project_id" value={id} />
              <EmitButton
                enabled={allPass}
                label={allPass ? `Lock & Emit contract v${nextVersion}` : 'Gates not met — finish the review first'}
                busy={`Emitting contract v${nextVersion}…`}
                className={`w-full ${allPass ? 'btn-primary' : 'btn-secondary cursor-not-allowed opacity-50'} !py-3`}
              />
            </form>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">
            Emits the versioned intent contract, locks the project, and hands off to Blueprint in
            blueprint-mitch — it compiles the work order from it. Your in-thread &quot;go&quot; is still
            required before it builds.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            After emit — the 2D-first stage: Blueprint drafts zone maps + elevations and pushes them to
            each room (math + vision gates run automatically). Michael approves or rejects in the room
            cards; rooms go <span className="text-violet-300">2D approved</span>; the work order compiles
            from approved 2D.
          </p>
        </section>

        <section id="typed" className="space-y-3 scroll-mt-24">
          <h2 className="section-title">Typed contract (v2)</h2>
          <div className={`card p-4 text-sm ${v2.ok ? '' : 'border-amber-900/60'}`}>
            {v2.ok ? (
              <div className="text-emerald-300">
                ✓ Nothing missing. Emitting now also writes the typed contract: {v2.work_items} work item{v2.work_items === 1 ? '' : 's'}.
              </div>
            ) : (
              <>
                <div className="text-amber-300 font-medium">
                  {v2.errors.length} thing{v2.errors.length === 1 ? '' : 's'} missing — the typed contract will not be written yet.
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {v2.errors.slice(0, 12).map((e, i) => {
                    const href = gapHref(e)
                    return (
                      <li key={i} className="break-words">
                        •{' '}
                        {href ? (
                          <Link href={href} className="hover:text-gold-light underline decoration-slate-700">
                            {e}
                          </Link>
                        ) : (
                          e
                        )}
                      </li>
                    )
                  })}
                  {v2.errors.length > 12 && <li className="text-slate-600">…and {v2.errors.length - 12} more</li>}
                </ul>
              </>
            )}
            {v2.ok && v2.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {v2.warnings.slice(0, 6).map((w, i) => (
                  <li key={i} className="break-words">
                    Note: {w}
                  </li>
                ))}
                {v2.warnings.length > 6 && <li className="text-slate-600">…and {v2.warnings.length - 6} more notes</li>}
              </ul>
            )}
          </div>
          {modelRules !== null && (
            <div className={`card p-4 text-sm ${checksAccepted === 0 ? 'border-amber-900/60' : ''}`}>
              <div className={checksAccepted === 0 ? 'text-amber-400' : 'text-slate-300'}>
                Model checks: {checksAccepted} accepted, {checksProposed} waiting to be accepted.
              </div>
              <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                Only accepted checks are attached to work items and decide whether a build phase passed.{' '}
                {checksAccepted === 0 ? 'None is accepted yet, so a build from this contract would have nothing to pass. ' : ''}
                Mitch or Michael accept them in the{' '}
                <Link href="/rulebook/model-checks" className="text-gold-light hover:underline">
                  Rulebook, Model checks
                </Link>
                .
              </div>
            </div>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">
            This does not block Lock &amp; Emit. The contract is emitted as it always was; the typed contract is written beside it only
            when every room has a role and a 2D yes/no, and every decision and redline note has a kind of work. Nothing is guessed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="section-title">Emission History</h2>
          <div className="space-y-2">
            {emissions?.map((e) => (
              <div key={e.id} className="card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs bg-slate-800 rounded px-2 py-0.5">v{e.version}</span>
                  <span className="text-slate-500">{fmtDateTime(e.emitted_at, tz)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-gold-light">{e.blueprint_status}</span>
                  <a
                    href={`/api/contract/${id}?version=${e.version}&format=brief`}
                    className="text-slate-400 hover:text-white"
                  >
                    BRIEF.md
                  </a>
                  <a href={`/api/contract/${id}?version=${e.version}`} className="text-slate-400 hover:text-white">
                    intent.json
                  </a>
                  {e.v2_work_items != null ? (
                    <a href={`/api/contract/${id}?version=${e.version}&schema=2`} className="text-slate-400 hover:text-white">
                      typed ({e.v2_work_items})
                    </a>
                  ) : (
                    <span className="text-slate-600">no typed contract</span>
                  )}
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
      </div>
    </main>
  )
}
