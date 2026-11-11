export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import {
  addDecision,
  addOpenQuestion,
  addRedlineNote,
  removeDecision,
  reopenRoom,
  replaceDecision,
  resolveOpen,
  restoreDecision,
  setReviewState,
} from '@/app/actions'
import { approveOutline, rejectOutline, rerunOutlineChecks, set2dApproved } from '@/app/outlines-actions'
import { setDecisionKind, setRedlineKind, setRoomTyping, setTopicKind } from '@/app/typing-actions'
import { loadKinds, type KindOption } from '@/lib/model-rules'
import { ROOM_ROLES, isHouseSection, roleLabel, suggestKind, suggestNeeds2d, suggestRedlineKind, suggestRole } from '@/lib/vocab'
import { defaultsForRoom, loadDefaults } from '@/lib/defaults'
import { INSPO_BUCKET, OUTLINES_BUCKET, signedUrls } from '@/lib/storage'
import { summariseChecks, ago, type CheckSummary, type MathResult, type VisionResult } from '@/lib/outline-summary'
import { Pill } from '@/components/pill'
import { PageHeader } from '@/components/page-header'
import { VisionPoller } from '@/components/vision-poller'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ROOM — two views instead of one long scroll:
//   Decide     what gets built: decisions and defaults in ONE list, questions,
//              redline notes, inspo. The job before the contract is locked.
//   2D review  the drawings Blueprint pushed: large image, failures open,
//              passes folded, approve / reject. The job after the lock.
// The page opens on whichever view has work in it.

const SOURCE_LABEL: Record<string, string> = {
  transcript: 'transcript',
  redline: 'redline',
  inspo: 'inspo',
  default: 'default',
  manual: 'manual',
}
const NOTE_TYPES = ['beam', 'cabinet_run', 'delete', 'move', 'keep', 'note']

const TONE_TEXT: Record<CheckSummary['visionTone'], string> = {
  red: 'text-red-400',
  gold: 'text-amber-400',
  green: 'text-emerald-400',
  blue: 'text-sky-400',
  neutral: 'text-slate-500',
}

type Decision = {
  id: string
  topic: string
  value: string
  status: string
  source: string
  source_ref: string | null
  meeting_date: string | null
  superseded_by: string | null
  kind: string | null
  params: Record<string, unknown> | null
}
type OpenQuestion = {
  id: string
  question: string
  answer: string | null
  default_if_unanswered: string | null
  blocking: boolean
}
type Redline = { id: string; note_type: string; text: string; source_ref: string | null; kind: string | null }
type Inspo = { id: string; storage_path: string; notes: string | null }
type Outline = {
  id: string
  outline_type: string
  label: string | null
  status: string
  pushed_at: string
  pushed_by: string | null
  storage_path: string | null
  geometry: { elements?: unknown[] } | null
  checks: Record<string, unknown> | null
  feedback: string | null
}
type RoomLite = { id: string; section_code: string; name: string; review_state: string }

