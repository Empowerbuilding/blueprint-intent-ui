// Runbook §4 defaults — the values built when the transcript is silent.
// Source: standards/D1_TO_D2_RUNBOOK.md §4 (Blueprint's doctrine). Shown in the
// room defaults panel; accepting them (or leaving a topic silent) means the AI
// builds exactly these.

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

export function defaultsForRoom(sectionCode: string, roomName: string): DefaultRule[] {
  const n = roomName.toLowerCase()
  const isBath = n.includes('bath')
  const isMaster = n.includes('master')
  const isGarage = n.includes('garage') || n.includes('gym')
  const isAdu = n.includes('adu')
  const isOutdoor = n.includes('outdoor') || n.includes('patio') || n.includes('porch')
  return DEFAULTS.filter((d) => {
    if (d.scope === 'house') return true
    if (d.scope === 'bath') return isBath || isMaster
    if (d.scope === 'garage') return isGarage
    if (d.scope === 'adu') return isAdu
    if (d.scope === 'outdoor') return isOutdoor
    return false
  })
}
