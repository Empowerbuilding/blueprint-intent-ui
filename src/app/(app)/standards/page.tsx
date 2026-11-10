export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { saveStandard, restoreVersion } from '@/app/standards-actions'
import Markdown from '@/components/markdown'
import Link from 'next/link'

const CATEGORIES: { key: string; label: string; blurb: string }[] = [
  { key: 'modeling', label: 'Modeling', blurb: 'How components get placed and the model gets built — element policy, materials, casework, floors, ceilings.' },
  { key: 'construction_docs', label: 'Construction Docs', blurb: 'How the sheet set gets built — sheet index, scales, annotations, dimensions, title blocks.' },
  { key: 'components', label: 'Component Library', blurb: 'The shared family / material library on H: — what exists, where it lives, reuse rules.' },
  { key: 'process', label: 'Process', blurb: 'The D1→D2 pipeline — kickoff, phases, QA gates, and Michael\u2019s meta-rules.' },
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
  active: boolean
  updated_at: string
}

type VersionRow = {
  id: string
  standard_id: string
  version: number
  note: string | null
  created_at: string
  edited_by: string | null
}

export default async function StandardsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; nochange?: string }>
}) {
  const { error, saved, nochange } = await searchParams
  const supabase = await createClient()

  const [{ data: standards }, { data: versions }] = await Promise.all([
    supabase.from('intent_standards').select('*').eq('active', true).order('slug'),
    supabase
      .from('intent_standards_versions')
      .select('id, standard_id, version, note, created_at, edited_by')
      .order('version', { ascending: false }),
  ])

  const stds = (standards || []) as Standard[]
  const versByStd = new Map<string, VersionRow[]>()
  for (const v of (versions || []) as VersionRow[]) {
    const list = versByStd.get(v.standard_id) || []
    list.push(v)
    versByStd.set(v.standard_id, list)
  }

  return (
    <main>
      <header className="border-b border-bh-border bg-bh-panel/40">
        <div className="app-container py-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors">
              ← Projects
            </Link>
            <h1 className="text-xl font-semibold text-white mt-1">Standards</h1>
          </div>
          <Link href="/rules" className="text-xs text-slate-400 hover:text-gold-light transition-colors">
            2D clearance rulebook →
          </Link>
        </div>
      </header>

      <div className="app-container py-8 space-y-10 max-w-5xl">
        {error && (
          <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 text-sm text-red-300">{error}</div>
        )}
        {saved && !nochange && (
          <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-300">
            Saved — new version snapshotted and Blueprint notified in blueprint-mitch to pull the update.
          </div>
        )}
        {saved && nochange && (
          <div className="bg-slate-800/40 border border-slate-600 rounded-xl p-4 text-sm text-slate-300">
            No changes detected — nothing saved, no version bump, Blueprint not notified.
          </div>
        )}

        {/* WHAT THIS IS */}
        <section className="bg-bh-card border border-bh-border rounded-xl p-5 text-sm text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-200 mb-2">
            What Blueprint builds by — visible and adjustable
          </div>
          These are the standing rules and context Blueprint follows when it places components, models the
          house, and builds out the construction docs. Every edit here is versioned and notifies Blueprint
          to pull the update — changes apply from the next build step onward.
          <div className="mt-3 text-xs text-slate-500 leading-relaxed">
            <div>
              <span className="text-slate-300">Full context at build time:</span> the emitted intent
              contract (decisions per room) + these standards + the{' '}
              <Link href="/rules" className="text-gold-light underline">2D clearance rulebook</Link> + the
              shared component library. Room-level decisions live on each project&apos;s room board.
            </div>
            <div className="mt-1">
              <span className="text-slate-300">Machine access:</span>{' '}
              <code className="text-gold-light">GET /api/standards</code> (header{' '}
              <code>x-prefill-secret</code>) — Blueprint pulls active standards by slug; it can also push
              its own doc updates back via <code>POST /api/standards</code> so this page stays current as
              it learns.
            </div>
          </div>
        </section>

        {/* ANCHORS */}
        <nav className="flex flex-wrap gap-2 text-xs">
          {CATEGORIES.map((c) => (
            <a key={c.key} href={`#${c.key}`} className="border border-bh-border rounded-full px-3 py-1 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              {c.label} ({stds.filter((s) => s.category === c.key).length})
            </a>
          ))}
        </nav>

        {CATEGORIES.map((cat) => {
          const docs = stds.filter((s) => s.category === cat.key)
          if (!docs.length) return null
          return (
            <section key={cat.key} id={cat.key} className="space-y-6 scroll-mt-8">
              <div>
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{cat.label}</h2>
                <p className="text-xs text-slate-500 mt-1">{cat.blurb}</p>
              </div>

              {docs.map((s) => {
                const vers = versByStd.get(s.id) || []
                return (
                  <div key={s.id} className="bg-bh-card border border-bh-border rounded-xl overflow-hidden">
                    {/* doc header */}
                    <div className="border-b border-bh-border bg-bh-panel/60 px-5 py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold">{s.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">
                          {s.slug} · v{s.version} · updated {new Date(s.updated_at).toLocaleString()}
                          {s.source_path ? ` · mirrors ${s.source_path}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">
                        {CATEGORIES.find((c) => c.key === s.category)?.label}
                      </span>
                    </div>

                    {/* rendered content */}
                    <div className="px-5 py-4">
                      <Markdown>{s.content}</Markdown>
                    </div>

                    {/* edit + history */}
                    <div className="border-t border-bh-border px-5 py-4 space-y-4">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-slate-400 hover:text-white text-xs uppercase tracking-wider font-semibold">
                          Edit this standard
                        </summary>
                        <form action={saveStandard} className="mt-3 space-y-3">
                          <input type="hidden" name="id" value={s.id} />
                          <textarea
                            name="content"
                            defaultValue={s.content}
                            rows={18}
                            className="w-full bg-bh-black border border-bh-border rounded-lg px-3 py-2 font-mono text-xs leading-relaxed"
                          />
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                Change note (what + why — shows in history, goes to Blueprint)
                              </label>
                              <input
                                name="note"
                                placeholder="e.g. island clearance 42\u219244 per Michael 11/9"
                                className="w-full bg-bh-black border border-bh-border rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <button className="bg-gold hover:bg-gold-light-light text-slate-950 font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
                              Save v{s.version + 1}
                            </button>
                          </div>
                        </form>
                      </details>

                      <details className="text-sm">
                        <summary className="cursor-pointer text-slate-400 hover:text-white text-xs uppercase tracking-wider font-semibold">
                          Version history ({vers.length})
                        </summary>
                        <div className="mt-3 space-y-2">
                          {vers.map((v) => (
                            <div key={v.id} className="flex items-center justify-between gap-3 bg-bh-panel/50 border border-bh-border rounded-lg px-3 py-2 text-xs">
                              <div className="min-w-0">
                                <span className="font-mono text-gold-light">v{v.version}</span>
                                <span className="text-slate-500 ml-2">{new Date(v.created_at).toLocaleString()}</span>
                                {v.note && <span className="text-slate-400 ml-2">— {v.note}</span>}
                              </div>
                              {v.version !== s.version && (
                                <form action={restoreVersion}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <input type="hidden" name="version" value={v.version} />
                                  <button className="shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                    restore
                                  </button>
                                </form>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}

        <p className="text-xs text-slate-600">
          Seeded from Blueprint&apos;s standing docs on 11/9. Blueprint keeps its workspace copies — the UI
          is now the shared source of truth; every save tells it to pull.
        </p>
      </div>
    </main>
  )
}
