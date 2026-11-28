// Proxy: sheet + pattern PNG passthrough (binary stream from the engine).
// Path is validated against traversal. Contract v2: the engine marks
// versioned filenames (_v<N>/_r<N>) immutable — those cache for a year;
// anything else falls back to 60s.

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { engineSheet } from '@/lib/canvas/engine'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file?: string[] }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('unauthorized', { status: 401 })

  const { file } = await ctx.params
  const path = (file ?? []).map((seg) => decodeURIComponent(seg)).join('/')
  if (!path || path.includes('..') || path.includes('\\')) {
    return new Response('bad path', { status: 400 })
  }

  const result = await engineSheet(path)
  if (!result.ok) return new Response(result.error, { status: result.status })

  return new Response(result.body, {
    headers: {
      'content-type': result.contentType,
      // Contract v2: engine marks versioned filenames (_v<N>/_r<N>) immutable.
      'cache-control': result.cacheControl ?? 'public, max-age=60',
    },
  })
}
