import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { CONTEXT_KIND, ROLE_ALIASES, ROOM_ROLES, SHELL_KINDS } from '@/lib/vocab'

// GET /api/vocabulary — the controlled words contract v2 is written in, for machine clients (Blueprint).
// -> { status: "draft" | "locked", locked: n, draft: n,
//      kinds: [{ kind, family, label, description, status, stage_scope, bridge_commands, locked_build, status_note }],
//      context_marker, shell_kinds, roles: [...], role_aliases: {...} }
// A kind is "locked" when every bridge command it names is on the live bridge and its parameters were read from the
// bridge source at locked_build. Locked is not proven: whether a command has been run is on the Capabilities page.
// context_marker is NOT a kind: a line typed with it is carried as room-level context, never as a work item.
// "draft" means the list has not been checked against a live bridge yet: nothing is locked.
// Read only. Kinds are changed by an approver. Auth: x-prefill-secret header, or a signed-in user.

export async function GET(request: NextRequest) {
  const machine = !!process.env.PREFILL_SECRET && request.headers.get('x-prefill-secret') === process.env.PREFILL_SECRET
  const userClient = await createClient()
  if (!machine) {
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const client = machine && url && key ? createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : userClient

  const { data, error } = await client
    .from('intent_kinds')
    .select('kind, family, label, description, executable, status, stage_scope, active, sort_order, bridge_commands, locked_build, status_note')
    .order('sort_order')
  if (error || !data) return NextResponse.json({ error: 'the list of kinds could not be read' }, { status: 500 })
  const kinds = (data as { active: boolean; status: string; executable: boolean }[]).filter((k) => k.active && k.executable)
  return NextResponse.json({
    status: kinds.length && kinds.every((k) => k.status === 'locked') ? 'locked' : 'draft',
    locked: kinds.filter((k) => k.status === 'locked').length,
    draft: kinds.filter((k) => k.status !== 'locked').length,
    kinds: kinds.map((k) => {
      const { active: _a, sort_order: _s, executable: _e, ...rest } = k as Record<string, unknown>
      void _a
      void _s
      void _e
      return rest
    }),
    context_marker: CONTEXT_KIND,
    shell_kinds: SHELL_KINDS,
    roles: ROOM_ROLES,
    role_aliases: ROLE_ALIASES,
    source: 'app',
  })
}
