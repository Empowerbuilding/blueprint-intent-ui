'use client'

import React, { useState } from 'react'
import {
  BAY_PRESETS,
  formatArchInches,
  formatInchesOnly,
  getPresetMeta,
  snapHalfInch,
  type BayKind,
  type CaseworkBay,
  type RoomCheck,
  type RoomNode,
  type RoomStatus,
  type WallEdge,
} from '@/lib/canvas-matrix'

interface BayInspectorProps {
  room: RoomNode
  wall: WallEdge
  selectedBay: CaseworkBay | null
  checks: RoomCheck[]
  lastCommandFeedback: string | null
  onSelectBay: (bayId: string) => void
  onUpdateBay: (bayId: string, patch: Partial<CaseworkBay>) => void
  onChangeBayKind: (bayId: string, kind: BayKind) => void
  onMoveBay: (bayId: string, dir: -1 | 1) => void
  onDuplicateBay: (bayId: string) => void
  onDeleteBay: (bayId: string) => void
  onAddBay: (kind: BayKind) => void
  onSymmetrizeWall: () => void
  onChangeRoomStatus: (status: RoomStatus) => void
  onRunQuickCommand: (command: string) => void
}

const CHECK_BADGE: Record<RoomCheck['status'], string> = {
  pass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
  warn: 'bg-amber-950/80 text-amber-300 border-amber-700/50',
  fail: 'bg-rose-950/80 text-rose-300 border-rose-700/50',
}

const QUICK_SHORTHANDS = [
  '60 vanity symmetric',
  'add 18 drawer',
  '3 shelves',
  'align tops 96',
  'nudge wall +2',
]

