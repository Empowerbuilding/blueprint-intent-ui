'use client'

// Designer Canvas — Barnhaus Pattern & Settings Library (mode 2).
// 22 reusable wall/room patterns + 530 settings keys. Pattern re-renders
// via POST /api/canvas/redraw-pattern (sub-second, no Revit writes).

import { useEffect, useMemo, useState } from 'react'
import { Pill } from '@/components/pill'
import {
  sheetProxyUrl,
  type PatternEntry,
  type PatternLibraryCatalog,
  type TunableSetting,
} from '@/lib/canvas/types'

interface Notice {
  tone: 'green' | 'red' | 'gold'
  text: string
}

export function PatternLibrary({ library }: { library: PatternLibraryCatalog }) {
  // Local copy of patterns so redraw updates swap in updatedPattern without a full reload.
  const [patterns, setPatterns] = useState<PatternEntry[]>(library.patterns)
  const [bust, setBust] = useState<Record<string, number>>({})
  const [drafts, setDrafts] = useState<Record<string, Record<string, number | string>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    setPatterns(library.patterns)
    setDrafts({})
    setBust({})
    setNotice(null)
  }, [library])

  const settingsTypes = useMemo(
    () => Object.entries(library.settingsByType ?? {}),
    [library],
  )

  function draftFor(p: PatternEntry): Record<string, number | string> {
    return (
      drafts[p.id] ??
      Object.fromEntries(p.tunableSettings.map((s) => [s.key, s.value]))
    )
  }

  function dirtyFor(p: PatternEntry): string[] {
    const draft = drafts[p.id]
    if (!draft) return []
    return p.tunableSettings
      .filter((s) => String(s.value) !== String(draft[s.key]))
      .map((s) => s.key)
  }

  async function rerender(p: PatternEntry) {
    const dirty = dirtyFor(p)
    if (busyId || !drafts[p.id]) return
    if (dirty.length === 0) {
      setNotice({ tone: 'gold', text: 'Change a setting first — nothing to re-render.' })
      return
    }
    setBusyId(p.id)
    setNotice(null)
    try {
      const settings = Object.fromEntries(dirty.map((k) => [k, drafts[p.id]![k]]))
      const res = await fetch('/api/canvas/redraw-pattern', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patternId: p.id, overrides: { settings } }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        renderMs?: number
        error?: string
        code?: string
        updatedPattern?: PatternEntry
      }
      if (res.ok && json.ok && json.updatedPattern) {
        const updated = json.updatedPattern
        setPatterns((list) => list.map((x) => (x.id === updated.id ? updated : x)))
        setBust((b) => ({ ...b, [p.id]: Date.now() }))
        setDrafts((d) => {
          const next = { ...d }
          delete next[p.id]
          return next
        })
        setNotice({ tone: 'green', text: `${p.name} re-rendered in ${Math.round(json.renderMs ?? 0)}ms.` })
      } else {
        setNotice({ tone: 'red', text: json.error || `Re-render failed (${res.status})` })
      }
    } catch {
      setNotice({ tone: 'red', text: 'Re-render request failed — engine unreachable?' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="text-slate-300 font-medium">{library.patternCount} patterns</span>
        <span>· {library.totalSettingsKeys} settings keys</span>
        <span>· {library.roomSettingsFileCount} room settings files</span>
        <span>· {library.primitiveCount} primitives</span>
        {notice && <Pill tone={notice.tone}>{notice.text}</Pill>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {patterns.map((p) => {
          const draft = draftFor(p)
          const dirty = dirtyFor(p)
          return (
            <article key={p.id} className="flex flex-col gap-2 rounded-xl border border-bh-border bg-bh-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sheetProxyUrl(p.imageFile) + (bust[p.id] ? `?v=${bust[p.id]}` : '')}
                alt={`${p.name} — ${p.title}`}
                className="w-full rounded-lg border border-bh-border bg-bh-black"
                draggable={false}
              />
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                <Pill tone={p.status === 'live' || p.status === 'accepted' ? 'green' : 'outline'}>{p.status}</Pill>
                <span className="ml-auto text-[10px] text-slate-500 shrink-0">{p.type}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{p.title}</p>
              <p className="text-[10px] text-slate-600">
                {p.settingsType} · wall {p.wallWidthIn}″ · ceiling {p.ceilingIn}″ · {p.referencedKeysCount} keys
              </p>

              <details className="rounded-lg border border-bh-border bg-bh-black p-2">
                <summary className="text-[11px] text-slate-400 cursor-pointer select-none">
                  Tune settings ({p.tunableSettings.length})
                </summary>
                <div className="mt-2 flex flex-col gap-1.5">
                  {p.tunableSettings.map((s: TunableSetting) => (
                    <label key={s.key} className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-500 flex-1 truncate" title={s.key}>
                        {s.key}
                        {s.unit ? <span className="text-slate-600"> ({s.unit})</span> : null}
                      </span>
                      <input
                        className="w-24 rounded-lg border border-bh-border bg-bh-black px-2 py-0.5 text-xs text-right text-slate-200 tabular-nums focus:border-gold focus:outline-none"
                        type="number"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={String(draft[s.key] ?? s.value)}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [p.id]: { ...draft, [s.key]: e.target.value } }))
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="btn-primary-sm mt-1"
                    disabled={busyId === p.id || dirty.length === 0}
                    onClick={() => void rerender(p)}
                  >
                    {busyId === p.id ? 'Rendering…' : dirty.length > 0 ? `Re-render (${dirty.length})` : 'Re-render'}
                  </button>
                </div>
              </details>
            </article>
          )
        })}
      </div>

      {settingsTypes.length > 0 && (
        <details className="rounded-xl border border-bh-border bg-bh-card p-3">
          <summary className="text-xs text-slate-400 cursor-pointer select-none">
            Settings catalog by type ({settingsTypes.length} types)
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {settingsTypes.map(([type, settings]) => (
              <div key={type} className="text-[11px]">
                <span className="text-slate-300 font-mono">{type}</span>
                <span className="text-slate-600">
                  {' '}
                  — {Object.keys(settings ?? {}).length} keys
                </span>
                <span className="text-slate-600"> · {Object.keys(settings ?? {}).slice(0, 12).join(', ')}
                  {Object.keys(settings ?? {}).length > 12 ? ' …' : ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
