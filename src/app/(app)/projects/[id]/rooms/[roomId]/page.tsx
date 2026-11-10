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
import { Pill, REVIEW_STATE_TONE } from '@/components/pill'
import { PageHeader } from '@/components/page-header'
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

const SECTIONS = [
  { id: 'outlines', label: '2D Outlines' },
  { id: 'model', label: 'Model State' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'defaults', label: 'Defaults' },
  { id: 'inspo', label: 'Inspo' },
  { id: 'questions', label: 'Questions' },
  { id: 'redlines', label: 'Redlines' },
]

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
    <div>
      {visionRunning && <meta httpEquiv="refresh" content="30" />}
      <main>
        <PageHeader
          back={`/projects/${id}`}
          backLabel={project?.name}
          eyebrow={room.section_code}
          title={room.name}
        >
          {/* review-state control */}
          <div className="flex items-center rounded-lg border border-bh-border overflow-hidden">
            {(['unreviewed', 'defaults_accepted', 'confirmed'] as const).map((s) => (
              <form key={s} action={setReviewState.bind(null, roomId, id, s)}>
                <button
                  title={
                    s === 'defaults_accepted'
                      ? 'Room builds from runbook §4 defaults as-is'
                      : s === 'confirmed'
                        ? 'Every decision reviewed and confirmed'
                        : 'Not reviewed yet'
                  }
                  className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    room.review_state === s
                      ? 'bg-gold text-slate-950'
                      : 'bg-bh-card text-slate-500 hover:text-white'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              </form>
            ))}
          </div>
          {room.review_state === 'confirmed' && (
            <form action={set2dApproved.bind(null, roomId, id)}>
              <button
                title="Requires: room confirmed + every pushed outline reviewed (approved or rejected)"
                className="btn-secondary-sm border-violet-500/60 text-violet-300 hover:bg-violet-950/60"
              >
                2D approved →
              </button>
            </form>
          )}
          {room.review_state === '2d_approved' && <Pill tone="violet">✓ 2d approved</Pill>}
        </PageHeader>

        {/* sticky section nav */}
        <nav className="sticky top-16 z-30 border-b border-bh-border bg-bh-black/90 backdrop-blur">
          <div className="app-container py-2.5 flex items-center gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-bh-card transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="app-container py-8 space-y-12 max-w-5xl">
          {err2d && (
            <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">
              Can&apos;t set 2D approved: {err2d}
            </div>
          )}

          {/* 2D OUTLINES */}
          <section id="outlines" className="scroll-mt-28 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="section-title">2D Outlines</h2>
              <span className="text-xs text-slate-500">
                {activeOutlines.length} active
                {pendingOutlines.length ? ` · ${pendingOutlines.length} awaiting review` : ''}
              </span>
              {rejectedOutlines.length ? <Pill tone="red">{rejectedOutlines.length} rejected</Pill> : null}
              {supersededCount ? (
                <span className="text-xs text-slate-600">{supersededCount} superseded</span>
              ) : null}
            </div>

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
                  <div key={o.id} className="card p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Pill tone="violet">{o.outline_type}</Pill>
                        {o.label && <span className="text-sm text-slate-300 truncate">{o.label}</span>}
                        <span className="text-[11px] text-slate-600 whitespace-nowrap">
                          {geoElements} elements · pushed{' '}
                          {new Date(o.pushed_at).toLocaleString()}
                          {o.pushed_by ? ` by ${o.pushed_by}` : ''}
                        </span>
                      </div>
                      <Pill tone={o.status === 'approved' ? 'green' : 'gold'}>{o.status}</Pill>
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
                      <span className={math ? (mathFails.length ? 'text-red-400' : math?.passed === null ? 'text-slate-400' : 'text-emerald-400') : 'text-slate-600'}>
                        Math gate:{' '}
                        {math
                          ? mathFails.length
                            ? `${mathFails.length} FAIL / ${mathPass.length} pass`
                            : mathPass.length
                              ? `${mathPass.length} pass`
                              : 'not measured — no rules applied to this geometry (eye review)'
                          : 'not run'}
                        {math?.rulebook_version ? (
                          <span className="text-slate-600"> (rulebook v{math.rulebook_version})</span>
                        ) : null}
                      </span>
                    </div>
                    {math?.results?.length ? (
                      <details className="mb-3 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
                          rule results
                        </summary>
                        <div className="mt-2 space-y-1">
                          {math.results.map((r) => (
                            <div key={r.rule_key} className="flex items-start gap-2">
                              <span
                                className={
                                  r.status === 'fail' ? 'text-red-400' : r.status === 'pass' ? 'text-emerald-400' : 'text-slate-600'
                                }
                              >
                                {r.status === 'fail' ? '✗' : r.status === 'pass' ? '✓' : '–'}
                              </span>
                              <span className="text-slate-400">
                                {r.description}
                                {r.status !== 'na' && r.measured ? (
                                  <span className="text-slate-300">
                                    {' '}
                                    — {r.measured}
                                    {r.required ? ` (need ${r.required})` : ''}
                                  </span>
                                ) : null}
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
                          <span className="text-emerald-400">
                            {vision.results?.filter((v) => v.verdict === 'confirmed').length || 0} confirmed
                          </span>
                          {' / '}
                          <span className="text-amber-400">
                            {vision.results?.filter((v) => v.verdict === 'missing').length || 0} missing
                          </span>
                          {' / '}
                          <span className="text-red-400">
                            {vision.results?.filter((v) => v.verdict === 'conflict').length || 0} conflict
                          </span>
                        </span>
                      ) : vision?.status === 'running' ? (
                        <span className="text-sky-400 animate-pulse">
                          Vision gate: running… (page refreshes while it works)
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          Vision gate:{' '}
                          {vision?.status === 'skipped' ? vision.skipped : vision?.error || 'not run'}
                        </span>
                      )}
                    </div>
                    {vision?.results?.length ? (
                      <details className="mb-3 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
                          decision verdicts
                        </summary>
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
                            <button
                              className={mathFails.length ? 'btn-success-sm !bg-red-900/70 !text-red-100 hover:!bg-red-800' : 'btn-success-sm'}
                              title={mathFails.length ? `MATH GATE FAILED (${mathFails.length} rule${mathFails.length > 1 ? 's' : ''}) — approving overrides the rulebook. Make sure this is intentional.` : 'Approve this 2D outline'}
                            >
                              {mathFails.length ? `⚠ Approve 2D (math failed — override)` : '✓ Approve 2D'}
                            </button>
                          </form>
                          <form action={rejectOutline} className="flex gap-2 flex-1 min-w-[260px]">
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="room_id" value={roomId} />
                            <input type="hidden" name="outline_id" value={o.id} />
                            <input
                              name="feedback"
                              required
                              placeholder="Reject — what to change (wakes Blueprint to redraft)"
                              className="field flex-1 !py-1.5 !text-xs"
                            />
                            <button className="btn-danger-sm">✗ Reject</button>
                          </form>
                        </>
                      )}
                      <form action={rerunOutlineChecks}>
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="room_id" value={roomId} />
                        <input type="hidden" name="outline_id" value={o.id} />
                        <button className="btn-secondary-sm">↻ Re-run checks</button>
                      </form>
                    </div>
                  </div>
                )
              })}

              {rejectedOutlines.map((o) => (
                <div key={o.id} className="bg-bh-panel/40 border border-red-900/40 rounded-xl p-4 opacity-80">
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <Pill tone="violet">{o.outline_type}</Pill>
                    {o.label && <span className="text-slate-400 line-through">{o.label}</span>}
                    <Pill tone="red">rejected</Pill>
                    <span className="text-slate-600">{new Date(o.pushed_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-red-300/90">&ldquo;{o.feedback}&rdquo;</div>
                </div>
              ))}

              {!outlines?.length && (
                <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-6 text-center">
                  No 2D outlines pushed yet. After Lock &amp; Emit, Blueprint drafts zone maps + elevations and
                  pushes them here — math + vision gates run automatically, then you approve.
                </div>
              )}
            </div>
          </section>

          {/* CURRENT MODEL STATE */}
          {(room.area_sf || (room.model_state && Object.keys(room.model_state).length > 0)) && (
            <section id="model" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="section-title">Current Model State</h2>
                {room.source === 'model_scan' && <Pill tone="blue">from intake scan</Pill>}
              </div>
              <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
              <p className="text-xs text-slate-600">
                Snapshot from the intake scan — decisions below change this; this is what exists now.
              </p>
            </section>
          )}

          {/* DECISIONS */}
          <section id="decisions" className="scroll-mt-28 space-y-4">
            <h2 className="section-title">
              Decisions{' '}
              <span className="text-slate-500 normal-case tracking-normal font-normal">
                ({[...(decisions || [])].filter((d) => d.status === 'active').length} active)
              </span>
            </h2>

            <div className="space-y-3">
              {[...byTopic.entries()].map(([topic, list]) => {
                const active = list!.filter((d) => d.status === 'active')
                const superseded = list!.filter((d) => d.status === 'superseded')
                return (
                  <div key={topic} className="card p-4">
                    <div className="text-xs font-mono text-gold-light/70 mb-2">{topic}</div>
                    {active.map((d) => (
                      <div key={d.id} className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-sm text-slate-100">{d.value}</div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-500">
                            {SOURCE_LABEL[d.source] || d.source}
                            {d.source_ref ? ` · ${d.source_ref}` : ''}
                          </span>
                          {d.meeting_date && (
                            <span className="text-[11px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">
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

            <details>
              <summary className="btn-secondary-sm cursor-pointer">+ Add decision</summary>
              <form action={addDecision} className="card p-4 grid grid-cols-2 gap-3 text-sm mt-2">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="room_id" value={roomId} />
                <input name="topic" required placeholder="Topic (e.g. ceiling)" className="field" />
                <input name="value" required placeholder="Decision (e.g. 12-ft flat, vaulted…)" className="field" />
                <select name="source" className="field">
                  {Object.entries(SOURCE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input name="source_ref" placeholder="Source ref (timestamp / page)" className="field" />
                <input name="meeting_date" type="date" className="field" />
                <button className="btn-primary-sm justify-self-start">
                  Add decision (supersedes previous on same topic)
                </button>
              </form>
            </details>
          </section>

          {/* DEFAULTS IN EFFECT */}
          <section id="defaults" className="scroll-mt-28 space-y-4">
            <h2 className="section-title">
              Runbook Defaults in Effect{' '}
              <span className="text-slate-500 normal-case tracking-normal font-normal">
                ({openDefaults.length} topics with no decision)
              </span>
            </h2>
            <div className="card divide-y divide-slate-800/60 overflow-hidden">
              {openDefaults.map((d) => (
                <div key={d.topic} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-500 mr-2">{d.topic}</span>
                    <span className="text-slate-300">{d.value}</span>
                  </div>
                  <Pill tone="outline">default</Pill>
                </div>
              ))}
              {!openDefaults.length && (
                <div className="px-4 py-3 text-sm text-slate-600">
                  Every default topic has an explicit decision above — nothing builds from §4 defaults in
                  this room.
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Accepting defaults (review-state control up top) means these build as-is. Override any of
              them by adding a decision on that topic.
            </p>
          </section>

          {/* ASSIGNED IMAGES */}
          <section id="inspo" className="scroll-mt-28 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">
                Assigned Inspo{' '}
                <span className="text-slate-500">({images?.length || 0})</span>
              </h2>
              <Link href={`/projects/${id}/images`} className="text-xs text-gold-light hover:text-gold">
                manage image pool →
              </Link>
            </div>
            {(images || []).length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images!.map((img) => (
                  <div key={img.id} className="card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${SUPABASE_URL}/storage/v1/object/public/intent-inspo/${img.storage_path}`}
                      alt={img.notes || 'inspo'}
                      className="w-full h-28 object-cover"
                    />
                    {img.notes && (
                      <div className="text-[11px] text-slate-500 px-2 py-1.5 truncate">{img.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                No inspo assigned to this room.{' '}
                <Link href={`/projects/${id}/images`} className="text-gold-light hover:text-gold">
                  Assign some →
                </Link>
              </div>
            )}
          </section>

          {/* OPEN QUESTIONS */}
          <section id="questions" className="scroll-mt-28 space-y-4">
            <h2 className="section-title">
              Open Questions{' '}
              <span className="text-slate-500 normal-case tracking-normal font-normal">
                ({openUnresolved.length} unresolved)
              </span>
            </h2>
            <div className="space-y-3">
              {(opens || []).map((o) => (
                <div
                  key={o.id}
                  className={`rounded-xl border p-4 ${
                    o.answer ? 'border-bh-border bg-bh-panel/50' : 'border-amber-900/50 bg-bh-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-slate-100">{o.question}</div>
                    {o.blocking && !o.answer && <Pill tone="red">blocking</Pill>}
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
                        placeholder={
                          o.default_if_unanswered
                            ? `Answer (or type the default: ${o.default_if_unanswered})`
                            : 'Answer'
                        }
                        className="field flex-1"
                      />
                      <button className="btn-secondary">Resolve</button>
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

            <details>
              <summary className="btn-secondary-sm cursor-pointer">+ Add open question</summary>
              <form action={addOpenQuestion} className="card p-4 grid grid-cols-2 gap-3 text-sm mt-2">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="room_id" value={roomId} />
                <input name="question" required placeholder="Question (e.g. floating vanities?)" className="field col-span-2" />
                <input name="default_if_unanswered" placeholder="Default if unanswered" className="field" />
                <label className="flex items-center gap-2 text-slate-400 text-xs">
                  <input type="checkbox" name="blocking" defaultChecked className="accent-gold" />
                  Blocking (must resolve before Lock)
                </label>
                <button className="btn-secondary col-span-2 justify-self-start">Add open question</button>
              </form>
            </details>
          </section>

          {/* REDLINE NOTES */}
          <section id="redlines" className="scroll-mt-28 space-y-4">
            <h2 className="section-title">Redline Notes — from Michael&apos;s D1 markup</h2>
            <div className="space-y-2">
              {(redlines || []).map((r) => (
                <div key={r.id} className="card flex items-center gap-3 px-4 py-2 text-sm">
                  <Pill tone="gold">{r.note_type.replace('_', ' ')}</Pill>
                  <span className="text-slate-200">{r.text}</span>
                  {r.source_ref && <span className="text-xs text-slate-600 ml-auto shrink-0">{r.source_ref}</span>}
                </div>
              ))}
              {!redlines?.length && (
                <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                  No redline notes for this room.
                </div>
              )}
            </div>

            <details>
              <summary className="btn-secondary-sm cursor-pointer">+ Add redline note</summary>
              <form action={addRedlineNote} className="card p-4 grid grid-cols-4 gap-3 text-sm mt-2">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="room_id" value={roomId} />
                <select name="note_type" className="field">
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <input name="text" required placeholder="What the markup means (e.g. beam, not wall)" className="field col-span-2" />
                <input name="source_ref" placeholder="D1 ref" className="field" />
                <button className="btn-secondary col-span-4 justify-self-start">Add redline note</button>
              </form>
            </details>
          </section>
        </div>
      </main>
    </div>
  )
}