// The kind of work a line is — what contract v2 is typed by. Grouped by family; '' = not chosen.
function KindSelect({ kinds, value, name = 'kind', empty = 'kind of work: not chosen' }: { kinds: KindOption[]; value?: string | null; name?: string; empty?: string }) {
  const work = kinds.filter((k) => k.executable)
  const context = kinds.filter((k) => !k.executable) // not a kind: the mark for a line that asks for nothing to be built
  const families = [...new Set(work.map((k) => k.family))]
  return (
    <select name={name} defaultValue={value || ''} className="field" aria-label="Kind of work">
      <option value="">{empty}</option>
      {families.map((f) => (
        <optgroup key={f} label={f}>
          {work
            .filter((k) => k.family === f)
            .map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label} ({k.kind})
              </option>
            ))}
        </optgroup>
      ))}
      {context.length > 0 && (
        <optgroup label="not work">
          {context.map((k) => (
            <option key={k.kind} value={k.kind}>
              Nothing to build — context only
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

function DecisionForm({
  projectId,
  roomId,
  topic,
  cta,
  kinds,
}: {
  projectId: string
  roomId: string
  topic?: string
  cta: string
  kinds: KindOption[]
}) {
  return (
    <form action={addDecision} className="grid gap-3 sm:grid-cols-2 text-sm mt-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="room_id" value={roomId} />
      {topic ? (
        <input type="hidden" name="topic" value={topic} />
      ) : (
        <input name="topic" required placeholder="Topic (e.g. ceiling)" className="field" />
      )}
      <input
        name="value"
        required
        placeholder={topic ? 'Decision for “' + topic + '”' : 'Decision (e.g. 12 ft flat)'}
        className={'field ' + (topic ? 'sm:col-span-2' : '')}
      />
      <select name="source" defaultValue="manual" className="field">
        {Object.entries(SOURCE_LABEL)
          .filter(([v]) => v !== 'default')
          .map(([v, l]) => (
            <option key={v} value={v}>
              source: {l}
            </option>
          ))}
      </select>
      <input name="source_ref" placeholder="Where it came from (timestamp / page) — optional" className="field" />
      <input name="meeting_date" type="date" className="field" aria-label="Meeting date" />
      {kinds.length > 0 && <KindSelect kinds={kinds} />}
      <button className="btn-primary-sm justify-self-start self-center">{cta}</button>
    </form>
  )
}

// Change or remove ONE line. Opened from the line's "Change" link (?edit=<line id>), so a topic
// holding a couple of hundred lines does not carry a couple of hundred forms.
function LineEditor({ d, projectId, roomId, cancelHref, kinds }: { d: Decision; projectId: string; roomId: string; cancelHref: string; kinds: KindOption[] }) {
  const suggested = d.kind ? null : suggestKind(d.topic, d.value)
  const hasParams = !!d.params && Object.keys(d.params).length > 0
  return (
    <div className="mt-2 rounded-lg border border-bh-border bg-bh-black/40 p-3 space-y-3">
      {kinds.length > 0 && (
        <form action={setDecisionKind} className="grid gap-3 sm:grid-cols-2 text-sm border-b border-bh-border pb-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="room_id" value={roomId} />
          <input type="hidden" name="decision_id" value={d.id} />
          <label className="text-[11px] text-slate-500">
            Kind of work for this line{suggested ? ' — suggested, not saved until you save' : ''}
            <span className="block mt-1">
              <KindSelect kinds={kinds} value={d.kind || suggested} />
            </span>
          </label>
          <label className="text-[11px] text-slate-500">
            Numbers, as name: value pairs — optional
            <input
              name="params"
              defaultValue={hasParams ? JSON.stringify(d.params) : ''}
              placeholder='{"width_in": 84, "depth_in": 42}'
              className="field mt-1 font-mono text-xs"
            />
          </label>
          <button className="btn-secondary-sm justify-self-start">Save kind — the wording stays as it is</button>
        </form>
      )}
      <form action={replaceDecision} className="grid gap-3 sm:grid-cols-2 text-sm">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="decision_id" value={d.id} />
        <label className="sm:col-span-2 text-[11px] text-slate-500">
          New wording for this line
          <textarea name="value" required rows={2} defaultValue={d.value} className="field mt-1" />
        </label>
        <select name="source" defaultValue="manual" className="field" aria-label="Source of the change">
          {Object.entries(SOURCE_LABEL)
            .filter(([v]) => v !== 'default')
            .map(([v, l]) => (
              <option key={v} value={v}>
                source: {l}
              </option>
            ))}
        </select>
        <input name="source_ref" placeholder="Where it came from (timestamp / page) — optional" className="field" />
        <input name="meeting_date" type="date" className="field" aria-label="Meeting date" />
        <div className="flex flex-wrap items-center gap-3 self-center">
          <button className="btn-primary-sm">Save — replaces this line only</button>
          {d.kind && <span className="text-[11px] text-slate-600">The kind of work is kept; its numbers are cleared.</span>}
          <Link href={cancelHref} className="text-[11px] text-slate-500 hover:text-gold-light">
            Cancel
          </Link>
        </div>
      </form>
      <form action={removeDecision} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-bh-border pt-3">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="decision_id" value={d.id} />
        <button className="btn-secondary-sm">Remove this line</button>
        <span className="text-[11px] text-slate-600">It stays listed, crossed out, and can be put back.</span>
      </form>
    </div>
  )
}

function RuleRow({ r, tone }: { r: MathResult; tone: 'red' | 'green' | 'neutral' }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed">
      <span className={tone === 'red' ? 'text-red-400' : tone === 'green' ? 'text-emerald-400' : 'text-slate-600'}>
        {tone === 'red' ? '✗' : tone === 'green' ? '✓' : '–'}
      </span>
      <span className={tone === 'red' ? 'text-slate-200' : 'text-slate-400'}>
        {r.description}
        {r.measured && r.status !== 'na' ? (
          <span className={tone === 'red' ? 'text-red-300' : 'text-slate-300'}>
            {' '}
            — drawn {r.measured}
            {r.required ? ', needs ' + r.required : ''}
          </span>
        ) : null}
        {r.detail ? <span className="text-slate-600"> · {r.detail}</span> : null}
      </span>
    </div>
  )
}

function VerdictRow({ v, tone }: { v: VisionResult; tone: 'red' | 'gold' | 'green' | 'neutral' }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed">
      <span className={TONE_TEXT[tone]}>{tone === 'red' ? '✗' : tone === 'green' ? '✓' : tone === 'gold' ? '?' : '–'}</span>
      <span className={tone === 'red' ? 'text-slate-200' : 'text-slate-400'}>
        <span className="font-mono text-[10px] text-slate-500">{v.topic}</span>
        {v.note ? ' — ' + v.note : ''}
      </span>
    </div>
  )
}

// imageUrl is a signed link that expires (lib/storage.ts); null = the file could not be signed
function OutlineCard({ o, projectId, roomId, imageUrl }: { o: Outline; projectId: string; roomId: string; imageUrl: string | null }) {
  const c = summariseChecks(o.checks)
  const elements = Array.isArray(o.geometry?.elements) ? o.geometry!.elements!.length : 0
  const visionResults = c.vision?.status === 'ok' ? c.vision.results || [] : []
  const notDrawable = visionResults.filter((v) => v.verdict === 'na')
  const hidden = (
    <>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="outline_id" value={o.id} />
    </>
  )

  return (
    <div id={'o-' + o.id} className="card scroll-mt-32 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bh-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Pill tone="violet">{o.outline_type}</Pill>
          {o.label && <span className="text-sm font-medium text-slate-100">{o.label}</span>}
          <span className="text-[11px] text-slate-600">
            {elements} elements · pushed {ago(o.pushed_at)}
            {o.pushed_by ? ' by ' + o.pushed_by : ''}
          </span>
        </div>
        <Pill tone={o.status === 'approved' ? 'green' : 'gold'}>{o.status === 'pushed' ? 'awaiting review' : o.status}</Pill>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* drawing */}
        <div className="bg-bh-black border-b lg:border-b-0 lg:border-r border-bh-border">
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer" title="Open full size in a new tab" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={o.outline_type + ' ' + (o.label || '')}
                className="w-full max-h-[70vh] object-contain"
              />
            </a>
          ) : (
            <div className="p-10 text-center text-sm text-slate-600">
              {o.storage_path ? 'The drawing could not be loaded. Refresh the page; if it stays missing, tell Blueprint.' : 'No image was pushed with this outline.'}
            </div>
          )}
        </div>

        {/* checks */}
        <div className="p-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="section-title">Rules</span>
              <span className={'text-xs font-medium ' + TONE_TEXT[c.mathTone]}>
                {c.mathText}
                {c.math?.rulebook_version ? (
                  <span className="text-slate-600 font-normal"> · rulebook v{c.math.rulebook_version}</span>
                ) : null}
              </span>
            </div>
            {c.mathFails.map((r) => (
              <RuleRow key={r.rule_key} r={r} tone="red" />
            ))}
            {c.mathPasses.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                  {c.mathPasses.length} passed
                </summary>
                <div className="mt-2 space-y-1">
                  {c.mathPasses.map((r) => (
                    <RuleRow key={r.rule_key} r={r} tone="green" />
                  ))}
                </div>
              </details>
            )}
            {c.mathNa.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-300">
                  {c.mathNa.length} had nothing to measure here
                </summary>
                <div className="mt-2 space-y-1">
                  {c.mathNa.map((r) => (
                    <RuleRow key={r.rule_key} r={r} tone="neutral" />
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="section-title">Decisions</span>
              <span className={'text-xs font-medium ' + TONE_TEXT[c.visionTone] + (c.visionRunning ? ' animate-pulse' : '')}>
                {c.visionText}
              </span>
            </div>
            {c.vision?.status === 'error' && c.vision.error && (
              <div className="text-xs text-slate-600">{c.vision.error}</div>
            )}
            {c.vision?.status === 'skipped' && c.vision.skipped && (
              <div className="text-xs text-slate-600">{c.vision.skipped}</div>
            )}
            {c.conflicts.map((v, i) => (
              <VerdictRow key={'c' + i} v={v} tone="red" />
            ))}
            {c.missing.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-amber-400/90 hover:text-amber-300">
                  {c.missing.length} not shown in this drawing
                </summary>
                <div className="mt-2 space-y-1">
                  {c.missing.map((v, i) => (
                    <VerdictRow key={'m' + i} v={v} tone="gold" />
                  ))}
                </div>
              </details>
            )}
            {c.confirmed.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                  {c.confirmed.length} confirmed
                </summary>
                <div className="mt-2 space-y-1">
                  {c.confirmed.map((v, i) => (
                    <VerdictRow key={'k' + i} v={v} tone="green" />
                  ))}
                </div>
              </details>
            )}
            {notDrawable.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-300">
                  {notDrawable.length} not something a drawing can show
                </summary>
                <div className="mt-2 space-y-1">
                  {notDrawable.map((v, i) => (
                    <VerdictRow key={'n' + i} v={v} tone="neutral" />
                  ))}
                </div>
              </details>
            )}
          </div>

          {c.override && (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
              Approved despite a failed rule — “{c.override.reason}”
              {c.override.by ? <span className="text-slate-500"> · {c.override.by}</span> : null}
            </div>
          )}

          {/* actions */}
          <div className="border-t border-bh-border pt-4 space-y-3">
            {o.status === 'pushed' && (
              <>
                {c.mathFails.length === 0 ? (
                  <form action={approveOutline}>
                    {hidden}
                    <button className="btn-success-sm w-full !py-2">✓ Approve this drawing</button>
                  </form>
                ) : (
                  <form action={approveOutline} className="space-y-2">
                    {hidden}
                    <input
                      name="override_reason"
                      required
                      placeholder="Why is this OK despite the failed rule?"
                      className="field !py-1.5 !text-xs"
                    />
                    <button className="btn-danger-sm w-full">
                      Approve anyway ({c.mathFails.length} failed {c.mathFails.length === 1 ? 'rule' : 'rules'})
                    </button>
                  </form>
                )}
                <form action={rejectOutline} className="space-y-2">
                  {hidden}
                  <input
                    name="feedback"
                    required
                    placeholder="Reject — what should change? (wakes Blueprint to redraw)"
                    className="field !py-1.5 !text-xs"
                  />
                  <button className="btn-secondary-sm w-full">✗ Reject and send back</button>
                </form>
              </>
            )}
            <form action={rerunOutlineChecks}>
              {hidden}
              <button className="text-xs text-slate-500 hover:text-white transition-colors">↻ Re-run both checks</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roomId: string }>
  searchParams: Promise<{ view?: string; err2d?: string; err?: string; edit?: string }>
}) {
  const { id, roomId } = await params
  const { view: viewParam, err2d: err2dParam, err: errParam, edit: editId } = await searchParams
  const err2d = err2dParam || errParam
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('intent_rooms')
    .select('id, project_id, section_code, name, review_state, area_sf, model_state, source, role, needs_2d, shell_changed')
    .eq('id', roomId)
    .single()
  if (!room || room.project_id !== id) notFound()

  const [projectRes, decisionsRes, opensRes, redlinesRes, imagesRes, outlinesRes, roomsRes, pendingRes] =
    await Promise.all([
      supabase.from('intent_projects').select('name, emitted_version').eq('id', id).single(),
      supabase
        .from('intent_decisions')
        .select('id, topic, value, status, source, source_ref, meeting_date, superseded_by, kind, params')
        .eq('room_id', roomId)
        .order('topic')
        .order('created_at', { ascending: false }),
      supabase
        .from('intent_open_questions')
        .select('id, question, answer, default_if_unanswered, blocking')
        .eq('room_id', roomId)
        .order('created_at'),
      supabase.from('intent_redline_notes').select('id, note_type, text, source_ref, kind').eq('room_id', roomId).order('created_at'),
      supabase.from('intent_inspo_images').select('id, storage_path, notes').eq('room_id', roomId).order('created_at'),
      supabase.from('intent_outlines').select('*').eq('room_id', roomId).order('pushed_at', { ascending: false }),
      supabase.from('intent_rooms').select('id, section_code, name, review_state').eq('project_id', id).order('sort_order'),
      supabase.from('intent_outlines').select('room_id').eq('project_id', id).eq('status', 'pushed'),
    ])

  const project = projectRes.data as { name: string; emitted_version: number | null } | null
  const decisions = (decisionsRes.data || []) as Decision[]
  const opens = (opensRes.data || []) as OpenQuestion[]
  const redlines = (redlinesRes.data || []) as Redline[]
  const images = (imagesRes.data || []) as Inspo[]
  const outlines = (outlinesRes.data || []) as Outline[]
  const rooms = (roomsRes.data || []) as RoomLite[]
  // typing for contract v2: the kinds of work, and what is still untyped in this room
  const kinds = ((await loadKinds(supabase)) || []).filter((k) => k.active)
  const kindLabel = (k: string) => kinds.find((x) => x.kind === k)?.label || k
  // how a typed line reads: a kind of work, or context (not a kind)
  const typedAs = (k: string) => (kinds.find((x) => x.kind === k)?.executable === false ? 'context only — nothing is built from this line' : 'kind: ' + kindLabel(k))
  const isHouse = isHouseSection(room.section_code)
  const roleGuess = room.role ? null : suggestRole(room.name)
  const needs2dGuess = suggestNeeds2d(room.name, room.section_code)
  const untypedLines = decisions.filter((d) => d.status === 'active' && !d.kind).length
  const untypedNotes = redlines.filter((n) => !n.kind).length
  const roomTyped = isHouse || (!!room.role && (room.needs_2d === true || room.needs_2d === false))
  // signed links for this render only; nothing here is a public URL
  const [outlineUrls, inspoUrls] = await Promise.all([
    signedUrls(supabase, OUTLINES_BUCKET, outlines.filter((o) => o.status === 'pushed' || o.status === 'approved').map((o) => o.storage_path)),
    signedUrls(supabase, INSPO_BUCKET, images.map((i) => i.storage_path)),
  ])
  const pendingElsewhere = ((pendingRes.data || []) as { room_id: string }[]).filter((p) => p.room_id !== roomId)

  // ---- decisions + defaults, one list ----
  const byTopic = new Map<string, Decision[]>()
  for (const d of decisions) byTopic.set(d.topic, [...(byTopic.get(d.topic) || []), d])
  const activeCount = decisions.filter((d) => d.status === 'active').length
  // Lines that are no longer active, sorted by what happened to them:
  //   replaced -> listed under the active line that took their place (following the chain)
  //   removed  -> no replacement (superseded_by empty): listed under the topic, can be put back
  //   the rest -> their replacement was itself removed: listed under the topic, read-only
  const decisionById = new Map(decisions.map((d) => [d.id, d]))
  const replacedBy = new Map<string, Decision[]>()
  const removedLines = new Map<string, Decision[]>()
  const strandedLines = new Map<string, Decision[]>()
  const push = (m: Map<string, Decision[]>, k: string, d: Decision) => m.set(k, [...(m.get(k) || []), d])
  for (const d of decisions) {
    if (d.status === 'active') continue
    if (!d.superseded_by) {
      push(removedLines, d.topic, d)
      continue
    }
    let cur: Decision | undefined = d
    const seen = new Set<string>()
    while (cur && cur.status !== 'active' && cur.superseded_by && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = decisionById.get(cur.superseded_by)
    }
    if (cur && cur.status === 'active') push(replacedBy, cur.id, d)
    else push(strandedLines, d.topic, d)
  }
  const decidedTopics = new Set(decisions.filter((d) => d.status === 'active').map((d) => d.topic))
  // defaults are data now (Rulebook → Defaults), not a list in the code
  const openDefaults = defaultsForRoom(room.section_code, room.name, await loadDefaults(supabase)).filter((d) => !decidedTopics.has(d.topic))

  const unresolved = opens.filter((q) => !q.answer)
  const blockingOpen = unresolved.filter((q) => q.blocking).length

  // ---- outlines ----
  const pending = outlines.filter((o) => o.status === 'pushed')
  const approved = outlines.filter((o) => o.status === 'approved')
  const rejected = outlines.filter((o) => o.status === 'rejected')
  const supersededCount = outlines.filter((o) => o.status === 'superseded').length
  const summaries = [...pending, ...approved].map((o) => summariseChecks(o.checks))
  const visionRunning = summaries.some((s) => s.visionRunning)

  const is2dApproved = room.review_state === '2d_approved'
  const canApprove2d = room.review_state === 'confirmed' && pending.length === 0 && approved.length > 0

  // ---- which view ----
  const defaultView = pending.length + approved.length > 0 || is2dApproved ? '2d' : 'decide'
  const view = viewParam === 'decide' || viewParam === '2d' ? viewParam : defaultView
  const here = '/projects/' + id + '/rooms/' + roomId

  // ---- neighbours ----
  const idx = rooms.findIndex((r) => r.id === roomId)
  const prev = idx > 0 ? rooms[idx - 1] : null
  const next = idx >= 0 && idx < rooms.length - 1 ? rooms[idx + 1] : null
  const after = idx >= 0 ? [...rooms.slice(idx + 1), ...rooms.slice(0, idx)] : []
  const nextUnreviewed = after.find((r) => r.review_state === 'unreviewed') || null
  const pendingRoomIds = new Set(pendingElsewhere.map((p) => p.room_id))
  const nextWithOutlines = after.find((r) => pendingRoomIds.has(r.id)) || null

  const modelBits: string[] = []
  if (room.area_sf) modelBits.push(Math.round(room.area_sf) + ' SF')
  for (const [k, v] of Object.entries((room.model_state || {}) as Record<string, unknown>)) {
    modelBits.push(k.replace(/_/g, ' ') + ': ' + String(v))
  }

  return (
    <div>
      {visionRunning && <VisionPoller />}
      <main>
        <PageHeader
          back={'/projects/' + id}
          backLabel={project?.name}
          eyebrow={room.section_code}
          title={room.name}
        >
          {is2dApproved ? (
            <>
              <Pill tone="violet">✓ 2D approved</Pill>
              <details className="relative">
                <summary className="btn-secondary-sm cursor-pointer list-none">Reopen…</summary>
                <form
                  action={reopenRoom.bind(null, roomId, id)}
                  className="absolute right-0 top-9 z-30 card p-4 w-72 space-y-3 shadow-2xl shadow-black/60"
                >
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Reopening discards this room&apos;s 2D approval. It goes back to “confirmed” and must be approved
                    again before the build.
                  </p>
                  <button className="btn-danger-sm w-full">Reopen room</button>
                </form>
              </details>
            </>
          ) : (
            <div className="flex items-center rounded-lg border border-bh-border overflow-hidden">
              {(['unreviewed', 'defaults_accepted', 'confirmed'] as const).map((s) => (
                <form key={s} action={setReviewState.bind(null, roomId, id, s)}>
                  <button
                    title={
                      s === 'defaults_accepted'
                        ? 'Build this room from the defaults as listed — no 2D drawings'
                        : s === 'confirmed'
                          ? 'Every decision here is reviewed and right'
                          : 'Not reviewed yet'
                    }
                    className={
                      'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ' +
                      (room.review_state === s ? 'bg-gold text-slate-950' : 'bg-bh-card text-slate-500 hover:text-white')
                    }
                  >
                    {s.replace('_', ' ')}
                  </button>
                </form>
              ))}
            </div>
          )}
        </PageHeader>

        {/* view switch */}
        <nav className="sticky top-16 z-30 border-b border-bh-border bg-bh-black/90 backdrop-blur">
          <div className="app-container py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: 'decide', label: 'Decide', note: blockingOpen ? blockingOpen + ' blocking' : activeCount + ' decided' },
                  {
                    key: '2d',
                    label: '2D review',
                    note: pending.length ? pending.length + ' to review' : approved.length ? approved.length + ' approved' : 'none yet',
                  },
                ] as const
              ).map((t) => (
                <Link
                  key={t.key}
                  href={here + '?view=' + t.key}
                  aria-current={view === t.key ? 'page' : undefined}
                  className={
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ' +
                    (view === t.key ? 'bg-gold text-slate-950' : 'text-slate-400 hover:text-white hover:bg-bh-card')
                  }
                >
                  {t.label}
                  <span className={'ml-1.5 font-normal ' + (view === t.key ? 'text-slate-800' : 'text-slate-600')}>
                    {t.note}
                  </span>
                </Link>
              ))}
            </div>
            {modelBits.length > 0 && (
              <div className="text-[11px] text-slate-500 truncate" title="What exists in the model now (from the intake scan)">
                <span className="text-slate-600">In the model now: </span>
                {modelBits.join(' · ')}
              </div>
            )}
          </div>
        </nav>

        <div className="app-container py-8 space-y-10 max-w-6xl">
          {err2d && (
            <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{err2d}</div>
          )}

          {view === 'decide' && (
            <>
              {/* TYPING — what contract v2 is built from. Suggestions are shown, never saved by themselves. */}
              {kinds.length > 0 && (
                <section id="typing" className="scroll-mt-32 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="section-title">For the typed contract</h2>
                    <span className="text-[11px] text-slate-500">
                      {roomTyped && untypedLines + untypedNotes === 0
                        ? 'Nothing missing in this room'
                        : [
                            roomTyped ? '' : isHouse ? '' : 'room not set',
                            untypedLines ? untypedLines + ' line' + (untypedLines === 1 ? '' : 's') + ' without a kind' : '',
                            untypedNotes ? untypedNotes + ' redline note' + (untypedNotes === 1 ? '' : 's') + ' without a kind' : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                  </div>
                  {isHouse ? (
                    <p className="text-xs text-slate-600">House-level lines only need a kind of work each. This section is not a room, so it has no role.</p>
                  ) : (
                    <form action={setRoomTyping} className="card p-4 grid gap-4 sm:grid-cols-3 text-sm">
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="room_id" value={roomId} />
                      <label className="text-[11px] text-slate-500">
                        What this room is{roleGuess ? ' — suggested from its name, not saved yet' : ''}
                        <select name="role" defaultValue={room.role || roleGuess || ''} className="field mt-1">
                          <option value="">not chosen</option>
                          {ROOM_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        Gets 2D drawings before it is built{room.needs_2d == null ? ' — suggested, not saved yet' : ''}
                        <select name="needs_2d" defaultValue={room.needs_2d == null ? (needs2dGuess ? 'yes' : 'no') : room.needs_2d ? 'yes' : 'no'} className="field mt-1">
                          <option value="yes">Yes — draw it first</option>
                          <option value="no">No — build from the decisions and defaults</option>
                        </select>
                      </label>
                      <label className="flex items-start gap-2 text-[11px] text-slate-500 self-end">
                        <input type="checkbox" name="shell_changed" defaultChecked={!!room.shell_changed} className="mt-0.5" />
                        <span>A decision moves this room&apos;s walls or changes its size (its drawings are made on the new shape)</span>
                      </label>
                      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
                        <button className="btn-secondary-sm">{roomTyped ? 'Save' : 'Save for this room'}</button>
                        <span className="text-[11px] text-slate-600">
                          {roomTyped
                            ? 'Saved: ' + roleLabel(room.role || '') + ' · ' + (room.needs_2d ? '2D drawings first' : 'no 2D drawings') + (room.shell_changed ? ' · shape changes' : '')
                            : 'Nothing is saved until you press Save.'}
                        </span>
                      </div>
                    </form>
                  )}
                </section>
              )}

              {/* DECISIONS + DEFAULTS */}
              <section id="decisions" className="scroll-mt-32 space-y-4">
                <div>
                  <h2 className="section-title">What gets built here</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    {activeCount} decided · {openDefaults.length} built from defaults. Each line is changed or removed on
                    its own.
                  </p>
                </div>

                <div className="card divide-y divide-slate-800/60">
                  {[...byTopic.entries()].map(([topic, list]) => {
                    const active = list.filter((d) => d.status === 'active')
                    const removed = removedLines.get(topic) || []
                    const stranded = strandedLines.get(topic) || []
                    if (!active.length && !removed.length) return null
                    return (
                      <div key={topic} className="px-4 py-3">
                        {/* a topic can hold several active lines (board pushes add one per transcript line):
                            one row per line, and the source — often a long transcript quote — wraps under it.
                            Every line is changed or removed on its own. */}
                        <div className="flex items-start justify-between gap-x-4">
                          <span className="font-mono text-xs text-gold-light/80 min-w-0 break-words">{topic}</span>
                          <span className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500">
                            {active.length > 1 ? active.length + ' lines' : null}
                            {active.length ? <Pill tone="green">decided</Pill> : <Pill tone="outline">all removed</Pill>}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-2">
                          {active.map((d) => (
                            <li key={d.id} id={'d-' + d.id} className="min-w-0 scroll-mt-36">
                              <div className="flex items-start justify-between gap-x-3">
                                <div className="min-w-0">
                                  <div className="text-sm text-slate-100 break-words">{d.value}</div>
                                  <div className="text-[11px] text-slate-500 break-words">
                                    {SOURCE_LABEL[d.source] || d.source}
                                    {d.source_ref ? ' · ' + d.source_ref : ''}
                                    {d.meeting_date ? ' · ' + d.meeting_date : ''}
                                  </div>
                                  {kinds.length > 0 && (
                                    <div className={'text-[11px] break-words ' + (d.kind ? 'text-slate-500' : 'text-amber-400/80')}>
                                      {d.kind ? typedAs(d.kind) : 'no kind of work yet'}
                                    </div>
                                  )}
                                </div>
                                {editId !== d.id && (
                                  <Link
                                    href={here + '?view=decide&edit=' + d.id + '#d-' + d.id}
                                    className="shrink-0 text-[11px] text-slate-600 hover:text-gold-light"
                                  >
                                    Change
                                  </Link>
                                )}
                              </div>
                              {(replacedBy.get(d.id) || []).map((old) => (
                                <div key={old.id} className="text-xs text-slate-600 mt-1 break-words">
                                  <span className="line-through">{old.value}</span>
                                  <span className="ml-2">
                                    (replaced · {old.meeting_date || 'earlier'} · {SOURCE_LABEL[old.source] || old.source})
                                  </span>
                                </div>
                              ))}
                              {editId === d.id && (
                                <LineEditor d={d} projectId={id} roomId={roomId} cancelHref={here + '?view=decide#d-' + d.id} kinds={kinds} />
                              )}
                            </li>
                          ))}
                        </ul>
                        {removed.map((d) => (
                          <div
                            key={d.id}
                            id={'d-' + d.id}
                            className="mt-2 flex items-start justify-between gap-x-3 text-xs text-slate-600 scroll-mt-36"
                          >
                            <div className="min-w-0 break-words">
                              <span className="line-through">{d.value}</span>
                              <span className="ml-2">(removed · not built)</span>
                            </div>
                            <form action={restoreDecision} className="shrink-0">
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="room_id" value={roomId} />
                              <input type="hidden" name="decision_id" value={d.id} />
                              <button className="text-[11px] text-slate-500 underline hover:text-gold-light">Put back</button>
                            </form>
                          </div>
                        ))}
                        {stranded.map((d) => (
                          <div key={d.id} className="text-xs text-slate-600 mt-1 break-words">
                            <span className="line-through">{d.value}</span>
                            <span className="ml-2">
                              (earlier wording · {d.meeting_date || 'earlier'} · {SOURCE_LABEL[d.source] || d.source})
                            </span>
                          </div>
                        ))}
                        {kinds.length > 0 && active.some((d) => !d.kind) && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] text-amber-400/80 hover:text-gold-light">
                              Set the kind of work for {active.filter((d) => !d.kind).length === 1 ? 'the 1 line' : 'the ' + active.filter((d) => !d.kind).length + ' lines'} without one
                            </summary>
                            <form action={setTopicKind} className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="room_id" value={roomId} />
                              <input type="hidden" name="topic" value={topic} />
                              <span className="min-w-0 sm:w-72">
                                <KindSelect kinds={kinds} value={suggestKind(topic, active.find((d) => !d.kind)?.value || '')} />
                              </span>
                              <button className="btn-secondary-sm">Save for these lines</button>
                              <span className="text-[11px] text-slate-600">Suggested from the wording. Lines that already have a kind are left alone.</span>
                            </form>
                          </details>
                        )}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-slate-600 hover:text-gold-light">
                            Add a line to this topic
                          </summary>
                          <DecisionForm projectId={id} roomId={roomId} topic={topic} cta="Add line — nothing is replaced" kinds={kinds} />
                        </details>
                      </div>
                    )
                  })}

                  {openDefaults.map((d) => (
                    <div key={d.topic} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-slate-500 mr-2">{d.topic}</span>
                          <span className="text-sm text-slate-400">{d.value}</span>
                        </div>
                        <Pill tone="outline">default</Pill>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-slate-600 hover:text-gold-light">Override</summary>
                        <DecisionForm projectId={id} roomId={roomId} topic={d.topic} cta="Save decision — overrides the default" kinds={kinds} />
                      </details>
                    </div>
                  ))}

                  {activeCount === 0 && openDefaults.length === 0 && (
                    <div className="px-4 py-6 text-sm text-slate-600 text-center">Nothing recorded for this room yet.</div>
                  )}
                </div>

                <details>
                  <summary className="btn-secondary-sm cursor-pointer">+ Decision on a new topic</summary>
                  <div className="card p-4 mt-2">
                    <DecisionForm projectId={id} roomId={roomId} cta="Add decision" kinds={kinds} />
                  </div>
                </details>
              </section>

              {/* QUESTIONS */}
              <section id="questions" className="scroll-mt-32 space-y-4">
                <h2 className="section-title">
                  Open questions{' '}
                  <span className="text-slate-500 normal-case tracking-normal font-normal">({unresolved.length} unanswered)</span>
                </h2>
                <div className="space-y-3">
                  {opens.map((q) => (
                    <div
                      key={q.id}
                      className={
                        'rounded-xl border p-4 ' +
                        (q.answer ? 'border-bh-border bg-bh-panel/50' : 'border-amber-900/50 bg-bh-card')
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm text-slate-100">{q.question}</div>
                        {q.blocking && !q.answer && <Pill tone="red">blocking</Pill>}
                      </div>
                      {q.answer ? (
                        <div className="text-sm text-emerald-400 mt-2">→ {q.answer}</div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <form action={resolveOpen} className="flex gap-2">
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="room_id" value={roomId} />
                            <input type="hidden" name="id" value={q.id} />
                            <input name="answer" required placeholder="Answer" className="field flex-1" />
                            <button className="btn-secondary">Answer</button>
                          </form>
                          {q.default_if_unanswered && (
                            <form action={resolveOpen} className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="room_id" value={roomId} />
                              <input type="hidden" name="id" value={q.id} />
                              <input type="hidden" name="answer" value={q.default_if_unanswered} />
                              <span>Default if unanswered: {q.default_if_unanswered}</span>
                              <button className="btn-secondary-sm">Use the default</button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {!opens.length && (
                    <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                      No open questions for this room.
                    </div>
                  )}
                </div>
                <details>
                  <summary className="btn-secondary-sm cursor-pointer">+ Open question</summary>
                  <form action={addOpenQuestion} className="card p-4 grid grid-cols-2 gap-3 text-sm mt-2">
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="room_id" value={roomId} />
                    <input name="question" required placeholder="Question (e.g. floating vanities?)" className="field col-span-2" />
                    <input name="default_if_unanswered" placeholder="Default if unanswered" className="field" />
                    <label className="flex items-center gap-2 text-slate-400 text-xs">
                      <input type="checkbox" name="blocking" defaultChecked className="accent-gold" />
                      Blocking (must be answered before the contract locks)
                    </label>
                    <button className="btn-secondary col-span-2 justify-self-start">Add question</button>
                  </form>
                </details>
              </section>

              {/* REDLINES */}
              <section id="redlines" className="scroll-mt-32 space-y-4">
                <h2 className="section-title">Redline notes from the Draft 1 markup</h2>
                <div className="space-y-2">
                  {redlines.map((r) => (
                    <div key={r.id} className="card px-4 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Pill tone="gold">{r.note_type.replace('_', ' ')}</Pill>
                        <span className="text-slate-200 min-w-0 break-words">{r.text}</span>
                        {r.source_ref && <span className="text-xs text-slate-600 ml-auto shrink-0">{r.source_ref}</span>}
                      </div>
                      {kinds.length > 0 && (
                        <details className="mt-1">
                          <summary className={'cursor-pointer text-[11px] hover:text-gold-light ' + (r.kind ? 'text-slate-500' : 'text-amber-400/80')}>
                            {r.kind ? typedAs(r.kind) : 'no kind of work yet'}
                          </summary>
                          <form action={setRedlineKind} className="mt-2 flex flex-wrap items-center gap-3">
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="room_id" value={roomId} />
                            <input type="hidden" name="note_id" value={r.id} />
                            <span className="min-w-0 sm:w-72">
                              <KindSelect kinds={kinds} value={r.kind || suggestRedlineKind(r.note_type)} />
                            </span>
                            <button className="btn-secondary-sm">Save kind</button>
                          </form>
                        </details>
                      )}
                    </div>
                  ))}
                  {!redlines.length && (
                    <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                      No redline notes for this room.
                    </div>
                  )}
                </div>
                <details>
                  <summary className="btn-secondary-sm cursor-pointer">+ Redline note</summary>
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
                    <input name="source_ref" placeholder="Sheet ref" className="field" />
                    <button className="btn-secondary col-span-4 justify-self-start">Add redline note</button>
                  </form>
                </details>
              </section>

              {/* INSPO */}
              <section id="inspo" className="scroll-mt-32 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="section-title">
                    Inspo <span className="text-slate-500">({images.length})</span>
                  </h2>
                  <Link href={'/projects/' + id + '/images'} className="text-xs text-gold-light hover:text-gold">
                    Manage images →
                  </Link>
                </div>
                {images.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {images.map((img) => (
                      <div key={img.id} className="card overflow-hidden">
                        {inspoUrls.get(img.storage_path) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={inspoUrls.get(img.storage_path)} alt={img.notes || 'inspo'} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="h-28 flex items-center justify-center text-[11px] text-slate-600">image unavailable</div>
                        )}
                        {img.notes && <div className="text-[11px] text-slate-500 px-2 py-1.5 truncate">{img.notes}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-4 text-center">
                    No inspo assigned to this room.
                  </div>
                )}
              </section>
            </>
          )}

          {view === '2d' && (
            <section className="space-y-5">
              {canApprove2d && (
                <div className="card border-violet-500/50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-200">
                    Every drawing in this room has been reviewed.
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Marking the room 2D approved lets Blueprint include it in the build.
                    </span>
                  </div>
                  <form action={set2dApproved.bind(null, roomId, id)}>
                    <button className="btn-primary">Mark room 2D approved →</button>
                  </form>
                </div>
              )}
              {!canApprove2d && !is2dApproved && pending.length + approved.length > 0 && room.review_state !== 'confirmed' && (
                <div className="text-xs text-slate-500">
                  This room must be marked “confirmed” (top right) before it can be 2D approved.
                </div>
              )}

              {pending.length > 0 && (
                <h2 className="section-title">To review ({pending.length})</h2>
              )}
              {pending.map((o) => (
                <OutlineCard key={o.id} o={o} projectId={id} roomId={roomId} imageUrl={(o.storage_path && outlineUrls.get(o.storage_path)) || null} />
              ))}

              {approved.length > 0 && <h2 className="section-title pt-2">Approved ({approved.length})</h2>}
              {approved.map((o) => (
                <OutlineCard key={o.id} o={o} projectId={id} roomId={roomId} imageUrl={(o.storage_path && outlineUrls.get(o.storage_path)) || null} />
              ))}

              {rejected.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                    {rejected.length} rejected {rejected.length === 1 ? 'draft' : 'drafts'} waiting on a redraw
                  </summary>
                  <div className="mt-3 space-y-2">
                    {rejected.map((o) => (
                      <div key={o.id} className="bg-bh-panel/40 border border-red-900/40 rounded-xl p-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Pill tone="violet">{o.outline_type}</Pill>
                          {o.label && <span className="text-slate-400">{o.label}</span>}
                          <span className="text-slate-600">{ago(o.pushed_at)}</span>
                        </div>
                        <div className="text-red-300/90">“{o.feedback}”</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {supersededCount > 0 && (
                <div className="text-xs text-slate-600">
                  {supersededCount} earlier {supersededCount === 1 ? 'version was' : 'versions were'} replaced by redraws.
                </div>
              )}

              {outlines.length === 0 && (
                <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-8 text-center">
                  No 2D drawings yet. After the contract is locked, Blueprint drafts plans and elevations for this room
                  and pushes them here for review.
                </div>
              )}
            </section>
          )}

          {/* where next */}
          <nav className="border-t border-bh-border pt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              {prev && (
                <Link href={'/projects/' + id + '/rooms/' + prev.id + '?view=' + view} className="text-slate-500 hover:text-white">
                  ← {prev.section_code} {prev.name}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {view === 'decide' && nextUnreviewed && (
                <Link href={'/projects/' + id + '/rooms/' + nextUnreviewed.id + '?view=decide'} className="btn-secondary-sm">
                  Next unreviewed: {nextUnreviewed.section_code} {nextUnreviewed.name} →
                </Link>
              )}
              {view === '2d' && nextWithOutlines && (
                <Link href={'/projects/' + id + '/rooms/' + nextWithOutlines.id + '?view=2d'} className="btn-secondary-sm">
                  Next to review: {nextWithOutlines.section_code} {nextWithOutlines.name} →
                </Link>
              )}
              {next && (
                <Link href={'/projects/' + id + '/rooms/' + next.id + '?view=' + view} className="text-slate-500 hover:text-white">
                  {next.section_code} {next.name} →
                </Link>
              )}
            </div>
          </nav>
        </div>
      </main>
    </div>
  )
}
