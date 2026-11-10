export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { signIn } from '@/app/actions'

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
    <div className="min-h-screen flex items-center justify-center bg-bh-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Barnhaus Steel Builders" className="h-36 w-auto" />
          <div className="mt-6 text-center">
            <div className="text-lg font-semibold text-white">Design Intent</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-[0.18em]">
              Work Order UI
            </div>
          </div>
        </div>
        <form action={signIn} className="card p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              Sign-in failed — check email and password.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input name="email" type="email" required className="field" placeholder="you@barnhaussteelbuilders.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input name="password" type="password" required className="field" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>
        <div className="mt-5 text-center text-xs text-slate-600">
          Accounts are provisioned by Mitch.
        </div>
      </div>
    </div>
  )
}
