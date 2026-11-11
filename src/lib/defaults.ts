// Defaults — the values built when nobody decided otherwise.
// They live in the database (intent_defaults) and are edited in the app by an approver
// (Rulebook → Defaults). The list below is what the table was first filled from (2026-11-11);
// it is only used again if the table cannot be read, so a room page never loses its defaults.

export type DefaultRule = {
  topic: string
  value: string
  scope: 'house' | 'public' | 'secondary' | 'garage' | 'adu' | 'bath' | 'master' | 'outdoor'
}

export const DEFAULTS: DefaultRule[] = [
  { topic: 'ceiling', value: '12 ft flat (public/master/kitchen); 10 ft secondary; great/dining vault = no flat ceiling', scope: 'house' },
  { topic: 'upper cabinets', value: 'to 10 ft under 12 ft ceilings', scope: 'house' },
  { topic: 'range pullouts', value: 'spice pullouts both sides of range', scope: 'house' },
  { topic: 'fridge', value: 'built in', scope: 'house' },
  { topic: 'hood', value: 'all-wood including neck', scope: 'house' },
  { topic: 'island microwave', value: 'in Built-In base', scope: 'house' },
  { topic: 'vanities', value: '21" full-run', scope: 'bath' },
  { topic: 'toilet clearance', value: '15" / 21"', scope: 'bath' },
  { topic: 'shower', value: '3 tile walls + 1 glass + hosted door (sliding secondary, hinged out at steam/wet)', scope: 'bath' },
  { topic: 'niches', value: 'void-cut 38×14 secondary / 14×50 master', scope: 'bath' },
  { topic: 'closets', value: 'hang + double + cubbies + drawers + shoes; L corner towers', scope: 'house' },
  { topic: 'windows', value: 'secondary bedrooms casement; frames black; grilles off', scope: 'house' },
  { topic: 'rear opening', value: '3-panel slider Option A + accordion Option B (options sheet)', scope: 'house' },
  { topic: 'roof joists', value: '22" joist', scope: 'house' },
  { topic: 'cabinet material', value: 'Cabinets - White Oak (tint per client)', scope: 'house' },
  { topic: 'counter material', value: 'Counter Top = Marble 05', scope: 'house' },
  { topic: 'hardware', value: 'Metal - Black Matte', scope: 'house' },
  { topic: 'accents', value: 'Navy / Charcoal / Gray / Steel Gray / Walnut', scope: 'house' },
  { topic: 'shower tile', value: '1/4" Shower Tile = Marble 05', scope: 'bath' },
  { topic: 'floors', value: 'plank / tile / epoxy per room', scope: 'house' },
  { topic: 'garage ceiling', value: 'vaulted gypsum clearing OHD', scope: 'garage' },
  { topic: 'tags', value: 'text-only', scope: 'house' },
  { topic: '3D shadows', value: 'ON intensity 20 on 3D sheet views, OFF on Back elevation', scope: 'house' },
  { topic: 'poché', value: '64/64/64 + FadeTo 55', scope: 'house' },
  { topic: 'sheet set', value: 'D2 list only (no MEP/structural)', scope: 'house' },
  { topic: 'titleblock', value: 'values deferred unless given (blank, not guessed)', scope: 'house' },
  { topic: 'cover', value: 'existing renders until Michael re-renders', scope: 'house' },
  { topic: 'site plan', value: 'conceptual (no PL/APN) unless survey given', scope: 'house' },
]

export const SCOPES: { key: DefaultRule['scope']; label: string }[] = [
  { key: 'house', label: 'Whole house' },
  { key: 'public', label: 'Public rooms' },
  { key: 'master', label: 'Master suite' },
  { key: 'secondary', label: 'Secondary rooms' },
  { key: 'bath', label: 'Baths (and the master suite)' },
  { key: 'garage', label: 'Garage and gym' },
  { key: 'adu', label: 'ADU' },
  { key: 'outdoor', label: 'Outdoor living' },
]
export const isScope = (s: string): s is DefaultRule['scope'] => SCOPES.some((x) => x.key === s)

export type DefaultRow = DefaultRule & {
  id: string
  active: boolean
  sort_order: number
  updated_by_email: string | null
  updated_at: string | null
}
export type DefaultChange = {
  id: string
  default_id: string | null
  topic: string
  action: 'added' | 'changed' | 'turned_off' | 'turned_on'
  old_value: string | null
  new_value: string | null
  old_scope: string | null
  new_scope: string | null
  note: string | null
  changed_by_email: string | null
  changed_at: string
}

// the two Supabase clients (user session, service role) have different generics; only .from() is used
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

/** every default, on and off, in display order. null = the table could not be read */
export async function loadDefaultRows(client: AnyClient): Promise<DefaultRow[] | null> {
  const { data, error } = await client
    .from('intent_defaults')
    .select('id, topic, value, scope, active, sort_order, updated_by_email, updated_at')
    .order('sort_order')
    .order('topic')
  if (error || !data) return null
  return data as DefaultRow[]
}

/** the defaults in force. Falls back to the built-in list only if the table cannot be read. */
export async function loadDefaults(client: AnyClient): Promise<DefaultRule[]> {
  const rows = await loadDefaultRows(client)
  if (!rows) return DEFAULTS
  return rows.filter((r) => r.active).map((r) => ({ topic: r.topic, value: r.value, scope: r.scope }))
}

export function defaultsForRoom(sectionCode: string, roomName: string, list: DefaultRule[] = DEFAULTS): DefaultRule[] {
  const n = roomName.toLowerCase()
  const isBath = n.includes('bath')
  const isMaster = n.includes('master')
  const isGarage = n.includes('garage') || n.includes('gym')
  const isAdu = n.includes('adu')
  const isOutdoor = n.includes('outdoor') || n.includes('patio') || n.includes('porch')
  return list.filter((d) => {
    if (d.scope === 'house') return true
    if (d.scope === 'bath') return isBath || isMaster
    if (d.scope === 'garage') return isGarage
    if (d.scope === 'adu') return isAdu
    if (d.scope === 'outdoor') return isOutdoor
    return false
  })
}
