// Vocabulary for contract v2 (Intent Pipeline v2, milestone M1).
// - ROOM_ROLES: the controlled list of what a room IS. Rules attach by role, so there is no "other".
// - suggest*: the old name-matching heuristics, kept ONLY as suggestions shown next to an empty field.
//   Nothing here ever writes a role, a 2D yes/no or a kind: a person (or a typed push) does.
// Relative imports and erasable types only: scripts/test-libs.mjs imports this file directly.

export const ROOM_ROLES = [
  'kitchen', 'pantry', 'dining', 'great', 'living', 'game-room', 'bar', 'office',
  'entry', 'foyer', 'hallway', 'stair', 'loft',
  'primary-bedroom', 'bedroom', 'primary-bath', 'bath', 'closet', 'wic', 'sauna',
  'mud', 'laundry', 'mech', 'storage', 'safe',
  'garage', 'workshop', 'gym', 'adu',
  'patio', 'porch', 'outdoor-kitchen', 'pool', 'site',
] as const
export type RoomRole = (typeof ROOM_ROLES)[number]
/** other spellings that mean a role in the list */
export const ROLE_ALIASES: Record<string, RoomRole> = { 'golf-room': 'game-room' }

export function normaliseRole(raw: string | null | undefined): RoomRole | null {
  const r = String(raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (!r) return null
  if ((ROOM_ROLES as readonly string[]).includes(r)) return r as RoomRole
  return ROLE_ALIASES[r] || null
}
export const roleLabel = (r: string) => r.replace(/-/g, ' ')

/** the board's house-level section: it is not a room and carries no role */
export const isHouseSection = (sectionCode: string) => sectionCode.trim().toUpperCase() === 'HOUSE'

const ROLE_HINTS: [RegExp, RoomRole][] = [
  [/outdoor\s*kitchen|summer\s*kitchen/, 'outdoor-kitchen'],
  [/(master|primary|^m\.?)\s*(bath|ensuite)|wet\s*room/, 'primary-bath'],
  [/bath|powder|\bwc\b|steam/, 'bath'],
  [/pantry/, 'pantry'],
  [/mud/, 'mud'],
  [/laundry/, 'laundry'],
  [/\bwic\b|walk.?in/, 'wic'],
  [/closet/, 'closet'],
  [/(master|primary)\s*(bed|suite)|^master$|^primary$/, 'primary-bedroom'],
  [/\bbed/, 'bedroom'],
  [/kitchen/, 'kitchen'],
  [/\bbar\b/, 'bar'],
  [/office|study/, 'office'],
  [/game|golf|media|theat/, 'game-room'],
  [/great/, 'great'],
  [/living|family/, 'living'],
  [/dining/, 'dining'],
  [/foyer/, 'foyer'],
  [/entry/, 'entry'],
  [/workshop|\bshop\b/, 'workshop'],
  [/garage|carport/, 'garage'],
  [/patio/, 'patio'],
  [/porch|deck/, 'porch'],
  [/\badu\b|guest\s*house|casita/, 'adu'],
  [/gym|exercise/, 'gym'],
  [/safe/, 'safe'],
  [/sauna/, 'sauna'],
  [/pool/, 'pool'],
  [/hall/, 'hallway'],
  [/loft|mezz/, 'loft'],
  [/stair/, 'stair'],
  [/mech|utility/, 'mech'],
  [/storage|attic/, 'storage'],
  [/site|exterior/, 'site'],
]
/** a guess at the role from the room's name. A suggestion only. */
export function suggestRole(roomName: string): RoomRole | null {
  const n = roomName.toLowerCase()
  for (const [re, role] of ROLE_HINTS) if (re.test(n)) return role
  return null
}

// the compiler's old needs_2d() heuristic (automation/work_order_compile.py), kept as a suggestion
const DESIGNED_NAME = /kitchen|pantry|bath|laundry|mud|closet|wic|bar\b|office|living|great|master|suite|safe|entry|foyer|adu|gym|garage/i
const NO_2D = /^(house|site)|site \/|exterior/i
/** a guess at whether the room gets 2D drawings. A suggestion only: a person says yes or no. */
export function suggestNeeds2d(roomName: string, sectionCode: string): boolean {
  if (NO_2D.test(roomName) || NO_2D.test(sectionCode)) return false
  return DESIGNED_NAME.test(roomName)
}

export const CONTEXT_KIND = 'context'
/** kinds that change the room shell (spec amendment A12) */
export const SHELL_KINDS = ['structure.resize', 'structure.modify', 'structure.stairs', 'surface.wall']

const KIND_HINTS: [RegExp, string][] = [
  [/counter\s*top|countertop|\bcounter\b/, 'casework.counter'],
  [/niche/, 'plumbing.niche'],
  [/vanit|toilet|\btub\b|shower|steam|glass wall/, 'plumbing.place'],
  // named pieces of casework come before the sink: "trash pullout at the sink" is a pullout
  [/pullout|cabinet|drawer|shel[fv]|locker|bench|\bhood\b|console|mantle|hearth/, 'casework.place'],
  [/\bsink|faucet/, 'plumbing.sink'],
  [/fenc/, 'site.fence'],
  [/\bpool\b|\bspa\b|hot tub/, 'site.pool'],
  [/driveway|turnaround|topo|\bsite\b|\bpad\b/, 'site.modify'],
  [/stair/, 'structure.stairs'],
  [/column/, 'structure.modify'],
  [/window|door|slider|\bohd\b|casement|transom|skylight|opening/, 'opening.modify'],
  [/outlet|light|switch|\bpanel\b|\bfan\b|pendant|sconce|electric|\b220v?\b/, 'mep.electrical'],
  [/drain|hose bib|\bgas\b|water heater|pex|filtration/, 'mep.plumbing'],
  [/fridge|refrigerator|microwave|washer|dryer|\brange\b|oven|dishwasher|appliance/, 'appliance.place'],
  [/ceiling|vault/, 'surface.ceiling'],
  [/beam/, 'surface.beam'],
  [/soffit/, 'surface.soffit'],
  [/roof|fascia|gutter|overhang|chimney/, 'roof.modify'],
  [/material|finish|colou?r|stain|paint|tile|hardware|veneer|flooring|siding|wainscot/, 'finish.material'],
  [/\bfloor\b|sunken/, 'surface.floor'],
  [/\bwall\b/, 'surface.wall'],
  [/island|closet|pantry|built.?in|media/, 'casework.place'],
  [/sheet|title\s*block|schedule|dimension/, 'sheet.annotate'],
  [/room name|rename|room number|department/, 'room.config'],
]
/** a guess at the kind of work from the wording. A suggestion only: it is never saved by itself. */
export function suggestKind(topic: string, value: string): string | null {
  const t = (topic + ' ' + value).toLowerCase()
  for (const [re, kind] of KIND_HINTS) if (re.test(t)) return kind
  return null
}

const REDLINE_HINTS: Record<string, string> = { beam: 'surface.beam', cabinet_run: 'casework.place', keep: CONTEXT_KIND, note: CONTEXT_KIND }
export const suggestRedlineKind = (noteType: string): string | null => REDLINE_HINTS[noteType] || null
