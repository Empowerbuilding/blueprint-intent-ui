'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Primary navigation — four areas, the current one highlighted.
const ITEMS: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: '/', label: 'Inbox', match: (p) => p === '/' },
  { href: '/projects', label: 'Projects', match: (p) => p.startsWith('/projects') },
  { href: '/rulebook/checks', label: 'Rulebook', match: (p) => p.startsWith('/rulebook') },
  { href: '/blueprint', label: 'Blueprint', match: (p) => p.startsWith('/blueprint') },
]

export function MainNav() {
  const pathname = usePathname() || '/'
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              'rounded-lg px-3 py-1.5 transition-colors ' +
              (active ? 'bg-bh-card text-white' : 'text-slate-400 hover:text-white hover:bg-bh-card')
            }
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
