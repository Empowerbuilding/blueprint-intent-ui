export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { Pill } from '@/components/pill'
import Link from 'next/link'

// BLUEPRINT · WHAT CHANGED — a dated feed of everything that changed in what
// Blueprint works from: standards documents, the checks rulebook, and locked
// contracts. Built entirely from history the app already records.

type Event = {
  at: string
  kind: 'standard' | 'checks' | 'contract'
  title: string
  detail: string | null
  who: 'blueprint' | 'person' | null
  href: string
  cta: string
}

const KINDS: { key: Event['kind']; label: string }[] = [
  { key: 'standard', label: 'Standards' },
  { key: 'checks', label: 'Checks' },
  { key: 'contract', label: 'Contracts' },
]

export default async function BlueprintPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>
}) {
  const { show } = await searchParams
  const filter = KINDS.find((k) => k.key === show)?.key || null
  const supabase = await createClient()

  const [standardsRes, standardVersionsRes, rulebookRes, emissionsRes, projectsRes] = await Promise.all([
    supabase.from('intent_standards').select('id, slug, title'),
    supabase
      .from('intent_standards_versions')
      .select('standard_id, version, note, created_at, edited_by')
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('intent_rulebook_versions')
      .select('version, created_at, snapshot')
      .order('version', { ascending: false })
      .limit(30),
    supabase
      .from('intent_emissions')
      .select('project_id, version, emitted_at')
      .order('emitted_at', { ascending: false })
      .limit(30),
    supabase.from('intent_projects').select('id, name'),
  ])

  const standardById = new Map(
    ((standardsRes.data || []) as { id: string; slug: string; title: string }[]).map((s) => [s.id, s])
  )
  const projectName = new Map(((projectsRes.data || []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))

  const events: Event[] = []
  for (const v of (standardVersionsRes.data || []) as {
    standard_id: string
    version: number
    note: string | null
    created_at: string
    edited_by: string | null
  }[]) {
    const s = standardById.get(v.standard_id)
    if (!s) continue
    events.push({
      at: v.created_at,
      kind: 'standard',
      title: s.title + ' → version ' + v.version,
      detail: v.note,
      who: v.edited_by ? 'person' : 'blueprint',
      href: '/rulebook/standards?doc=' + s.slug + '&compare=' + v.version,
      cta: 'What changed',
    })
  }
  for (const v of (rulebookRes.data || []) as { version: number; created_at: string; snapshot: unknown }[]) {
    events.push({
      at: v.created_at,
      kind: 'checks',
      title: 'Checks rulebook → version ' + v.version,
      detail: Array.isArray(v.snapshot) ? v.snapshot.length + ' active rules after this change' : null,
      who: null,
      href: '/rulebook/checks',
      cta: 'Open checks',
    })
  }
  for (const e of (emissionsRes.data || []) as { project_id: string; version: number; emitted_at: string }[]) {
    events.push({
      at: e.emitted_at,
      kind: 'contract',
      title: (projectName.get(e.project_id) || 'Project') + ' — contract v' + e.version + ' locked',
      detail: 'Sent to Blueprint to work from.',
      who: 'person',
      href: '/projects/' + e.project_id + '/emit',
      cta: 'Open contract',
    })
  }

  const shown = events.filter((e) => !filter || e.kind === filter).sort((a, b) => (a.at < b.at ? 1 : -1))
  const days = new Map<string, Event[]>()
  for (const e of shown) {
    const day = e.at.slice(0, 10)
    days.set(day, [...(days.get(day) || []), e])
  }

  return (
    <main>
      <PageHeader eyebrow="What changed, day by day" title="Blueprint" />

      <div className="app-container py-8 space-y-8 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/blueprint" className={!filter ? 'btn-primary-sm' : 'btn-secondary-sm'}>
            Everything
          </Link>
          {KINDS.map((k) => (
            <Link key={k.key} href={'/blueprint?show=' + k.key} className={filter === k.key ? 'btn-primary-sm' : 'btn-secondary-sm'}>
              {k.label}
            </Link>
          ))}
        </div>

        {[...days.entries()].map(([day, list]) => (
          <section key={day} className="space-y-2">
            <h2 className="section-title">
              {new Date(day + 'T12:00:00Z').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            <div className="card divide-y divide-slate-800/60">
              {list.map((e, i) => (
                <div key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={e.kind === 'standard' ? 'violet' : e.kind === 'checks' ? 'gold' : 'green'}>
                        {e.kind === 'standard' ? 'standard' : e.kind === 'checks' ? 'checks' : 'contract'}
                      </Pill>
                      <span className="text-sm text-slate-100">{e.title}</span>
                    </div>
                    {e.detail && <div className="text-xs text-slate-400 mt-1">{e.detail}</div>}
                    <div className="text-[11px] text-slate-600 mt-1">
                      {new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {e.who === 'blueprint' ? ' · pushed by Blueprint' : e.who === 'person' ? ' · done in the app' : ''}
                    </div>
                  </div>
                  <Link href={e.href} className="text-xs text-gold-light hover:text-gold shrink-0">
                    {e.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && (
          <div className="text-sm text-slate-600 border border-dashed border-bh-border rounded-xl p-10 text-center">
            Nothing recorded yet.
          </div>
        )}

        <section className="rounded-xl border border-bh-border bg-bh-panel/40 px-4 py-4 text-sm text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-200 mb-1">Not recorded here yet</div>
          Two things Blueprint learns from do not appear in this feed yet: corrections you give it in chat, and what the
          Revit bridge can do on each machine (and which version it is on). Both need new storage in the database and
          are the next step of the reorganisation.
        </section>
      </div>
    </main>
  )
}
