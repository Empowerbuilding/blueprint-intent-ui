import Link from 'next/link'

// Rulebook = everything Blueprint builds by, in one place, three tabs.
const TABS = [
  { key: 'checks', href: '/rulebook/checks', label: 'Checks', note: 'measured automatically on every drawing' },
  { key: 'defaults', href: '/rulebook/defaults', label: 'Defaults', note: 'what gets built when nobody decides' },
  { key: 'standards', href: '/rulebook/standards', label: 'Standards', note: 'the written rules and process' },
] as const

export function RulebookHeader({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <header className="border-b border-bh-border bg-bh-panel/40">
      <div className="app-container pt-5">
        <h1 className="text-xl font-semibold text-white">Rulebook</h1>
        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Rulebook sections">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? 'page' : undefined}
              className={
                'rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-colors ' +
                (active === t.key
                  ? 'border-gold text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-white')
              }
            >
              {t.label}
              <span className="hidden md:inline ml-2 text-xs font-normal text-slate-600">{t.note}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
