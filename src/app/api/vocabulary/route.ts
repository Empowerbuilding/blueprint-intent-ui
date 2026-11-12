import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { CONTEXT_KIND, DECISION_SOURCES, ROLE_ALIASES, ROOM_ROLES, SHELL_KINDS } from '@/lib/vocab'

// GET /api/vocabulary — the controlled words contract v2 is written in, for machine clients (Blueprint).
// -> { status: "draft" | "locked", locked: n, draft: n,
//      by_backing: { command: n, recipe: n, unmapped: n },
//      kinds: [{ kind, family, label, description, status, stage_scope, bridge_commands, locked_build, status_note, backing, recipe, target_need, params, params_note }],
//      context_marker, shell_kinds, roles: [...], role_aliases: {...}, decision_sources: [...] }
// A kind is "locked" when every bridge command it names is on the live bridge and its parameters were read from the
// bridge source at locked_build. Locked is not proven: whether a command has been run is on the Capabilities page.
// backing says how a kind is built: "command" = named bridge commands; "recipe" = direct Revit calls sent through the
// bridge's general-purpose commands, which ran on a real project (recipe = { summary, calls, receipts, proven, proven_note });
// "unmapped" = neither a command nor a recipe that has run.
// target_need says what a work item of that kind must be pinned to before a build phase may write: "element" (an existing
// element), "location" (a drawn position on the approved 2D), "any" (either), "none" (house-wide or room-wide). Mitch or
// Michael change it on the Kinds of work page; the compiler reads it here at every compile.
// params are the numbers a kind carries ({ "flat_max_in": 2 }); null when it has none. A number whose value is null is waiting
// for Mitch or Michael to type it on the Kinds of work page: a rule that needs it decides nothing until then (site.fence:
// how far the heights under a fence line may differ and still count as flat). params_note says what the numbers mean.
// decision_sources are the sources a pushed decision line may carry (decision.source). A line with another source is not
// stored; Blueprint's push reads this list and refuses such a line before it sends anything.
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
    .select('kind, family, label, description, executable, status, stage_scope, active, sort_order, bridge_commands, locked_build, status_note, backing, recipe, target_need, params, params_note')
    .order('sort_order')
  if (error || !data) return NextResponse.json({ error: 'the list of kinds could not be read' }, { status: 500 })
  const kinds = (data as { active: boolean; status: string; executable: boolean; backing: string | null }[]).filter((k) => k.active && k.executable)
  const backed = (b: string) => kinds.filter((k) => (k.backing || 'command') === b).length
  return NextResponse.json({
    status: kinds.length && kinds.every((k) => k.status === 'locked') ? 'locked' : 'draft',
    locked: kinds.filter((k) => k.status === 'locked').length,
    draft: kinds.filter((k) => k.status !== 'locked').length,
    by_backing: { command: backed('command'), recipe: backed('recipe'), unmapped: backed('unmapped') },
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
    decision_sources: DECISION_SOURCES,
    source: 'app',
  })
}
