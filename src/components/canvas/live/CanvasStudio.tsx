'use client'

// Designer Canvas — live studio tab (v1).
// Data: StudioStateV16 from Blueprint's canvas engine via /api/canvas/* proxy.
// Modes: Room Studio (17 sheets) | Pattern & Settings Library (see PatternLibrary).
// Freeze-lock: rooms with status "frozen" need an explicit unlock before
// the Redraw button fires (contract ask #2 makes the engine the real guard).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Pill } from '@/components/pill'
import {
  sheetProxyUrl,
  type EditableSpecField,
  type RoomCanvasEntry,
  type StudioStateV16,
} from '@/lib/canvas/types'
import { PatternLibrary } from './PatternLibrary'

type Mode = 'rooms' | 'library'
type InspectorTab = 'spec' | 'transcripts' | 'shell' | 'standards'

const INSPECTOR_TABS: Array<{ key: InspectorTab; label: string }> = [
  { key: 'spec', label: 'Spec Controls' },
  { key: 'transcripts', label: 'Transcripts' },
  { key: 'shell', label: 'Shell & Notes' },
  { key: 'standards', label: 'Standards & Revit' },
]

function fmtStamp(iso?: string): string {
  if (!iso) return ''
  try {
    return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
  } catch {
    return iso
  }
}