export function BayInspector({
  room,
  wall,
  selectedBay,
  checks,
  lastCommandFeedback,
  onSelectBay,
  onUpdateBay,
  onChangeBayKind,
  onMoveBay,
  onDuplicateBay,
  onDeleteBay,
  onAddBay,
  onSymmetrizeWall,
  onChangeRoomStatus,
  onRunQuickCommand,
}: BayInspectorProps) {
  const [commandText, setCommandText] = useState('')

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandText.trim()) return
    onRunQuickCommand(commandText)
    setCommandText('')
  }

  return (
    <aside className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-bh-border bg-bh-panel flex flex-col min-h-0">
      {/* Scrollable Inspector & Live Checks */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Room Approval Status Toggle */}
        <div className="rounded-lg border border-bh-border bg-bh-black/70 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Room Status · {room.number}
            </span>
            <span className="text-[10px] font-mono text-slate-500">{wall.shortLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-bh-panel p-0.5 border border-bh-border/70">
            {(
              [
                { id: 'draft', label: 'Draft', activeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                { id: 'approved', label: 'Approved', activeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                { id: 'needs_review', label: 'Review', activeCls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
              ] as const
            ).map((st) => {
              const active = room.status === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  data-testid={`room-status-${st.id}`}
                  onClick={() => onChangeRoomStatus(st.id)}
                  className={
                    'rounded py-1 text-[11px] font-semibold transition-colors border ' +
                    (active
                      ? st.activeCls
                      : 'border-transparent text-slate-400 hover:text-white')
                  }
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bay Strip + Parametric Bay Inspector */}
        <div className="rounded-lg border border-bh-border bg-bh-card/70 p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Bay Inspector ({wall.bays.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onAddBay('drawer_stack')}
                className="rounded border border-bh-border bg-bh-black px-2 py-0.5 text-[10px] font-medium text-gold-light hover:border-gold transition-colors"
              >
                + Add Bay
              </button>
              <button
                type="button"
                data-testid="btn-symmetrize"
                onClick={onSymmetrizeWall}
                className="rounded border border-bh-border bg-bh-black px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:border-sky-400 transition-colors"
                title="Equalize flanking bays around focal center"
              >
                Symmetrize
              </button>
            </div>
          </div>

          {/* Compact Horizontal Bay Selector Chips */}
          <div className="flex flex-wrap gap-1">
            {wall.bays.map((b, idx) => {
              const isSel = selectedBay?.id === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectBay(b.id)}
                  className={
                    'rounded px-2 py-0.5 text-[10px] font-mono transition-colors border ' +
                    (isSel
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400 font-semibold'
                      : 'bg-bh-black/80 text-slate-400 border-bh-border hover:text-white')
                  }
                >
                  #{idx + 1} · {formatInchesOnly(b.widthIn)}
                </button>
              )
            })}
          </div>

          {selectedBay ? (
            <div className="space-y-2.5 pt-1 border-t border-bh-border/70">
              {/* Preset Kind Dropdown */}
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">
                  Architectural Bay Kind
                </label>
                <select
                  value={selectedBay.kind}
                  onChange={(e) => onChangeBayKind(selectedBay.id, e.target.value as BayKind)}
                  className="w-full rounded-md border border-bh-border bg-bh-black px-2.5 py-1.5 text-xs text-white focus:border-gold focus:outline-none"
                >
                  {BAY_PRESETS.map((p) => (
                    <option key={p.kind} value={p.kind}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Width Stepper + 0.5"-Snapped Input */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Width (snaps to 1/2&quot;)</span>
                  <span className="font-mono text-slate-200">
                    {formatArchInches(selectedBay.widthIn)} ({formatInchesOnly(selectedBay.widthIn)})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {([-3, -0.5, 0.5, 3] as const).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() =>
                        onUpdateBay(selectedBay.id, {
                          widthIn: Math.max(9, snapHalfInch(selectedBay.widthIn + delta)),
                          label: `${formatInchesOnly(Math.max(9, snapHalfInch(selectedBay.widthIn + delta)))} ${getPresetMeta(selectedBay.kind).label}`,
                        })
                      }
                      className="flex-1 rounded border border-bh-border bg-bh-black py-1 text-[11px] font-mono text-slate-300 hover:border-slate-500 hover:text-white"
                    >
                      {delta > 0 ? `+${delta}"` : `${delta}"`}
                    </button>
                  ))}
                  <input
                    type="number"
                    step="0.5"
                    min="9"
                    max="240"
                    value={selectedBay.widthIn}
                    onChange={(e) => {
                      const val = snapHalfInch(parseFloat(e.target.value))
                      if (val >= 9) {
                        onUpdateBay(selectedBay.id, { widthIn: val })
                      }
                    }}
                    className="w-16 rounded border border-bh-border bg-bh-black px-2 py-1 text-right font-mono text-xs text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              {/* Height & AFF Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Height (in)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="6"
                    max="260"
                    value={selectedBay.heightIn}
                    onChange={(e) => {
                      const val = snapHalfInch(parseFloat(e.target.value))
                      if (val >= 6) onUpdateBay(selectedBay.id, { heightIn: val })
                    }}
                    className="w-full rounded border border-bh-border bg-bh-black px-2 py-1 font-mono text-xs text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Sill / AFF (in)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="180"
                    value={selectedBay.affIn}
                    onChange={(e) => {
                      const val = snapHalfInch(parseFloat(e.target.value))
                      if (val >= 0) onUpdateBay(selectedBay.id, { affIn: val })
                    }}
                    className="w-full rounded border border-bh-border bg-bh-black px-2 py-1 font-mono text-xs text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              {/* Contextual Toggles (Mirror/Sconces on Sink, Lower Base on Shelves) */}
              {selectedBay.kind === 'sink_base' && (
                <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] text-slate-300">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBay.hasMirror)}
                      onChange={(e) => onUpdateBay(selectedBay.id, { hasMirror: e.target.checked })}
                      className="accent-amber-500"
                    />
                    42×48 Mirror
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBay.hasSconces)}
                      onChange={(e) => onUpdateBay(selectedBay.id, { hasSconces: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Sconces @ 66&quot;
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBay.fullHeightSplash)}
                      onChange={(e) =>
                        onUpdateBay(selectedBay.id, { fullHeightSplash: e.target.checked })
                      }
                      className="accent-amber-500"
                    />
                    Slab Splash
                  </label>
                </div>
              )}

              {selectedBay.kind === 'floating_shelves' && (
                <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-300">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBay.withLowerBase)}
                      onChange={(e) =>
                        onUpdateBay(selectedBay.id, { withLowerBase: e.target.checked })
                      }
                      className="accent-amber-500"
                    />
                    Include Lower Base Cabinet
                  </label>
                  <select
                    value={selectedBay.shelfCount ?? 3}
                    onChange={(e) =>
                      onUpdateBay(selectedBay.id, { shelfCount: parseInt(e.target.value, 10) })
                    }
                    className="rounded border border-bh-border bg-bh-black px-1.5 py-0.5 text-[11px]"
                  >
                    <option value={2}>2 Planks</option>
                    <option value={3}>3 Planks</option>
                    <option value={4}>4 Planks</option>
                  </select>
                </div>
              )}

              {/* Reorder / Duplicate / Delete Row */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => onMoveBay(selectedBay.id, -1)}
                  className="rounded border border-bh-border bg-bh-black py-1 text-[10px] text-slate-300 hover:text-white"
                >
                  ← Left
                </button>
                <button
                  type="button"
                  onClick={() => onMoveBay(selectedBay.id, 1)}
                  className="rounded border border-bh-border bg-bh-black py-1 text-[10px] text-slate-300 hover:text-white"
                >
                  Right →
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateBay(selectedBay.id)}
                  className="rounded border border-bh-border bg-bh-black py-1 text-[10px] text-slate-300 hover:text-white"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBay(selectedBay.id)}
                  disabled={wall.bays.length <= 1}
                  className="rounded border border-red-900/60 bg-red-950/40 py-1 text-[10px] text-red-300 hover:bg-red-900/50 disabled:opacity-30"
                >
                  Delete
                </button>
              </div>

              {/* Quiet Revit Family Mapping Pill */}
              <div className="rounded-md border border-bh-border/80 bg-bh-black/90 px-2.5 py-1.5 text-[10px] text-slate-400 font-mono leading-relaxed">
                <div className="text-slate-300 truncate">Revit: {selectedBay.revitFamily}</div>
                <div className="text-slate-500 truncate">Param: {selectedBay.revitParams}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-bh-border bg-bh-black/40 px-3 py-3 text-[11px] text-slate-400">
              Click any cabinet, appliance, chase, or opening bay on the Elevation or Room Plan
              (or choose a chip above) to edit width, datum height, and Revit parameters.
            </div>
          )}
        </div>

        {/* Live Measured Rule & Datum Checks */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Live Measured Rule Checks
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {checks.filter((c) => c.status === 'pass').length}/{checks.length} Passing
            </span>
          </div>

          <div className="space-y-1.5">
            {checks.map((chk) => (
              <div
                key={chk.id}
                className="rounded-lg border border-bh-border bg-bh-black/75 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{chk.label}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${CHECK_BADGE[chk.status]}`}
                  >
                    {chk.measured}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{chk.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Instant Deterministic Design Command Bar */}
      <div className="border-t border-bh-border bg-bh-black p-2.5 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light">
            Instant Design Bar (&lt;1 ms)
          </span>
          <span className="text-[10px] text-slate-500">Deterministic CAD</span>
        </div>

        <form onSubmit={handleCommandSubmit} className="flex gap-1.5">
          <input
            type="text"
            data-testid="design-command-input"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder='e.g. "60 vanity symmetric" or "nudge wall +2"'
            className="flex-1 min-w-0 rounded-md border border-bh-border bg-bh-panel px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-gold px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-gold-light transition-colors shrink-0"
          >
            Apply
          </button>
        </form>

        {/* 1-Tap Shorthand Chips */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {QUICK_SHORTHANDS.map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => onRunQuickCommand(sh)}
              className="rounded border border-bh-border/80 bg-bh-panel px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
            >
              {sh}
            </button>
          ))}
        </div>

        {lastCommandFeedback && (
          <div className="mt-1.5 rounded bg-sky-950/50 border border-sky-800/50 px-2 py-1 text-[10px] text-sky-200">
            {lastCommandFeedback}
          </div>
        )}
      </div>
    </aside>
  )
}
