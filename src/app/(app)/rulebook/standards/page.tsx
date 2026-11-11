export const dynamic = 'force-dynamic'

import { fmtDate, fmtDateTime, viewerTimeZone } from '@/lib/time'
import { createClient } from '@/lib/supabase/server'
import { saveStandard, restoreVersion } from '@/app/standards-actions'
import Markdown from '@/components/markdown'
import { RulebookHeader } from '@/components/rulebook-header'
import { Pill } from '@/components/pill'
import { lineDiff, foldDiff, diffStats } from '@/lib/diff'
import Link from 'next/link'

// RULEBOOK · STANDARDS — the written rules and process Blueprint works from.
// One document at a time (list on the left), with its history beside it and a
// before/after view of exactly what each save changed.

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'process', label: 'Process' },
  { key: 'modeling', label: 'Modeling' },
  { key: 'construction_docs', label: 'Construction docs' },
  { key: 'components', label: 'Component library' },
]

type Standard = {
  id: string
  slug: string
  category: string
  title: string
  description: string
  content: string
  source_path: string | null
  version: number
  updated_at: string
}
type VersionRow = {
  id: string
  version: number
  note: string | null
  created_at: string
  edited_by: string | null
}

export default async function StandardsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; compare?: string; error?: string; saved?: string; nochange?: string }>
}) {
  const { doc, compare, error, saved, nochange } = await searchParams
  const tz = await viewerTimeZone()
  const supabase = await createClient()

  const { data: standardRows } = await supabase.from('intent_standards').select('*').eq('active', true).order('title')
  const standards = (standardRows || []) as Standard[]
  const current = standards.find((s) => s.slug === doc) || standards[0] || null

  let versions: VersionRow[] = []
  let diff: { version: number; rows: ReturnType<typeof foldDiff>; added: number; removed: number; first: boolean } | null = null
  if (current) {
    const { data: versionRows } = await supabase
      .from('intent_standards_versions')
      .select('id, version, note, created_at, edited_by')
      .eq('standard_id', current.id)
      .order('version', { ascending: false })
    versions = (versionRows || []) as VersionRow[]

    const n = Number(compare)
    if (Number.isInteger(n) && n >= 1) {
      const { data: pair } = await supabase
        .from('intent_standards_versions')
        .select('version, content')
        .eq('standard_id', current.id)
        .in('version', [n, n - 1])
      const rows = (pair || []) as { version: number; content: string }[]
      const after = rows.find((r) => r.version === n)
      const before = rows.find((r) => r.version === n - 1)
      if (after) {
        const lines = lineDiff(before?.content || '', after.content)
        diff = { version: n, rows: foldDiff(lines, 2), ...diffStats(lines), first: !before }
      }
    }
  }
  const here = current ? '/rulebook/standards?doc=' + current.slug : '/rulebook/standards'

  return (
    <main>
      <RulebookHeader active="standards" />

      <div className="app-container py-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* document list */}
        <nav className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Standards documents">
          {CATEGORIES.map((cat) => {
            const docs = standards.filter((s) => s.category === cat.key)
            if (!docs.length) return null
            return (
              <div key={cat.key}>
                <div className="section-title mb-2">{cat.label}</div>
                <div className="space-y-1">
                  {docs.map((s) => (
                    <Link
                      key={s.id}
                      href={'/rulebook/standards?doc=' + s.slug}
                      aria-current={current?.id === s.id ? 'page' : undefined}
                      className={
                        'block rounded-lg px-3 py-2 text-sm transition-colors ' +
                        (current?.id === s.id
                          ? 'bg-bh-card text-white border border-bh-border'
                          : 'text-slate-400 hover:text-white hover:bg-bh-card/60 border border-transparent')
                      }
                    >
                      {s.title}
                      <span className="block text-[10px] text-slate-600 mt-0.5">
                        v{s.version} · {fmtDate(s.updated_at, tz)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
          {standards.length === 0 && <div className="text-sm text-slate-600">No standards yet.</div>}
        </nav>

        {/* selected document */}
        <div className="min-w-0 space-y-6">
          {error && <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{error}</div>}
          {saved && !nochange && (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-300">
              Saved as a new version. Blueprint has been told to pull the update.
            </div>
          )}
          {saved && nochange && (
            <div className="bg-slate-800/40 border border-slate-600 rounded-xl p-4 text-sm text-slate-300">
              Nothing changed, so nothing was saved and Blueprint was not notified.
            </div>
          )}

          {current && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-white">{current.title}</h2>
                {current.description && <p className="text-sm text-slate-400 mt-1">{current.description}</p>}
                <div className="text-[11px] text-slate-600 mt-2">
                  Version {current.version} · updated {fmtDateTime(current.updated_at, tz)}
                  {current.source_path ? ' · Blueprint keeps a copy at ' + current.source_path : ''}
                </div>
              </div>

              {/* what a save changed */}
              {diff && (
                <section className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bh-border px-4 py-3">
                    <div className="text-sm text-slate-200">
                      What changed in version {diff.version}
                      {diff.first ? ' (first recorded version)' : ''}
                      <span className="ml-3 text-xs">
                        <span className="text-emerald-400">+{diff.added} lines</span>{' '}
                        <span className="text-red-400">−{diff.removed} lines</span>
                      </span>
                    </div>
                    <Link href={here} className="text-xs text-slate-500 hover:text-white">
                      Close
                    </Link>
                  </div>
                  <div className="max-h-[32rem] overflow-auto font-mono text-xs leading-relaxed">
                    {diff.added + diff.removed === 0 && (
                      <div className="px-4 py-6 text-slate-500 font-sans">No text changed in this version.</div>
                    )}
                    {diff.rows.map((row, i) =>
                      row.type === 'skip' ? (
                        <div key={i} className="px-4 py-1 text-slate-700 bg-bh-panel/40">
                          ⋯ {row.count} unchanged {row.count === 1 ? 'line' : 'lines'}
                        </div>
                      ) : (
                        <div
                          key={i}
                          className={
                            'px-4 whitespace-pre-wrap break-words ' +
                            (row.type === 'add'
                              ? 'bg-emerald-950/40 text-emerald-200'
                              : row.type === 'del'
                                ? 'bg-red-950/40 text-red-200'
                                : 'text-slate-500')
                          }
                        >
                          {row.type === 'add' ? '+ ' : row.type === 'del' ? '− ' : '  '}
                          {row.text || ' '}
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* history */}
              <section className="space-y-2">
                <h3 className="section-title">History</h3>
                <div className="card divide-y divide-slate-800/60">
                  {versions.slice(0, 4).map((v) => (
                    <HistoryRow key={v.id} v={v} current={current} here={here} tz={tz} />
                  ))}
                  {versions.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-600">No recorded versions for this document.</div>
                  )}
                </div>
                {versions.length > 4 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                      {versions.length - 4} older {versions.length - 4 === 1 ? 'version' : 'versions'}
                    </summary>
                    <div className="card divide-y divide-slate-800/60 mt-2">
                      {versions.slice(4).map((v) => (
                        <HistoryRow key={v.id} v={v} current={current} here={here} tz={tz} />
                      ))}
                    </div>
                  </details>
                )}
              </section>

              {/* edit */}
              <details className="card">
                <summary className="cursor-pointer px-4 py-3 text-sm text-slate-300 hover:text-white">
                  Edit this document
                </summary>
                <form action={saveStandard} className="border-t border-bh-border p-4 space-y-3">
                  <input type="hidden" name="id" value={current.id} />
                  <textarea
                    name="content"
                    defaultValue={current.content}
                    rows={24}
                    className="field font-mono !text-xs leading-relaxed"
                  />
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex-1 min-w-[16rem] text-[10px] uppercase tracking-wider text-slate-500">
                      What changed and why (kept in the history, sent to Blueprint)
                      <input
                        name="note"
                        required
                        placeholder="e.g. island clearance 42 → 44 per Michael 11/9"
                        className="field mt-1 normal-case tracking-normal"
                      />
                    </label>
                    <button className="btn-primary">Save as version {current.version + 1}</button>
                  </div>
                </form>
              </details>

              {/* the document */}
              <section className="card px-5 py-4">
                <Markdown>{current.content}</Markdown>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function HistoryRow({ v, current, here, tz }: { v: VersionRow; current: Standard; here: string; tz: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
      <div className="min-w-0">
        <span className="font-mono text-gold-light">v{v.version}</span>
        <span className="text-slate-500 ml-2">{fmtDateTime(v.created_at, tz)}</span>
        <span className="ml-2">
          <Pill tone={v.edited_by ? 'gold' : 'blue'}>{v.edited_by ? 'edited in the app' : 'pushed by Blueprint'}</Pill>
        </span>
        {v.note && <span className="block text-slate-400 mt-1">{v.note}</span>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link href={here + '&compare=' + v.version} className="text-gold-light hover:text-gold">
          What changed
        </Link>
        {v.version !== current.version && (
          <form action={restoreVersion}>
            <input type="hidden" name="id" value={current.id} />
            <input type="hidden" name="version" value={v.version} />
            <button className="text-slate-500 hover:text-white transition-colors">Restore</button>
          </form>
        )}
      </div>
    </div>
  )
}