export function CanvasStudio({ projectLabel }: { projectLabel?: string }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'offline'>('loading')
  const [state, setState] = useState<StudioStateV16 | null>(null)
  const [engineLive, setEngineLive] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode>('rooms')
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('spec')
  const [focusSpecKey, setFocusSpecKey] = useState<string | null>(null)

  // Stage (pan/zoom/compare)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [compareBaseline, setCompareBaseline] = useState(false)

  // Spec editing
  const [specDraft, setSpecDraft] = useState<Record<string, number | string>>({})
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set())
  const [redrawing, setRedrawing] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'green' | 'red' | 'gold'; text: string } | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  // ---- data loading -------------------------------------------------------

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/canvas/state', { cache: 'no-store' })
      if (!res.ok) {
        setPhase('offline')
        return
      }
      const json = (await res.json()) as StudioStateV16
      setState(json)
      setPhase('ready')
      setActiveRoomId((cur) => cur ?? json.defaultRoomId ?? json.rooms[0]?.id ?? null)
    } catch {
      setPhase('offline')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Engine liveness badge (30s poll)
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      try {
        const res = await fetch('/api/canvas/health', { cache: 'no-store' })
        if (!cancelled) setEngineLive(res.ok)
      } catch {
        if (!cancelled) setEngineLive(false)
      }
    }
    void probe()
    const t = setInterval(probe, 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const activeRoom = useMemo<RoomCanvasEntry | null>(
    () => state?.rooms.find((r) => r.id === activeRoomId) ?? state?.rooms[0] ?? null,
    [state, activeRoomId],
  )

  // Reset the editing surface whenever the working room (or its committed spec) changes
  useEffect(() => {
    setSpecDraft(
      Object.fromEntries(
        Object.entries(activeRoom?.editableSpec ?? {}).map(([k, f]) => [k, f.value]),
      ),
    )
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setCompareBaseline(false)
    setNotice(null)
    setFocusSpecKey(null)
  }, [activeRoom])

  // ---- freeze lock --------------------------------------------------------

  const roomLocked = activeRoom != null && activeRoom.status === 'frozen' && !unlocked.has(activeRoom.id)

  // ---- spec draft / dirty keys --------------------------------------------

  const dirtyKeys = useMemo(() => {
    if (!activeRoom) return []
    return Object.keys(specDraft).filter((k) => {
      const orig = activeRoom.editableSpec[k]?.value
      return orig !== undefined && String(orig) !== String(specDraft[k])
    })
  }, [specDraft, activeRoom])

  const redraw = useCallback(async () => {
    if (!activeRoom || dirtyKeys.length === 0 || redrawing) return
    setRedrawing(true)
    setNotice(null)
    try {
      const res = await fetch('/api/canvas/redraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId: activeRoom.id,
          specUpdates: Object.fromEntries(dirtyKeys.map((k) => [k, specDraft[k]])),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        renderMs?: number
        error?: string
        code?: string
        updatedRoom?: RoomCanvasEntry
      }
      if (res.ok && json.ok && json.updatedRoom) {
        const updated = json.updatedRoom
        setState((s) =>
          s ? { ...s, rooms: s.rooms.map((r) => (r.id === updated.id ? updated : r)) } : s,
        )
        setNotice({
          tone: 'green',
          text: `Sheet redrawn in ${Math.round(json.renderMs ?? 0)}ms — compare baseline to review.`,
        })
      } else if (json.code === 'room_frozen') {
        setNotice({ tone: 'gold', text: 'Room is freeze-locked — unlock it below the spec controls first.' })
      } else {
        setNotice({ tone: 'red', text: json.error || `Redraw failed (${res.status})` })
      }
    } catch {
      setNotice({ tone: 'red', text: 'Redraw request failed — engine unreachable?' })
    } finally {
      setRedrawing(false)
    }
  }, [activeRoom, dirtyKeys, specDraft, redrawing])

  // ---- stage interaction --------------------------------------------------

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(6, Math.max(0.25, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    setPan({ x: d.panX + (e.clientX - d.x), y: d.panY + (e.clientY - d.y) })
  }
  function onPointerUp() {
    dragRef.current = null
  }

  function focusSpec(specKey?: string) {
    setInspectorTab('spec')
    setFocusSpecKey(specKey ?? null)
  }

  useEffect(() => {
    if (!focusSpecKey) return
    const el = document.getElementById(`spec-row-${focusSpecKey}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusSpecKey, inspectorTab])

  // ---- navigator grouping -------------------------------------------------

  const categories = useMemo(() => {
    const map = new Map<string, RoomCanvasEntry[]>()
    for (const r of state?.rooms ?? []) {
      const list = map.get(r.category)
      if (list) list.push(r)
      else map.set(r.category, [r])
    }
    return [...map.entries()]
  }, [state])

  // ---- render -------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="app-container py-10 text-slate-400 text-sm">Loading Designer Canvas…</div>
    )
  }

  if (phase === 'offline') {
    return (
      <div className="app-container py-10">
        <div className="rounded-xl border border-bh-border bg-bh-card p-8 max-w-xl">
          <h1 className="text-lg font-semibold text-white mb-2">Canvas engine offline</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The Designer Canvas tab is wired, but the live engine is not reachable from this app
            yet (routing decision pending — see Tony). Nothing is broken; the tab will light up
            the moment <code className="text-gold-light">CANVAS_ENGINE_URL</code> points at a
            reachable engine.
          </p>
          <button className="btn-secondary mt-5" onClick={() => { setPhase('loading'); void refresh() }}>
            Retry connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container pb-10 flex flex-col gap-4">
      {/* header: mode switcher + engine badge */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-bh-border bg-bh-card p-1">
          <button
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${mode === 'rooms' ? 'bg-gold text-slate-950' : 'text-slate-300 hover:text-white'}`}
            onClick={() => setMode('rooms')}
          >
            Project Room Studio
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${mode === 'library' ? 'bg-gold text-slate-950' : 'text-slate-300 hover:text-white'}`}
            onClick={() => setMode('library')}
          >
            Pattern &amp; Settings Library
          </button>
        </div>
        {state && (
          <div className="text-xs text-slate-500 min-w-0">
            <span className="text-slate-300 font-medium truncate">
              {projectLabel ? `${projectLabel} · ` : ''}
              {state.project}
            </span>{' '}
            · {state.subtitle} · {state.rooms.length} rooms · {state.library.patternCount} patterns ·{' '}
            {state.library.totalSettingsKeys} keys
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {engineLive != null && (
            <Pill tone={engineLive ? 'green' : 'red'}>{engineLive ? 'engine live' : 'engine offline'}</Pill>
          )}
          {state?.constraints.revitWrites === 0 && (
            <Pill tone="outline" title="The canvas never writes to Revit — pre-commanded calls are queued, display only.">
              revit writes: 0
            </Pill>
          )}
        </div>
      </div>

      {mode === 'library' && state ? (
        <PatternLibrary library={state.library} />
      ) : state ? (
        <div className="flex flex-col lg:grid lg:grid-cols-[230px_minmax(0,1fr)_340px] gap-4">
          {/* left: room navigator */}
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[78vh] rounded-xl border border-bh-border bg-bh-card p-2">
            {categories.map(([category, rooms]) => (
              <div key={category} className="flex lg:flex-col gap-1.5 shrink-0">
                <div className="hidden lg:block text-[10px] uppercase tracking-[0.18em] text-slate-500 px-1 pt-1 pb-0.5">
                  {category}
                </div>
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRoomId(r.id)}
                    className={`text-left rounded-lg border px-2.5 py-1.5 min-w-[130px] transition-colors ${
                      r.id === activeRoom?.id
                        ? 'border-gold bg-gold/10'
                        : 'border-transparent hover:border-bh-border'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-slate-200">
                      {r.code}
                      {r.status === 'frozen' && <span title="Freeze-locked — unlock to edit"> 🔒</span>}
                      {r.status === 'updated' && <span title="Updated since baseline"> ⟳</span>}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate">
                      {r.name.split('—')[1] ?? r.name}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* center: stage */}
          <section className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-200">{activeRoom?.code}</span>
              <span className="text-slate-500 truncate flex-1 min-w-0">{activeRoom?.name}</span>
              {activeRoom?.roomVersion && <Pill tone="outline">{activeRoom.roomVersion}</Pill>}
              {activeRoom?.lastRedrawMs != null && (
                <Pill tone="blue" title="Last sheet redraw">{`${Math.round(activeRoom.lastRedrawMs)}ms`}</Pill>
              )}
              {activeRoom?.baselineFile && (
                <button
                  className={`btn-secondary-sm ${compareBaseline ? 'border-gold text-gold-light' : ''}`}
                  onClick={() => setCompareBaseline((c) => !c)}
                >
                  {compareBaseline ? 'Showing baseline' : 'Compare baseline'}
                </button>
              )}
              <div className="flex items-center gap-1">
                <button className="btn-secondary-sm" onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>−</button>
                <span className="text-slate-500 tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button className="btn-secondary-sm" onClick={() => setZoom((z) => Math.min(6, z * 1.25))}>+</button>
                <button
                  className="btn-secondary-sm"
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                >
                  reset
                </button>
              </div>
            </div>

            <div
              ref={stageRef}
              className="relative flex-1 overflow-hidden rounded-xl border border-bh-border bg-bh-panel cursor-grab active:cursor-grabbing min-h-[420px] max-h-[70vh] flex items-center justify-center"
              style={{ touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {activeRoom && (
                <div
                  className="relative"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: dragRef.current ? 'none' : 'transform 120ms ease-out',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sheetProxyUrl(
                      compareBaseline && activeRoom.baselineFile
                        ? activeRoom.baselineFile
                        : activeRoom.sheetFile,
                    )}
                    alt={activeRoom.name}
                    className="block max-h-[70vh] w-auto select-none rounded-lg"
                    draggable={false}
                  />
                  <div className="absolute inset-0">
                    {(activeRoom.hotspots ?? []).map((h) => (
                      <button
                        key={h.id}
                        title={h.specKey ? `${h.label} → ${h.specKey}` : h.label}
                        onClick={(e) => {
                          e.stopPropagation()
                          focusSpec(h.specKey)
                        }}
                        className="absolute rounded border border-gold-light/70 bg-gold/20 hover:bg-gold/45 text-[10px] leading-tight text-gold-light px-1 truncate"
                        style={{
                          left: `${h.xPct}%`,
                          top: `${h.yPct}%`,
                          width: `${h.wPct}%`,
                          height: `${h.hPct}%`,
                        }}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-600">
              drag to pan · wheel to zoom · gold boxes are hotspots (click jumps to the spec control)
            </p>
          </section>

          {/* right: inspector */}
          <section className="flex flex-col rounded-xl border border-bh-border bg-bh-card min-w-0">
            <div className="flex flex-wrap border-b border-bh-border">
              {INSPECTOR_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setInspectorTab(t.key)}
                  className={`px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                    inspectorTab === t.key
                      ? 'text-gold-light border-b-2 border-gold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto max-h-[70vh] p-3 flex flex-col gap-3">
              {inspectorTab === 'spec' && <SpecControls
                room={activeRoom}
                draft={specDraft}
                setDraft={setSpecDraft}
                locked={roomLocked}
                dirtyCount={dirtyKeys.length}
                redrawing={redrawing}
                notice={notice}
                onRedraw={() => void redraw()}
                onUnlock={() => activeRoom && setUnlocked((u) => new Set(u).add(activeRoom.id))}
                onRelock={() => activeRoom && setUnlocked((u) => {
                  const next = new Set(u)
                  next.delete(activeRoom.id)
                  return next
                })}
                focusKey={focusSpecKey}
              />}

              {inspectorTab === 'transcripts' && (
                <div className="flex flex-col gap-2">
                  {(activeRoom?.transcripts ?? []).length === 0 && (
                    <p className="text-xs text-slate-500">No transcript decisions on this room yet.</p>
                  )}
                  {(activeRoom?.transcripts ?? []).map((t, i) => (
                    <div key={i} className="rounded-lg border border-bh-border bg-bh-black p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Pill tone={t.status === 'CONFIRMED' ? 'green' : 'gold'}>{t.status}</Pill>
                        <span className="text-[10px] text-slate-500">{t.meeting}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-300">{t.topic}</div>
                      <p className="text-xs text-slate-400 italic mt-1">“{t.quote}”</p>
                    </div>
                  ))}
                </div>
              )}

              {inspectorTab === 'shell' && activeRoom && (
                <div className="flex flex-col gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Shell dimensions</div>
                    <div className="font-mono text-slate-300 bg-bh-black rounded-lg border border-bh-border p-2.5">
                      {activeRoom.shellAndNotes.dimensions}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Revit elements</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeRoom.shellAndNotes.revitElements.map((el) => (
                        <span key={el} className="pill pill-outline font-mono text-[10px]">{el}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Redline notes → resolutions</div>
                    {activeRoom.shellAndNotes.planNotes.map((n, i) => (
                      <div key={i} className="rounded-lg border border-bh-border bg-bh-black p-2.5 mb-1.5">
                        <div className="text-slate-400">{n.note}</div>
                        <div className="text-emerald-300/80 mt-0.5">→ {n.resolution}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectorTab === 'standards' && activeRoom && (
                <div className="flex flex-col gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Standard doc</div>
                    <div className="font-mono text-gold-light bg-bh-black rounded-lg border border-bh-border p-2.5">
                      {activeRoom.knowledgeBase.standardDoc}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Rules in force</div>
                    <ul className="list-disc pl-4 text-slate-400 space-y-1">
                      {activeRoom.knowledgeBase.rules.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">
                      Pre-commanded Revit calls (queued — hold in place)
                    </div>
                    <table className="w-full text-[11px]">
                      <tbody className="text-slate-400">
                        {activeRoom.knowledgeBase.preCommandedRevitCalls.map((c) => (
                          <tr key={c.call} className="border-b border-bh-border/60">
                            <td className="py-1 pr-2 text-slate-500 tabular-nums">#{c.call}</td>
                            <td className="py-1 pr-2 text-slate-300">{c.op}</td>
                            <td className="py-1 font-mono text-[10px]">{c.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    revitWrites stays 0 until the Revit hold lifts — these calls are display-only.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {state && (
        <p className="text-[10px] text-slate-600">
          {state.version} · generated {fmtStamp(state.generatedAt)} · engine {state.constraints.frozenRoomsProtected ? 'protects' : 'does not protect'} frozen rooms
        </p>
      )}
    </div>
  )
}

// ---- Spec Controls (inspector tab 1) ----------------------------------------

function SpecControls({
  room,
  draft,
  setDraft,
  locked,
  dirtyCount,
  redrawing,
  notice,
  onRedraw,
  onUnlock,
  onRelock,
  focusKey,
}: {
  room: RoomCanvasEntry | null
  draft: Record<string, number | string>
  setDraft: (d: Record<string, number | string>) => void
  locked: boolean
  dirtyCount: number
  redrawing: boolean
  notice: { tone: 'green' | 'red' | 'gold'; text: string } | null
  onRedraw: () => void
  onUnlock: () => void
  onRelock: () => void
  focusKey: string | null
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Array<[string, EditableSpecField]>>()
    for (const [key, field] of Object.entries(room?.editableSpec ?? {})) {
      const g = field.group ?? 'Spec'
      const list = map.get(g)
      if (list) list.push([key, field])
      else map.set(g, [[key, field]])
    }
    return [...map.entries()]
  }, [room])

  if (!room) return <p className="text-xs text-slate-500">No room selected.</p>

  return (
    <div className="flex flex-col gap-3">
      {locked && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 p-2.5 flex items-center gap-2">
          <span className="text-xs text-gold-light flex-1">🔒 Freeze-locked room — edits held.</span>
          <button className="btn-secondary-sm" onClick={onUnlock}>Unlock</button>
        </div>
      )}
      {!locked && room.status === 'frozen' && (
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>unlocked for editing</span>
          <button className="btn-secondary-sm" onClick={onRelock}>Re-lock</button>
        </div>
      )}

      {notice && <Pill tone={notice.tone}>{notice.text}</Pill>}

      {groups.map(([group, fields]) => (
        <div key={group}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">{group}</div>
          <div className="flex flex-col gap-2">
            {fields.map(([key, field]) => (
              <label
                key={key}
                id={`spec-row-${key}`}
                className={`flex items-center gap-2 rounded-lg border bg-bh-black px-2.5 py-2 ${
                  focusKey === key ? 'border-gold ring-1 ring-gold/60' : 'border-bh-border'
                }`}
              >
                <span className="text-[11px] text-slate-400 flex-1 min-w-0 truncate" title={field.label}>
                  {field.label}
                  {field.unit ? <span className="text-slate-600"> ({field.unit})</span> : null}
                </span>
                {field.type === 'select' ? (
                  <select
                    className="w-auto rounded-lg border border-bh-border bg-bh-black px-2 py-1 text-xs text-slate-200 focus:border-gold focus:outline-none"
                    disabled={locked}
                    value={String(draft[key] ?? field.value)}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  >
                    {(field.options ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-28 rounded-lg border border-bh-border bg-bh-black px-2 py-1 text-xs text-right text-slate-200 tabular-nums focus:border-gold focus:outline-none"
                    type={field.type === 'number' ? 'number' : 'text'}
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    disabled={locked}
                    value={String(draft[key] ?? field.value)}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        className="btn-primary"
        disabled={locked || dirtyCount === 0 || redrawing}
        onClick={onRedraw}
        title={locked ? 'Unlock the room first' : dirtyCount === 0 ? 'Change a spec value to enable' : 'Re-render the sheet from the plate'}
      >
        {redrawing ? 'Redrawing…' : `Redraw Sheet${dirtyCount > 0 ? ` (${dirtyCount} change${dirtyCount === 1 ? '' : 's'})` : ''}`}
      </button>
    </div>
  )
}
