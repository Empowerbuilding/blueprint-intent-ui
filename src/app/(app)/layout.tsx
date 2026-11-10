export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions'
import Link from 'next/link'

// Global app shell — Barnhaus logo + primary nav, persistent across every page.
// Per-page context (back links, titles, actions) lives in each page's PageHeader.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const email = user?.email || ''
  const name = email.split('@')[0].replace(/[._]/g, ' ')

  return (
    <div className="min-h-screen bg-bh-black text-white flex flex-col">
      <header className="sticky top-0 z-40 border-b border-bh-border bg-bh-black/90 backdrop-blur">
        <div className="app-container h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3.5 group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.png"
              alt="Barnhaus Steel Builders"
              className="h-11 w-auto"
            />
            <span className="leading-tight hidden sm:block">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Barnhaus Steel Builders
              </span>
              <span className="block text-[17px] font-semibold text-white group-hover:text-gold-light transition-colors">
                Design Intent
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <Link
              href="/rules"
              className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white hover:bg-bh-card transition-colors"
            >
              Rules
            </Link>
            <Link
              href="/standards"
              className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white hover:bg-bh-card transition-colors"
            >
              Standards
            </Link>
            <span className="h-5 w-px bg-bh-border mx-2 hidden sm:block" />
            <span className="text-xs text-slate-500 hidden md:block capitalize" title={email}>
              {name}
            </span>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-slate-500 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
