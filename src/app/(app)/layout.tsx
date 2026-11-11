export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions'
import { MainNav } from '@/components/main-nav'
import Link from 'next/link'

// Global app shell — Barnhaus logo + the four areas, persistent across every page.
// Per-page context (back links, titles, actions) lives in each page's PageHeader.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const email = user?.email || ''
  const name = email.split('@')[0].replace(/[._]/g, ' ')

  return (
    <div className="min-h-screen bg-bh-black text-white flex flex-col">
      <header className="sticky top-0 z-40 border-b border-bh-border bg-bh-black/90 backdrop-blur">
        {/* phone: logo + sign-out on the first row, the four areas on a second row */}
        <div className="app-container flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
          <Link href="/" className="order-1 flex items-center gap-3.5 group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Barnhaus Steel Builders" className="h-11 w-auto" />
            <span className="leading-tight hidden lg:block">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Barnhaus Steel Builders
              </span>
              <span className="block text-[17px] font-semibold text-white group-hover:text-gold-light transition-colors">
                Design Intent
              </span>
            </span>
          </Link>
          <div className="order-3 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">
            <MainNav />
          </div>

          <div className="order-2 flex items-center gap-1 sm:order-3 sm:gap-2 text-sm shrink-0">
            <span className="text-xs text-slate-500 hidden md:block capitalize" title={email}>
              {name}
            </span>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-slate-500 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
