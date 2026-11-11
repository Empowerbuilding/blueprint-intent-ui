import Link from 'next/link'

// Blueprint = what Blueprint works from that is not a rule: what changed, and what it has learned.
export function BlueprintHeader({ active, toAccept }: { active: 'changes' | 'lessons'; toAccept: number }) {
  const tabs = [
    { key: 'changes', href: '/blueprint', label: 'What changed', note: 'day by day' },
    { key: 'lessons', href: '/blueprint/lessons', label: 'Lessons', note: toAccept ? toAccept + ' to accept' : 'what Blueprint has learned' },
  ] as const
  return (
    <header className="border-b border-bh-border bg-bh-panel/40">
      <div className="app-container pt-5">
        <h1 className="text-xl font-semibold text-white">Blueprint</h1>
        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Blueprint sections">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? 'page' : undefined}
              className={
                'rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-colors ' +
                (active === t.key ? 'border-gold text-white font-semibold' : 'border-transparent text-slate-400 hover:text-white')
              }
            >
              {t.label}
              <span className={'ml-2 text-xs font-normal ' + (t.key === 'lessons' && toAccept ? 'text-gold-light' : 'hidden md:inline text-slate-600')}>
                {t.note}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
