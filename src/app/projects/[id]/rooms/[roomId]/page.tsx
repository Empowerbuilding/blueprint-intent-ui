export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import {
  addDecision,
  addOpenQuestion,
  addRedlineNote,
  resolveOpen,
  setReviewState,
} from '@/app/actions'
import { approveOutline, rejectOutline, rerunOutlineChecks, set2dApproved } from '@/app/outlines-actions'
import { defaultsForRoom } from '@/lib/defaults'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const SOURCE_LABEL: Record<string, string> = {
  transcript: 'transcript',
  redline: 'redline',
  inspo: 'inspo',
  default: 'DEFAULT',
  manual: 'manual',
}

const NOTE_TYPES = ['beam', 'cabinet_run', 'delete', 'move', 'keep', 'note']

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roomId: string }>
  searchParams: Promise<{ err2d?: string }>
}) {
  const { id, roomId } = await params
  const { err2d } = await searchParams
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('intent_rooms')
    .select('id, project_id, section_code, name, review_state, area_sf, model_state, source')
    .eq('id', roomId)
    .single()
  if (!room || room.project_id !== id) notFound()

  const { data: project } = await supabase
    .from('intent_projects')
    .select('name')
    .eq('id', id)
    .single()

  const [{ data: decisions }, { data: opens }, { data: redlines }, { data: images }, { data: outlines }] = await Promise.all([
    supabase
      .from('intent_decisions')
      .select('*')
      .eq('room_id', roomId)
      .order('topic')
      .order('created_at', { ascending: false }),
    supabase.from('intent_open_questions').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('intent_redline_notes').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('intent_inspo_images').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('intent_outlines').select('*').eq('room_id', roomId).order('pushed_at', { ascending: false }),
  ])

  const defaults = defaultsForRoom(room.section_code, room.name)
  const decidedTopics = new Set((decisions || []).filter((d) => d.status === 'active').map((d) => d.topic))
  const openDefaults = defaults.filter((d) => !decidedTopics.has(d.topic))

  // group by topic: active first, superseded under it
  const byTopic = new Map<string, typeof decisions>()
  for (const d of decisions || []) {
    const list = byTopic.get(d.topic) || []
    list.push(d)
    byTopic.set(d.topic, list)
  }

  const openUnresolved = opens?.filter((o) => !o.answer) || []

  const activeOutlines = (outlines || []).filter((o) => o.status === 'pushed' || o.status === 'approved')
  const rejectedOutlines = (outlines || []).filter((o) => o.status === 'rejected')
  const supersededCount = (outlines || []).filter((o) => o.status === 'superseded').length
  const pendingOutlines = activeOutlines.filter((o) => o.status === 'pushed')
  const visionRunning = activeOutlines.some(
    (o) => (o.checks as { vision?: { status?: string } } | null)?.vision?.status === 'running'
  )

  return (
    <div className="min-h-screen bg-bh-black text-white">
      {visionRunning && <meta httpEquiv="refresh" content="30" />}
      <header className="border-b border-bh-border bg-bh-panel/70">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${id}`}
              className="text-slate-500 hover:text-white text-sm transition-colors"
            >
              ← {project?.name}
            </Link>
            <span className="text-lg font-bold">
              <span className="font-mono text-xs text-slate-500 mr-2">{room.section_code}</span>
              {room.name}
            </span>
          </div>
          <div className="flex gap-2">
            {(['unreviewed', 'defaults_accepted', 'confirmed'] as const).map((s) => (
              <form key={s} action={setReviewState.bind(null, roomId, id, s)}>
                <button
                  className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 transition-colors ${
                    room.review_state === s
                      ? 'bg-gold text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              </form>
            ))}
            {room.review_state === 'confirmed' && (
              <form action={set2dApproved.bind(null, roomId, id)}>
                <button
                  title="Requires: room confirmed + every pushed outline reviewed (approved or rejected)"
                  className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border border-violet-500/60 text-violet-300 hover:bg-violet-950/60 transition-colors"
                >
                  2d approved →
                </button>
              </form>
            )}
            {room.review_state === '2d_approved' && (
              <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-violet-900/70 text-violet-300 border border-violet-500/60">
                ✓ 2d approved
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {err2d && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">
            Can&apos;t set 2D approved: {err2d}
          </div>
        )}

        {/* 2D OUTLINES (orthographic stage — pushed by Blueprint after emit) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            2D outlines ({activeOutlines.length} active{pendingOutlines.length ? ` · ${pendingOutlines.length} awaiting review` : ''})
            {rejectedOutlines.length ? <span className="text-red-400"> · {rejectedOutlines.length} rejected</span> : null}
            {supersededCount ? <span className="text-slate-600"> · {supersededCount} superseded</span> : null}
          </h2>

          <div className="space-y-4">
            {activeOutlines.map((o) => {
              const math = (o.checks?.math || null) as {
                ran_at?: string
                rulebook_version?: number | null
                passed?: boolean
                results?: { rule_key: string; description: string; status: string; measured?: string; required?: string; detail?: string }[]
              } | null
              const vision = (o.checks?.vision || null) as {
                ran_at?: string
                status?: string
                error?: string
                skipped?: string
                results?: { topic: string; verdict: string; note?: string }[]
              } | null
              const mathFails = math?.results?.filter((r) => r.status === 'fail') || []
              const mathPass = math?.results?.filter((r) => r.status === 'pass') || []
              const geoElements = Array.isArray((o.geometry as { elements?: unknown[] } | null)?.elements)
                ? (o.geometry as { elements: unknown[] }).elements.length
                : 0
              return (
                <div key={o.id} className="bg-bh-card border border-bh-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-950/60 text-violet-300 rounded-full px-2 py-0.5">
                        {o.outline_type}
                      </span>
                      {o.label && <span className="text-sm text-slate-300">{o.label}</span>}
                      <span className="text-[10px] text-slate-600">
                        {geoElements} elements · pushed {new Date(o.pushed_at).toLocaleString()}{o.pushed_by ? ` by ${o.pushed_by}` : ''}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                        o.status === 'approved' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-gold-light'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  {o.storage_path && (
                    <a
                      href={`${SUPABASE_URL}/storage/v1/object/public/intent-outlines/${o.storage_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden border border-bh-border mb-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/intent-outlines/${o.storage_path}`}
                        alt={`${o.outline_type} ${o.label}`}
                        className="w-full max-h-72 object-contain bg-bh-black"
                      />
                    </a>
                  )}

                  {/* math gate */}
                  <div className="text-xs mb-2">
                    <span className={math ? (mathFails.length ? 'text-red-400' : 'text-emerald-400') : 'text-slate-600'}>
                      Math gate: {math ? (mathFails.length ? `${mathFails.length} FAIL / ${mathPass.length} pass` : `${mathPass.length} pass`) : 'not run'}
                      {math?.rulebook_version ? <span className="text-slate-600"> (rulebook v{math.rulebook_version})</span> : null}
                    </span>
                  </div>
                  {math?.results?.length ? (
                    <details className="mb-3 text-xs">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-300">rule results</summary>
                      <div className="mt-2 space-y-1">
                        {math.results.map((r) => (
                          <div key={r.rule_key} className="flex items-start gap-2">
                            <span className={r.status === 'fail' ? 'text-red-400' : r.status === 'pass' ? 'text-emerald-400' : 'text-slate-600'}>
                              {r.status === 'fail' ? '✗' : r.status === 'pass' ? '✓' : '–'}
                            </span>
                            <span className="text-slate-400">
                              {r.description}
                              {r.status !== 'na' && r.measured ? <span className="text-slate-300"> — {r.measured}{r.required ? ` (need ${r.required})` : ''}</span> : null}
                              {r.detail ? <span className="text-slate-600"> · {r.detail}</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {/* vision gate */}
                  <div className="text-xs mb-2">
                    {vision?.status === 'ok' ? (
                      <span className="text-slate-400">
                        Vision gate:{' '}
                        <span className="text-emerald-400">{vision.results?.filter((v) => v.verdict === 'confirmed').length || 0} confirmed</span>
                        {' / '}
                        <span className="text-amber-400">{vision.results?.filter((v) => v.verdict === 'missing').length || 0} missing</span>
                        {' / '}
                        <span className="text-red-400">{vision.results?.filter((v) => v.verdict === 'conflict').length || 0} conflict</span>
                      </span>
                    ) : vision?.status === 'running' ? (
                      <span className="text-sky-400 animate-pulse">Vision gate: running… (GLM-4.6v — page refreshes while it works)</span>
                    ) : (
                      <span className="text-slate-600">Vision gate: {vision?.status === 'skipped' ? vision.skipped : vision?.error || 'not run'}</span>
                    )}
                  </div>
                  {vision?.results?.length ? (
                    <details className="mb-3 text-xs">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-300">decision verdicts</summary>
                      <div className="mt-2 space-y-1">
                        {vision.results.map((v, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span
                              className={
                                v.verdict === 'confirmed'
                                  ? 'text-emerald-400'
                                  : v.verdict === 'conflict'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                              }
                            >
                              {v.verdict === 'confirmed' ? '✓' : v.verdict === 'conflict' ? '✗' : '?'}
                            </span>
                            <span className="text-slate-400">
                              <span className="font-mono text-[10px] text-slate-500">{v.topic}</span>
                              {v.note ? ` — ${v.note}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {/* actions */}
                  <div className="flex flex-wrap gap-2 items-start">
                    {o.status === 'pushed' && (
                      <>
                        <form action={approveOutline}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="room_id" value={roomId} />
                          <input type="hidden" name="outline_id" value={o.id} />
                          <button className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors">
                            ✓ Approve 2D
                          </button>
                        </form>
                        <form action={rejectOutline} className="flex gap-2 flex-1 min-w-[240px]">
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="room_id" value={roomId} />
                          <input type="hidden" name="outline_id" value={o.id} />
                          <input
                            name="feedback"
                            required
                            placeholder="Reject — what to change (wakes Blueprint to redraft)"
                            className="flex-1 bg-bh-black border border-bh-border rounded-lg px-3 py-1.5 text-xs"
                          />
                          <button className="bg-red-900/70 hover:bg-red-800 text-red-100 font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors">
                            ✗ Reject
                          </button>
                        </form>
                      </>
                    )}
                    <form action={rerunOutlineChecks}>
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="room_id" value={roomId} />
                      <input type="hidden" name="outline_id" value={o.id} />
                      <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs transition-colors">
                        ↻ re-run checks
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}

            {rejectedOutlines.map((o) => (
              <div key={o.id} className="bg-bh-panel/40 border border-red-900/40 rounded-xl p-4 opacity-80">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-950/60 text-violet-300 rounded-full px-2 py-0.5">{o.outline_type}</span>
                  {o.label && <span className="text-slate-400 line-through">{o.label}</span>}
                  <span className="text-[9px] font-bold uppercase text-red-300 bg-red-950/60 rounded-full px-2 py-0.5">rejected</span>
                  <span className="text-slate-600">{new Date(o.pushed_at).toLocaleString()}</span>
                </div>
                <div className="text-xs text-red-300/90">“{o.feedback}”</div>
              </div>
            ))}

            {!outlines?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
                No 2D outlines pushed yet. After Lock &amp; Emit, Blueprint drafts zone maps + elevations and pushes
                them here — math + vision gates run automatically, then you approve.
              </div>
            )}
          </div>
        </section>
        {/* CURRENT MODEL STATE (from intake scan) */}
        {(room.area_sf || (room.model_state && Object.keys(room.model_state).length > 0)) && (
          <section>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Current model state{' '}
              {room.source === 'model_scan' && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-sky-300 bg-sky-950/60 rounded-full px-2 py-0.5 ml-1">from intake scan</span>
              )}
            </h2>
            <div className="bg-sky-950/30 border border-sky-900/40 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {room.area_sf ? (
                <div>
                  <div className="text-xs text-slate-500">Area</div>
                  <div className="font-semibold">{Math.round(room.area_sf)} SF</div>
                </div>
              ) : null}
              {Object.entries((room.model_state || {}) as Record<string, unknown>).map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-slate-500">{k.replace(/_/g, ' ')}</div>
                  <div className="font-semibold">{String(v)}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Snapshot pushed by the model scan at intake — decisions above change this; this is what exists now.
            </p>
          </section>
        )}

        {/* DECISIONS */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Decisions ({[...(decisions || [])].filter((d) => d.status === 'active').length} active)
          </h2>

          <div className="space-y-4 mb-4">
            {[...byTopic.entries()].map(([topic, list]) => {
              const active = list!.filter((d) => d.status === 'active')
              const superseded = list!.filter((d) => d.status === 'superseded')
              return (
                <div key={topic} className="bg-bh-card border border-bh-border rounded-xl p-4">
                  <div className="text-xs font-mono text-slate-500 mb-2">{topic}</div>
                  {active.map((d) => (
                    <div key={d.id} className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-sm">{d.value}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500">
                          {SOURCE_LABEL[d.source] || d.source}
                          {d.source_ref ? ` · ${d.source_ref}` : ''}
                        </span>
                        {d.meeting_date && (
                          <span className="text-[10px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">
                            {d.meeting_date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {superseded.map((d) => (
                    <div key={d.id} className="text-xs text-slate-600 line-through">
                      {d.value}
                      <span className="ml-2 no-underline">
                        ({d.meeting_date || 'earlier'} · {SOURCE_LABEL[d.source] || d.source})
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
            {!decisions?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
                No decisions captured for this room yet.
              </div>
            )}
          </div>

          <form action={addDecision} className="bg-bh-panel/70 border border-bh-border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <input name="topic" required placeholder="Topic (e.g. ceiling)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-1" />
            <input name="value" required placeholder="Decision (e.g. 12-ft flat, vaulted…)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-1" />
            <select name="source" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2">
              {Object.entries(SOURCE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input name="source_ref" placeholder="Source ref (timestamp / page)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2" />
            <input name="meeting_date" type="date" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2" />
            <button className="bg-gold hover:bg-gold-light-light text-slate-950 font-semibold rounded-lg px-3 py-2 transition-colors">
              Add decision (supersedes previous on same topic)
            </button>
          </form>
        </section>

        {/* DEFAULTS IN EFFECT */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Runbook defaults in effect ({openDefaults.length} topics with no decision → §4 default)
          </h2>
          <div className="bg-bh-panel/70 border border-bh-border rounded-xl divide-y divide-slate-800/60">
            {openDefaults.map((d) => (
              <div key={d.topic} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs text-slate-500 mr-2">{d.topic}</span>
                  <span className="text-slate-300">{d.value}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-800/60 rounded-full px-2 py-0.5 shrink-0">
                  default
                </span>
              </div>
            ))}
            {!openDefaults.length && (
              <div className="px-4 py-3 text-sm text-slate-600">
                Every default topic has an explicit decision above — nothing builds from §4 defaults in this room.
              </div>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Accepting defaults (review-state button up top) means these build as-is. Override any of them by adding a
            decision on that topic above.
          </p>
        </section>

        {/* ASSIGNED IMAGES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Assigned inspo ({images?.length || 0})
            </h2>
            <Link
              href={`/projects/${id}/images`}
              className="text-xs text-gold-light hover:text-gold-light underline"
            >
              manage image pool →
            </Link>
          </div>
          {(images || []).length ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images!.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden border border-bh-border bg-bh-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${SUPABASE_URL}/storage/v1/object/public/intent-inspo/${img.storage_path}`}
                    alt={img.notes || 'inspo'}
                    className="w-full h-28 object-cover"
                  />
                  {img.notes && <div className="text-[10px] text-slate-500 px-2 py-1.5 truncate">{img.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
              No inspo assigned to this room.{' '}
              <Link href={`/projects/${id}/images`} className="text-gold-light underline">
                Assign some →
              </Link>
            </div>
          )}
        </section>

        {/* OPEN QUESTIONS */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Open questions ({openUnresolved.length} unresolved)
          </h2>
          <div className="space-y-3 mb-4">
            {(opens || []).map((o) => (
              <div
                key={o.id}
                className={`border rounded-xl p-4 ${
                  o.answer ? 'border-bh-border bg-bh-panel/50' : 'border-amber-900/50 bg-bh-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm">{o.question}</div>
                  {o.blocking && !o.answer && (
                    <span className="text-[9px] font-bold uppercase text-red-300 bg-red-950/60 rounded-full px-2 py-0.5 shrink-0">
                      blocking
                    </span>
                  )}
                </div>
                {!o.answer && o.default_if_unanswered && (
                  <div className="text-xs text-slate-500 mt-1">
                    Default if unanswered: {o.default_if_unanswered}
                  </div>
                )}
                {o.answer ? (
                  <div className="text-sm text-emerald-400 mt-2">→ {o.answer}</div>
                ) : (
                  <form action={resolveOpen} className="flex gap-2 mt-3">
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="room_id" value={roomId} />
                    <input type="hidden" name="id" value={o.id} />
                    <input
                      name="answer"
                      required
                      placeholder={o.default_if_unanswered ? `Answer (or type the default: ${o.default_if_unanswered})` : 'Answer'}
                      className="flex-1 bg-bh-black border border-bh-border rounded-lg px-3 py-2 text-sm"
                    />
                    <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-sm font-medium">
                      Resolve
                    </button>
                  </form>
                )}
              </div>
            ))}
            {!opens?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                No open questions for this room.
              </div>
            )}
          </div>
          <form action={addOpenQuestion} className="bg-bh-panel/70 border border-bh-border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <input name="question" required placeholder="Question (e.g. floating vanities?)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-2" />
            <input name="default_if_unanswered" placeholder="Default if unanswered" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2" />
            <label className="flex items-center gap-2 text-slate-400 text-xs">
              <input type="checkbox" name="blocking" defaultChecked className="accent-gold" />
              Blocking (must resolve before Lock)
            </label>
            <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 font-medium col-span-2">
              Add open question
            </button>
          </form>
        </section>

        {/* REDLINE NOTES */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Redline notes (typed — from Michael&apos;s D1 markup)
          </h2>
          <div className="space-y-2 mb-4">
            {(redlines || []).map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-bh-card border border-bh-border rounded-lg px-4 py-2 text-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-gold-light rounded px-1.5 py-0.5 shrink-0">
                  {r.note_type.replace('_', ' ')}
                </span>
                <span>{r.text}</span>
                {r.source_ref && <span className="text-xs text-slate-600 ml-auto shrink-0">{r.source_ref}</span>}
              </div>
            ))}
            {!redlines?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                No redline notes for this room.
              </div>
            )}
          </div>
          <form action={addRedlineNote} className="bg-bh-panel/70 border border-bh-border rounded-xl p-4 grid grid-cols-4 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <select name="note_type" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-1">
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
            <input name="text" required placeholder="What the markup means (e.g. beam, not wall)" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-2" />
            <input name="source_ref" placeholder="D1 ref" className="bg-bh-black border border-bh-border rounded-lg px-3 py-2 col-span-1" />
            <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 font-medium col-span-4">
              Add redline note
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
