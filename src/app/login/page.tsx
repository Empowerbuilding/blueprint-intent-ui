export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { signIn } from '@/app/actions'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return <meta httpEquiv="refresh" content="0;url=/" />

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold text-white">Design Intent</div>
          <div className="text-sm text-slate-400 mt-1">Barnhaus · Work Order UI</div>
        </div>
        <form action={signIn} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              Sign-in failed — check email and password.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="you@barnhaussteelbuilders.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg px-3 py-2 text-sm transition-colors"
          >
            Sign in
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-slate-600">
          Accounts are provisioned by Mitch — contact him for access.
        </div>
      </div>
    </div>
  )
}
