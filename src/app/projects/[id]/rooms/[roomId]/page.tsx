export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import {
  addDecision,
  addOpenQuestion,
  addRedlineNote,
  resolveOpen,
  setReviewState,
} from '@/app/actions'
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
}: {
  params: Promise<{ id: string; roomId: string }>
}) {
  const { id, roomId } = await params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('intent_rooms')
    .select('id, project_id, section_code, name, review_state')
    .eq('id', roomId)
    .single()
  if (!room || room.project_id !== id) notFound()

  const { data: project } = await supabase
    .from('intent_projects')
    .select('name')
    .eq('id', id)
    .single()

  const [{ data: decisions }, { data: opens }, { data: redlines }, { data: images }] = await Promise.all([
    supabase
      .from('intent_decisions')
      .select('*')
      .eq('room_id', roomId)
      .order('topic')
      .order('created_at', { ascending: false }),
    supabase.from('intent_open_questions').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('intent_redline_notes').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('intent_inspo_images').select('*').eq('room_id', roomId).order('created_at'),
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/50">
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
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              </form>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
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
                <div key={topic} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
              <div className="text-sm text-slate-600 border border-dashed border-slate-800 rounded-xl p-6 text-center">
                No decisions captured for this room yet.
              </div>
            )}
          </div>

          <form action={addDecision} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <input name="topic" required placeholder="Topic (e.g. ceiling)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-1" />
            <input name="value" required placeholder="Decision (e.g. 12-ft flat, vaulted…)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-1" />
            <select name="source" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
              {Object.entries(SOURCE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input name="source_ref" placeholder="Source ref (timestamp / page)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" />
            <input name="meeting_date" type="date" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" />
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-3 py-2 transition-colors">
              Add decision (supersedes previous on same topic)
            </button>
          </form>
        </section>

        {/* DEFAULTS IN EFFECT */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Runbook defaults in effect ({openDefaults.length} topics with no decision → §4 default)
          </h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
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
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              manage image pool →
            </Link>
          </div>
          {(images || []).length ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images!.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
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
            <div className="text-sm text-slate-600 border border-dashed border-slate-800 rounded-xl p-4 text-center">
              No inspo assigned to this room.{' '}
              <Link href={`/projects/${id}/images`} className="text-amber-400 underline">
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
                  o.answer ? 'border-slate-800 bg-slate-900/40' : 'border-amber-900/50 bg-slate-900'
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
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                    />
                    <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-sm font-medium">
                      Resolve
                    </button>
                  </form>
                )}
              </div>
            ))}
            {!opens?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                No open questions for this room.
              </div>
            )}
          </div>
          <form action={addOpenQuestion} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <input name="question" required placeholder="Question (e.g. floating vanities?)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-2" />
            <input name="default_if_unanswered" placeholder="Default if unanswered" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" />
            <label className="flex items-center gap-2 text-slate-400 text-xs">
              <input type="checkbox" name="blocking" defaultChecked className="accent-amber-500" />
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
              <div key={r.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-amber-300 rounded px-1.5 py-0.5 shrink-0">
                  {r.note_type.replace('_', ' ')}
                </span>
                <span>{r.text}</span>
                {r.source_ref && <span className="text-xs text-slate-600 ml-auto shrink-0">{r.source_ref}</span>}
              </div>
            ))}
            {!redlines?.length && (
              <div className="text-sm text-slate-600 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                No redline notes for this room.
              </div>
            )}
          </div>
          <form action={addRedlineNote} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 grid grid-cols-4 gap-3 text-sm">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="room_id" value={roomId} />
            <select name="note_type" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-1">
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
            <input name="text" required placeholder="What the markup means (e.g. beam, not wall)" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-2" />
            <input name="source_ref" placeholder="D1 ref" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 col-span-1" />
            <button className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 font-medium col-span-4">
              Add redline note
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
