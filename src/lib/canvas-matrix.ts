import { SYNATSCHK_TWO_STORY_SANDBOX } from './synatschk-sandbox-preset'
// Reactive House Matrix — Single typed source of truth for the `/canvas`
// Interactive Architectural Studio. Both the vector SVG viewport and the
// deterministic rule/command engine read and mutate this immutable structure.

export type CadTheme = 'paper' | 'blueprint'
export type RoomStatus = 'approved' | 'draft' | 'needs_review'
export type WallDirection = 'N' | 'E' | 'S' | 'W' | 'Island'
export type StageLayoutMode = 'house' | 'split' | 'elevation' | 'plan'

export type BayKind =
  | 'drawer_stack'
  | 'base_doors'
  | 'sink_base'
  | 'floating_shelves'
  | 'tall_oven'
  | 'fridge'
  | 'tall_tower'
  | 'range_hood'
  | 'closet_double_hang'
  | 'closet_long_hang'
  | 'closet_drawers'
  | 'closet_shelves'
  | 'fireplace_chase'
  | 'wet_room_glass'
  | 'accordion_door'
  | 'window'
  | 'door'
  | 'toilet_bay'
  | 'wall_partition'
  | 'scribe_panel'

export interface CaseworkBay {
  id: string
  tag?: string
  kind: BayKind
  label: string
  widthIn: number
  heightIn: number
  depthIn: number
  affIn: number
  drawerCount?: 3 | 4
  shelfCount?: number
  withLowerBase?: boolean
  lowerBaseHeightIn?: number
  hasMirror?: boolean
  hasSconces?: boolean
  fullHeightSplash?: boolean
  hasShowerColumn?: boolean
  hasTubCurtain?: boolean
  hasOverToiletCabinet?: boolean
  hasHiddenMirrorDoor?: boolean
  hoodWidthIn?: number
  revitFamily: string
  revitParams: string
}

export interface DatumLine {
  id: string
  affIn: number
  label: string
}

export interface VaultSpec {
  lowIn: number
  highIn: number
  slopeLabel: string
  beamLabel: string
  finishLabel: string
}

export interface WallEdge {
  id: WallDirection
  shortLabel: string
  title: string
  clearWidthIn: number
  ceilingHeightIn: number
  vaulted?: VaultSpec
  bays: CaseworkBay[]
  autoCenter?: boolean
  isCaseworkWall?: boolean
  flexBinding?: {
    flexWallId: string
    polarity: 1 | -1
  }
}

export interface WallOpening {
  id: string
  wall: 'N' | 'E' | 'S' | 'W'
  offsetIn: number
  widthIn: number
  kind: 'door' | 'window' | 'accordion' | 'cased_opening'
  swing?: 'in-left' | 'in-right' | 'out' | 'none'
}

export interface IslandSpec {
  widthIn: number
  depthIn: number
  aisleNorthIn: number
  overhangSouthIn: number
  stoolsCount: number
}

export interface FlexWallSpec {
  id: string
  label: string
  roomAId: string
  roomBId: string
  level?: 1 | 2
  nudgeIn: number
  maxNudgeIn: number
  studThicknessIn: number
}

export interface HouseZoneRect {
  id: string
  label: string
  level: 1 | 2
  xIn: number
  yIn: number
  widthIn: number
  depthIn: number
}

export interface RoomNode {
  id: string
  number: string
  name: string
  subtitle: string
  level?: 1 | 2
  status: RoomStatus
  planRect: {
    xIn: number
    yIn: number
    widthIn: number
    depthIn: number
  }
  flexPlanBinding?: {
    flexWallId: string
    role: 'expand_east' | 'shift_west'
  }
  ceilingHeightIn: number
  ceilingLabel: string
  wallThicknessIn: number
  island?: IslandSpec
  datums: DatumLine[]
  walls: WallEdge[]
  planOpenings: WallOpening[]
}

export interface RoomCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  measured: string
  detail: string
}

export interface D1PlanNote {
  id: string
  revitId?: number
  level: 1 | 2
  text: string
  textBoxRoom: string
  targetRoomId: string
  targetRoomName: string
  hasLeader: boolean
  method: string
  confidence: 'high' | 'medium' | 'flagged_retargeted' | 'review' | 'conflict_review'
  boxXYIn: [number, number]
  tipXYIn: [number, number]
}

export interface HouseMatrix {
  projectId: string
  projectName: string
  stageLabel: string
  rooms: RoomNode[]
  flexWalls: Record<string, FlexWallSpec>
  outdoorZones?: HouseZoneRect[]
  voidZones?: HouseZoneRect[]
  d1Notes?: D1PlanNote[]
}

export interface ResolvedBayPlacement {
  bay: CaseworkBay
  index: number
  xStartIn: number
  xEndIn: number
  centerIn: number
}

export interface ResolvedWallLayout {
  clearWidthIn: number
  totalBayWidthIn: number
  leftScribeIn: number
  rightScribeIn: number
  overflowIn: number
  placements: ResolvedBayPlacement[]
}

export interface BayPresetMeta {
  kind: BayKind
  label: string
  defaultWidthIn: number
  defaultHeightIn: number
  defaultDepthIn: number
  defaultAffIn: number
  revitFamily: string
  revitParams: string
}

export const BAY_PRESETS: BayPresetMeta[] = [
  {
    kind: 'drawer_stack',
    label: '3-Drawer Base',
    defaultWidthIn: 24,
    defaultHeightIn: 36,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Base Cabinet-3 Drawers.rfa',
    revitParams: 'Width · Depth · Height',
  },
  {
    kind: 'base_doors',
    label: '2-Door Base',
    defaultWidthIn: 30,
    defaultHeightIn: 36,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Base Cabinet-Double Door & 1 Drawer.rfa',
    revitParams: 'Width · Depth · Height',
  },
  {
    kind: 'sink_base',
    label: 'Vanity / Sink Base',
    defaultWidthIn: 36,
    defaultHeightIn: 36,
    defaultDepthIn: 22,
    defaultAffIn: 0,
    revitFamily: 'Vanity_Sink_Kathryn_Undermount.rfa',
    revitParams: 'Width · Bowl_CL · Faucet_Set',
  },
  {
    kind: 'scribe_panel',
    label: 'Oak Scribe / Filler Panel',
    defaultWidthIn: 1.5,
    defaultHeightIn: 36,
    defaultDepthIn: 21,
    defaultAffIn: 0,
    revitFamily: 'Barnhaus_Vanity_Scribe_Filler.rfa',
    revitParams: 'Width · Height=36" · Depth=21"',
  },
  {
    kind: 'wall_partition',
    label: 'Interior Partition / Pony Wall',
    defaultWidthIn: 4.5,
    defaultHeightIn: 120,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Basic Wall: Interior - 4 1/2" Partition',
    revitParams: 'Thickness=4.5" · Height',
  },
  {
    kind: 'floating_shelves',
    label: 'Floating Oak Shelves (3)',
    defaultWidthIn: 60,
    defaultHeightIn: 90,
    defaultDepthIn: 12,
    defaultAffIn: 0,
    revitFamily: 'Barnhaus_Floating_Oak_Shelf_2in.rfa',
    revitParams: 'Width · Plank_Thk=2" · Tier_Count=3',
  },
  {
    kind: 'tall_oven',
    label: 'Tall Oven Tower',
    defaultWidthIn: 30,
    defaultHeightIn: 108,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Tall Cabinet-Double Oven.rfa',
    revitParams: 'Width · Top_Datum · Cutout_AFF',
  },
  {
    kind: 'fridge',
    label: 'Integrated Fridge Tower',
    defaultWidthIn: 30,
    defaultHeightIn: 108,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Appliance-Panel_Column_Fridge.rfa',
    revitParams: 'Width · Top_Datum · Door_Swing',
  },
  {
    kind: 'tall_tower',
    label: 'Tall Pantry Tower',
    defaultWidthIn: 30,
    defaultHeightIn: 108,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Tall Cabinet-Double Door Pantry.rfa',
    revitParams: 'Width · Depth · Top_Datum',
  },
  {
    kind: 'range_hood',
    label: 'Range + Custom Hood',
    defaultWidthIn: 48,
    defaultHeightIn: 108,
    defaultDepthIn: 26,
    defaultAffIn: 0,
    revitFamily: 'Range_Pro_48in_With_Plaster_Hood.rfa',
    revitParams: 'Range_W · Hood_W · Top_Datum',
  },
  {
    kind: 'closet_double_hang',
    label: 'Double Hang',
    defaultWidthIn: 36,
    defaultHeightIn: 96,
    defaultDepthIn: 16,
    defaultAffIn: 0,
    revitFamily: 'Closet_Bay-Double_Hang.rfa',
    revitParams: 'Width · Rod_Low=40" · Rod_High=82"',
  },
  {
    kind: 'closet_long_hang',
    label: 'Long Hang + Shoe',
    defaultWidthIn: 33,
    defaultHeightIn: 96,
    defaultDepthIn: 16,
    defaultAffIn: 0,
    revitFamily: 'Closet_Bay-Long_Hang_66in.rfa',
    revitParams: 'Width · Clear_Hang=66" · Shoe_Shelf',
  },
  {
    kind: 'closet_drawers',
    label: 'Closet Drawers (4)',
    defaultWidthIn: 30,
    defaultHeightIn: 96,
    defaultDepthIn: 20,
    defaultAffIn: 0,
    revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
    revitParams: 'Width · Drawer_Top=32" · Datum=96"',
  },
  {
    kind: 'closet_shelves',
    label: 'Shoe & Display Shelves',
    defaultWidthIn: 36,
    defaultHeightIn: 96,
    defaultDepthIn: 14,
    defaultAffIn: 0,
    revitFamily: 'Closet_Bay-Slanted_Shoe_Tower.rfa',
    revitParams: 'Width · Shelf_Pitch · Datum=96"',
  },
  {
    kind: 'fireplace_chase',
    label: 'Fireplace Stone Chase',
    defaultWidthIn: 112,
    defaultHeightIn: 238,
    defaultDepthIn: 24,
    defaultAffIn: 0,
    revitFamily: 'Barnhaus_Fireplace_Chase_Assembly.rfa',
    revitParams: 'Chase_W · Hearth=18" · Mantel=72×8×6@62"',
  },
  {
    kind: 'wet_room_glass',
    label: 'Wet Room 1/8" Glass',
    defaultWidthIn: 64,
    defaultHeightIn: 120,
    defaultDepthIn: 48,
    defaultAffIn: 0,
    revitFamily: 'Shower_Enclosure-Frameless_FullHeight.rfa',
    revitParams: 'Width · Glass=1/8" · Bench=18" · Niche=14×50',
  },
  {
    kind: 'accordion_door',
    label: '4-Panel Accordion Glass',
    defaultWidthIn: 192,
    defaultHeightIn: 96,
    defaultDepthIn: 6,
    defaultAffIn: 0,
    revitFamily: 'Door-Accordion_4Panel_Alum.rfa',
    revitParams: 'Rough_Width=192" · Head=96"',
  },
  {
    kind: 'window',
    label: 'Casement Window',
    defaultWidthIn: 72,
    defaultHeightIn: 54,
    defaultDepthIn: 6,
    defaultAffIn: 36,
    revitFamily: 'Window-Casement_Triple_Black.rfa',
    revitParams: 'Width · Sill_AFF · Head_AFF',
  },
  {
    kind: 'door',
    label: 'Cased Interior Door',
    defaultWidthIn: 36,
    defaultHeightIn: 96,
    defaultDepthIn: 6,
    defaultAffIn: 0,
    revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
    revitParams: 'Width · Height · Casing=3.5"',
  },
  {
    kind: 'toilet_bay',
    label: 'Water Closet Bay',
    defaultWidthIn: 32,
    defaultHeightIn: 30,
    defaultDepthIn: 28,
    defaultAffIn: 0,
    revitFamily: 'Plumbing-WC_Skirted_Kohler.rfa',
    revitParams: 'Clear_Bay_Width · Side_CL≥15"',
  },
]

export function getPresetMeta(kind: BayKind): BayPresetMeta {
  return BAY_PRESETS.find((p) => p.kind === kind) ?? BAY_PRESETS[0]
}

export function snapHalfInch(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 2) / 2
}

// 1/4-inch Matrix Wall Shift: snaps complementary .25 / .75 / scan-tenth fractions to clean whole inches
export function snapWholeInchQuarterShift(value: number): number {
  if (!Number.isFinite(value)) return 0
  const frac = Math.abs(value - Math.round(value))
  if (frac <= 0.42) return Math.round(value)
  return snapHalfInch(value)
}

export function formatInchesOnly(inches: number): string {
  const snapped = snapHalfInch(inches)
  const sign = snapped < 0 ? '-' : ''
  const abs = Math.abs(snapped)
  const whole = Math.floor(abs)
  const half = Math.abs(abs - whole - 0.5) < 0.01
  if (whole === 0 && half) return `${sign}1/2"`
  if (half) return `${sign}${whole} 1/2"`
  return `${sign}${whole}"`
}

export function formatArchInches(inches: number): string {
  const snapped = snapHalfInch(inches)
  const sign = snapped < 0 ? '-' : ''
  const abs = Math.abs(snapped)
  if (abs < 12) {
    return formatInchesOnly(snapped)
  }
  const feet = Math.floor(abs / 12)
  const rem = snapHalfInch(abs - feet * 12)
  const wholeIn = Math.floor(rem)
  const half = Math.abs(rem - wholeIn - 0.5) < 0.01
  if (wholeIn === 0 && half) {
    return `${sign}${feet}'-0 1/2"`
  }
  if (half) {
    return `${sign}${feet}'-${wholeIn} 1/2"`
  }
  return `${sign}${feet}'-${wholeIn}"`
}

export function getEffectiveWallWidth(matrix: HouseMatrix, wall: WallEdge): number {
  if (!wall.flexBinding) return snapHalfInch(wall.clearWidthIn)
  const flex = matrix.flexWalls[wall.flexBinding.flexWallId]
  if (!flex) return snapHalfInch(wall.clearWidthIn)
  return snapHalfInch(wall.clearWidthIn + wall.flexBinding.polarity * flex.nudgeIn)
}

export function getEffectiveRoomRect(
  matrix: HouseMatrix,
  room: RoomNode
): { xIn: number; yIn: number; widthIn: number; depthIn: number } {
  if (!room.flexPlanBinding) return room.planRect
  const flex = matrix.flexWalls[room.flexPlanBinding.flexWallId]
  if (!flex) return room.planRect
  if (room.flexPlanBinding.role === 'expand_east') {
    return {
      ...room.planRect,
      widthIn: snapHalfInch(room.planRect.widthIn + flex.nudgeIn),
    }
  }
  return {
    ...room.planRect,
    xIn: snapHalfInch(room.planRect.xIn + flex.nudgeIn),
    widthIn: snapHalfInch(room.planRect.widthIn - flex.nudgeIn),
  }
}

export function computeWallLayout(matrix: HouseMatrix, wall: WallEdge): ResolvedWallLayout {
  const clearWidthIn = getEffectiveWallWidth(matrix, wall)
  const totalBayWidthIn = snapHalfInch(
    wall.bays.reduce((acc, bay) => acc + snapHalfInch(bay.widthIn), 0)
  )
  const diff = snapHalfInch(clearWidthIn - totalBayWidthIn)
  const overflowIn = diff < 0 ? snapHalfInch(-diff) : 0
  const leftScribeIn =
    diff > 0 ? (wall.autoCenter !== false ? snapHalfInch(diff / 2) : 0) : 0
  const rightScribeIn = diff > 0 ? snapHalfInch(diff - leftScribeIn) : 0

  let cursor = leftScribeIn
  const placements: ResolvedBayPlacement[] = wall.bays.map((bay, index) => {
    const w = snapHalfInch(bay.widthIn)
    const xStartIn = snapHalfInch(cursor)
    const xEndIn = snapHalfInch(cursor + w)
    cursor = xEndIn
    return {
      bay,
      index,
      xStartIn,
      xEndIn,
      centerIn: snapHalfInch((xStartIn + xEndIn) / 2),
    }
  })

  return {
    clearWidthIn,
    totalBayWidthIn,
    leftScribeIn,
    rightScribeIn,
    overflowIn,
    placements,
  }
}

const FOCAL_BAY_PRIORITY: BayKind[] = [
  'fireplace_chase',
  'range_hood',
  'sink_base',
  'accordion_door',
  'window',
  'closet_shelves',
]

// Exclude shower/toilet enclosures when analyzing vanity/casework flanking symmetry
function getCaseworkGroupBays(bays: CaseworkBay[]): CaseworkBay[] {
  const filtered = bays.filter(
    (b) => b.kind !== 'wet_room_glass' && b.kind !== 'toilet_bay' && b.kind !== 'door'
  )
  return filtered.length > 0 ? filtered : bays
}

export function findFocalBayIndex(bays: CaseworkBay[]): number {
  for (const focalKind of FOCAL_BAY_PRIORITY) {
    const matches = bays
      .map((b, idx) => ({ b, idx }))
      .filter((item) => item.b.kind === focalKind)
    if (matches.length === 1) return matches[0].idx
  }
  if (bays.length >= 3 && bays.length % 2 === 1) {
    return Math.floor(bays.length / 2)
  }
  return -1
}

export function evaluateRoomChecks(
  matrix: HouseMatrix,
  room: RoomNode,
  activeWallId: WallDirection
): RoomCheck[] {
  const wall = room.walls.find((w) => w.id === activeWallId) ?? room.walls[0]
  const layout = computeWallLayout(matrix, wall)
  const checks: RoomCheck[] = []

  // 1. Wall Fit & End Scribes
  if (layout.overflowIn > 0) {
    checks.push({
      id: 'wall-fit',
      label: 'Wall Clear Fit & Scribes',
      status: 'fail',
      measured: `+${formatInchesOnly(layout.overflowIn)} OVERFLOW`,
      detail: `Bay sum ${formatArchInches(layout.totalBayWidthIn)} exceeds ${formatArchInches(layout.clearWidthIn)} clear width.`,
    })
  } else if (wall.id === 'Island') {
    checks.push({
      id: 'wall-fit',
      label: 'Island Run & Waterfall Ends',
      status: 'pass',
      measured: `${formatArchInches(layout.totalBayWidthIn)} exact`,
      detail: `${wall.bays.length} bays fill ${formatArchInches(layout.clearWidthIn)} island slab cleanly.`,
    })
  } else if (wall.isCaseworkWall !== false && layout.leftScribeIn > 6.5) {
    checks.push({
      id: 'wall-fit',
      label: 'Wall Clear Fit & Scribes',
      status: 'warn',
      measured: `${formatInchesOnly(layout.leftScribeIn)} L · ${formatInchesOnly(layout.rightScribeIn)} R`,
      detail: `End fillers exceed 6" Barnhaus fitted-cabinetry max on ${formatArchInches(layout.clearWidthIn)} wall.`,
    })
  } else if (wall.isCaseworkWall !== false && layout.leftScribeIn < 0.75 && layout.leftScribeIn > 0) {
    checks.push({
      id: 'wall-fit',
      label: 'Wall Clear Fit & Scribes',
      status: 'warn',
      measured: `${formatInchesOnly(layout.leftScribeIn)} L · ${formatInchesOnly(layout.rightScribeIn)} R`,
      detail: `Tight scribe (< 3/4") against drywall out-of-plumb tolerance; prefer 1 1/2"–4".`,
    })
  } else {
    checks.push({
      id: 'wall-fit',
      label: 'Wall Clear Fit & Scribes',
      status: 'pass',
      measured:
        wall.isCaseworkWall === false
          ? `${formatArchInches(layout.leftScribeIn)} piers`
          : `${formatInchesOnly(layout.leftScribeIn)} L · ${formatInchesOnly(layout.rightScribeIn)} R`,
      detail: `${formatArchInches(layout.totalBayWidthIn)} bays centered in ${formatArchInches(layout.clearWidthIn)} clear span.`,
    })
  }

  // 2. Focal & Flanking / Palindrome Double-Vanity Symmetry
  const groupBays = getCaseworkGroupBays(wall.bays)
  const isPalindrome =
    groupBays.length >= 3 &&
    groupBays.every(
      (b, idx) =>
        b.kind === groupBays[groupBays.length - 1 - idx].kind &&
        Math.abs(b.widthIn - groupBays[groupBays.length - 1 - idx].widthIn) <= 0.5
    )
  const focalIdx = findFocalBayIndex(groupBays)
  if (isPalindrome) {
    checks.push({
      id: 'symmetry',
      label: 'Focal & Double-Bay Symmetry',
      status: 'pass',
      measured: `${groupBays.map((b) => formatInchesOnly(b.widthIn)).join(' · ')} (Δ 0")`,
      detail: `Exact palindrome symmetry across ${groupBays.length} bays.`,
    })
  } else if (focalIdx > 0 && focalIdx < groupBays.length - 1) {
    const leftFlank = groupBays.slice(0, focalIdx)
    const rightFlank = groupBays.slice(focalIdx + 1)
    const leftSum = snapHalfInch(leftFlank.reduce((s, b) => s + b.widthIn, 0))
    const rightSum = snapHalfInch(rightFlank.reduce((s, b) => s + b.widthIn, 0))
    const delta = snapHalfInch(Math.abs(leftSum - rightSum))
    if (delta === 0) {
      checks.push({
        id: 'symmetry',
        label: 'Focal Flanking Symmetry',
        status: 'pass',
        measured: `${formatInchesOnly(leftSum)} = ${formatInchesOnly(rightSum)} (Δ 0")`,
        detail: `Balanced flanking bays around ${groupBays[focalIdx].label}.`,
      })
    } else {
      checks.push({
        id: 'symmetry',
        label: 'Focal Flanking Symmetry',
        status: 'warn',
        measured: `${formatInchesOnly(leftSum)} vs ${formatInchesOnly(rightSum)} (Δ ${formatInchesOnly(delta)})`,
        detail: `Asymmetric flanking bays around ${groupBays[focalIdx].label} — click Symmetrize to balance.`,
      })
    }
  } else {
    checks.push({
      id: 'symmetry',
      label: 'Elevation Rhythm & Balance',
      status: 'pass',
      measured: `${wall.bays.length} bays ordered`,
      detail: `Bay divisions aligned cleanly along ${wall.shortLabel}.`,
    })
  }

  // 3. Datum Alignment Check
  const tallBays = wall.bays.filter(
    (b) =>
      b.kind === 'tall_oven' ||
      b.kind === 'fridge' ||
      b.kind === 'tall_tower' ||
      b.kind === 'range_hood' ||
      b.kind.startsWith('closet_')
  )
  if (tallBays.length >= 2) {
    const tops = tallBays.map((b) => snapHalfInch(b.affIn + b.heightIn))
    const minTop = Math.min(...tops)
    const maxTop = Math.max(...tops)
    if (maxTop - minTop <= 0.5) {
      checks.push({
        id: 'datum',
        label: 'Horizontal Datum Lock',
        status: 'pass',
        measured: `Aligned @ ${formatInchesOnly(maxTop)} AFF`,
        detail: `All ${tallBays.length} tall/wardrobe bays hold a continuous ${formatArchInches(maxTop)} head line.`,
      })
    } else {
      checks.push({
        id: 'datum',
        label: 'Horizontal Datum Lock',
        status: 'warn',
        measured: `${formatInchesOnly(minTop)}–${formatInchesOnly(maxTop)} ragged`,
        detail: `Top heights vary by ${formatInchesOnly(maxTop - minTop)}; run "align tops ${maxTop}" to lock datum.`,
      })
    }
  } else {
    const highestDatum = room.datums[room.datums.length - 1]
    const headClip = wall.bays.some((b) => b.affIn + b.heightIn > wall.ceilingHeightIn + 0.5)
    checks.push({
      id: 'datum',
      label: 'Ceiling & Head Datum',
      status: headClip ? 'fail' : 'pass',
      measured: headClip
        ? 'Clips Ceiling'
        : highestDatum
          ? `Locked @ ${formatInchesOnly(highestDatum.affIn)}`
          : `${formatArchInches(wall.ceilingHeightIn)} Clg`,
      detail: headClip
        ? 'One or more bays exceed ceiling elevation.'
        : `All openings & millwork respect ${room.ceilingLabel} geometry.`,
    })
  }

  // 4. Room-Specific Clearance / Code Check
  if (room.island) {
    const minAisle = room.id === '101' ? 42 : 36
    const ok = room.island.aisleNorthIn >= minAisle
    checks.push({
      id: 'clearance',
      label: 'Island Clear Work Aisle',
      status: ok ? 'pass' : 'fail',
      measured: `${formatInchesOnly(room.island.aisleNorthIn)} CLEAR`,
      detail: ok
        ? `Meets Barnhaus D2 ${minAisle}" minimum clear aisle around ${formatInchesOnly(room.island.widthIn)}×${formatInchesOnly(room.island.depthIn)} island.`
        : `Aisle below ${minAisle}" minimum clear target.`,
    })
  } else if (room.id === '104' || room.id === '103') {
    const rect = getEffectiveRoomRect(matrix, room)
    if (room.id === '104') {
      const southWall = room.walls.find((w) => w.id === 'S')
      const southClear = southWall ? getEffectiveWallWidth(matrix, southWall) : rect.widthIn
      const wcClear = snapHalfInch(southClear - 32)
      checks.push({
        id: 'clearance',
        label: 'Fixture & Flex Partition Check',
        status: wcClear >= 30 ? 'pass' : 'fail',
        measured: `${formatInchesOnly(rect.widthIn)} Rm · ${formatInchesOnly(wcClear)} WC`,
        detail:
          wcClear >= 30
            ? `WC bay ${formatInchesOnly(wcClear)} clear (≥ 30" IRC min) + 32" shower clear.`
            : `WC bay squeezed to ${formatInchesOnly(wcClear)} (< 30" IRC code minimum!).`,
      })
    } else {
      const minBedWidth = 132
      checks.push({
        id: 'clearance',
        label: 'Bedroom Clear Span (Flex)',
        status: rect.widthIn >= minBedWidth ? 'pass' : 'warn',
        measured: `${formatArchInches(rect.widthIn)} clear`,
        detail: `King/Queen bed + dual 30" nightstands fit comfortably (≥ 11'-0" standard).`,
      })
    }
  } else if (room.id === '100') {
    checks.push({
      id: 'clearance',
      label: 'Mantel & Hearth Combustible Code',
      status: 'pass',
      measured: '12" Mantel Clr · 18" Hearth',
      detail: '72×8×6 oak mantel at 62" AFF sits 12" clear above 50" firebox opening.',
    })
  } else if (isBathroomRoom(room)) {
    const masterRoom = matrix.rooms.find((r) => isMasterBathroomRoom(r))
    if (isMasterBathroomRoom(room)) {
      checks.push({
        id: 'bath-sequence',
        label: 'Master Bath House Anchor',
        status: 'pass',
        measured: '1st in Sequence (Sets Style)',
        detail: 'Master Bath establishes house-wide vanity millwork, 21" depth, 4" stone splash, 96" mirror head & 72" sconces.',
      })
    } else if (masterRoom && masterRoom.status === 'draft') {
      checks.push({
        id: 'bath-sequence',
        label: 'Master Bath Sequence Gate',
        status: 'warn',
        measured: `Solve ${masterRoom.id} First`,
        detail: `Lock ${masterRoom.id} ${masterRoom.name} before Guest/Powder Baths so styling propagates cleanly (Lesson 367ec0ca).`,
      })
    } else if (masterRoom) {
      checks.push({
        id: 'bath-sequence',
        label: 'Master Bath Style Sync',
        status: 'pass',
        measured: `Anchored to ${masterRoom.id}`,
        detail: `Inherits ${masterRoom.id} cabinetry, stone counter + 4" splash, 96" mirror head & 72" sconce datums.`,
      })
    }
    const wcBay = room.walls.flatMap((w) => w.bays).find((b) => b.kind === 'toilet_bay')
    const offStepBays = wall.bays.filter(
      (b) =>
        (b.kind === 'drawer_stack' || b.kind === 'sink_base' || b.kind === 'base_doors' || b.kind === 'tall_tower') &&
        Math.abs((b.widthIn % 3) - 0) > 0.05 &&
        Math.abs((b.widthIn % 3) - 3) > 0.05
    )
    const wcOk = !wcBay || wcBay.widthIn >= 30
    checks.push({
      id: 'clearance',
      label: 'Barnhaus Bath Code & Datums',
      status: !wcOk ? 'fail' : offStepBays.length > 0 ? 'warn' : 'pass',
      measured: wcBay
        ? `WC ${formatInchesOnly(wcBay.widthIn)} · 96" Mirror · 72" Sconce`
        : '21" Depth · 4" Splash · 96" Mirror',
      detail: !wcOk
        ? `WC bay ${formatInchesOnly(wcBay!.widthIn)} < 30" minimum (15" centerline code clearance).`
        : offStepBays.length > 0
          ? `${offStepBays.length} cabinet bay(s) off 3" Barnhaus width increment.`
          : '21" vanity depth, 4" stone lip + full-height tile to clg, 48"–96" mirrors, 72" sconces & SH-COL column.',
    })
  } else {
    checks.push({
      id: 'clearance',
      label: 'Millwork & Datum Clearances',
      status: 'pass',
      measured: `${formatArchInches(wall.ceilingHeightIn)} Clg`,
      detail: 'All fixtures and millwork clear door swings and Barnhaus datum lines.',
    })
  }

  return checks
}

export function isBathroomRoom(room: Pick<RoomNode, 'name' | 'subtitle'>): boolean {
  const txt = `${room.name} ${room.subtitle || ''}`.toLowerCase()
  return txt.includes('bath') || txt.includes('powder') || txt.includes('restroom')
}

export function isMasterBathroomRoom(room: Pick<RoomNode, 'name' | 'subtitle'>): boolean {
  const nm = room.name.toLowerCase()
  return isBathroomRoom(room) && (nm.includes('master') || nm.includes('primary'))
}

export function propagateMasterBathStyleToHouse(matrix: HouseMatrix): {
  matrix: HouseMatrix
  updatedRooms: string[]
} {
  const master = matrix.rooms.find((r) => isMasterBathroomRoom(r))
  if (!master) return { matrix, updatedRooms: [] }

  const masterSink = master.walls.flatMap((w) => w.bays).find((b) => b.kind === 'sink_base')
  const masterStack = master.walls.flatMap((w) => w.bays).find((b) => b.kind === 'drawer_stack')
  const styleNote =
    masterSink?.revitParams ??
    'Rift White Oak Shaker · 21"D (22" Stone Slab + Separate 4" Splash) · 4" Wood Toe Kick · 48"–96" Mirror · 72" Sconces'
  const updatedRooms: string[] = []

  const nextRooms = matrix.rooms.map((room) => {
    if (!isBathroomRoom(room) || room.id === master.id) return room
    updatedRooms.push(`${room.id} ${room.name}`)

    const syncedDatums = [
      { id: `d-${room.id}-36`, affIn: 36, label: '36" STONE COUNTER' },
      { id: `d-${room.id}-40`, affIn: 40, label: '40" 4" LIP + TILE TO CLG' },
      { id: `d-${room.id}-48`, affIn: 48, label: '48" MIRROR BOTTOM' },
      { id: `d-${room.id}-72`, affIn: 72, label: '72" LINEAR SCONCE MID' },
      { id: `d-${room.id}-88`, affIn: 88, label: '88" SHOWER COL RISER' },
      { id: `d-${room.id}-96`, affIn: 96, label: '96" DOOR-HEAD MIRROR TOP' },
    ]

    const totalExistingBays = room.walls.reduce((sum, w) => sum + w.bays.length, 0)
    let drwIdx = 0
    let snkIdx = 0
    let nextWalls = room.walls.map((w) => ({
      ...w,
      clearWidthIn: snapWholeInchQuarterShift(w.clearWidthIn),
      bays: w.bays.map((b) => {
        if (b.kind === 'sink_base' || b.kind === 'drawer_stack' || b.kind === 'base_doors') {
          const autoTag =
            b.tag ??
            (b.kind === 'sink_base'
              ? `V-S${++snkIdx}`
              : b.kind === 'drawer_stack'
                ? `V-D${++drwIdx}`
                : 'V-B1')
          return {
            ...b,
            tag: autoTag,
            depthIn: 21,
            fullHeightSplash: true,
            revitParams: `${b.revitParams} · Synced from ${master.id}: ${styleNote}`,
            ...(b.kind === 'sink_base' ? { hasMirror: true, hasSconces: true } : { drawerCount: 3 as const }),
          }
        }
        if (b.kind === 'wet_room_glass') {
          return {
            ...b,
            tag: b.tag ?? (b.hasTubCurtain ? 'TUB-1' : 'SH-COL'),
            hasShowerColumn: b.hasShowerColumn ?? true,
          }
        }
        if (b.kind === 'toilet_bay') {
          return { ...b, tag: b.tag ?? 'WC-1' }
        }
        return b
      }),
    }))

    // If secondary Guest/Powder Bath shell has no millwork bays yet, compose a 3"-step vanity from Master style!
    if (totalExistingBays === 0 && nextWalls.length > 0) {
      const sortedByClear = [...nextWalls].sort(
        (a, b) => getEffectiveWallWidth(matrix, b) - getEffectiveWallWidth(matrix, a)
      )
      const targetWall = sortedByClear[0]
      const clearW = getEffectiveWallWidth(matrix, targetWall)
      const isPowder = room.name.toLowerCase().includes('powder')
      let composedBays: CaseworkBay[] = []

      if (isPowder || clearW < 58) {
        const sinkW = clearW >= 42 ? 36 : clearW >= 34 ? 30 : 24
        composedBays = [
          {
            ...createBayFromPreset('sink_base', `${room.id}-${targetWall.id}-vs`, sinkW),
            label: isPowder ? `${sinkW}" Powder Vanity` : `${sinkW}" Single Vanity`,
            depthIn: 21,
            fullHeightSplash: false,
            hasMirror: true,
            hasSconces: true,
            revitFamily: masterSink?.revitFamily ?? 'BH_Vanity_SinkBase_2Door_Shaker',
            revitParams: `Synced from ${master.id} Master Bath · ${sinkW}"W × 21"D × 36"H · 4" Stone Splash · 48"–96" Mirror · 72" Sconces`,
          },
        ]
      } else {
        const avail = Math.min(72, clearW - 3)
        const sinkW = avail >= 66 ? 36 : 30
        const rawStack = Math.floor((avail - sinkW) / 2 / 3) * 3
        const stackW = Math.max(12, Math.min(18, rawStack))
        composedBays = [
          {
            ...createBayFromPreset('drawer_stack', `${room.id}-${targetWall.id}-vl`, stackW),
            label: `${stackW}" 3-Drawer`,
            depthIn: 21,
            drawerCount: 3,
            fullHeightSplash: false,
            revitFamily: masterStack?.revitFamily ?? 'BH_Vanity_3Drawer_Shaker',
            revitParams: `Synced from ${master.id} Master Bath · ${stackW}"W × 21"D × 36"H · 4" Wood Toe Kick`,
          },
          {
            ...createBayFromPreset('sink_base', `${room.id}-${targetWall.id}-vs`, sinkW),
            label: `${sinkW}" Sink Base`,
            depthIn: 21,
            fullHeightSplash: false,
            hasMirror: true,
            hasSconces: true,
            revitFamily: masterSink?.revitFamily ?? 'BH_Vanity_SinkBase_2Door_Shaker',
            revitParams: `Synced from ${master.id} Master Bath · ${sinkW}"W × 21"D × 36"H · 4" Stone Splash · 48"–96" Mirror · 72" Sconces`,
          },
          {
            ...createBayFromPreset('drawer_stack', `${room.id}-${targetWall.id}-vr`, stackW),
            label: `${stackW}" 3-Drawer`,
            depthIn: 21,
            drawerCount: 3,
            fullHeightSplash: false,
            revitFamily: masterStack?.revitFamily ?? 'BH_Vanity_3Drawer_Shaker',
            revitParams: `Synced from ${master.id} Master Bath · ${stackW}"W × 21"D × 36"H · 4" Wood Toe Kick`,
          },
        ]
      }

      nextWalls = nextWalls.map((w) => (w.id === targetWall.id ? { ...w, bays: composedBays } : w))
    }

    return {
      ...room,
      subtitle: `Synced from ${master.id} Master Bath · 21" Vanity · 4" Splash · 96" Mirror`,
      status: room.status === 'draft' ? ('needs_review' as RoomStatus) : room.status,
      datums: syncedDatums,
      walls: nextWalls,
    }
  })

  return {
    matrix: { ...matrix, rooms: nextRooms },
    updatedRooms,
  }
}

export function symmetrizeWallFlanks(wall: WallEdge, clearWidthIn: number): WallEdge {
  const focalIdx = findFocalBayIndex(wall.bays)
  if (focalIdx <= 0 || focalIdx >= wall.bays.length - 1) return wall

  const focal = wall.bays[focalIdx]
  const leftCount = focalIdx
  const rightCount = wall.bays.length - 1 - focalIdx
  if (leftCount !== rightCount) {
    // Mirror the left bays onto the right side around the focal bay while keeping within clearWidthIn
    const mirroredRight: CaseworkBay[] = wall.bays
      .slice(0, focalIdx)
      .reverse()
      .map((b, idx) => ({
        ...b,
        id: `${b.id}-sym-${idx}`,
      }))
    return {
      ...wall,
      bays: [...wall.bays.slice(0, focalIdx), focal, ...mirroredRight],
    }
  }

  const nextBays = wall.bays.map((b) => ({ ...b }))
  for (let offset = 1; offset <= leftCount; offset++) {
    const lIdx = focalIdx - offset
    const rIdx = focalIdx + offset
    const avg = snapHalfInch((nextBays[lIdx].widthIn + nextBays[rIdx].widthIn) / 2)
    nextBays[lIdx].widthIn = avg
    nextBays[rIdx].widthIn = avg
    nextBays[rIdx].heightIn = nextBays[lIdx].heightIn
    nextBays[rIdx].affIn = nextBays[lIdx].affIn
  }

  const sum = nextBays.reduce((s, b) => s + b.widthIn, 0)
  if (sum > clearWidthIn && leftCount > 0) {
    const excessPerSide = snapHalfInch((sum - clearWidthIn + 4) / (2 * leftCount))
    for (let offset = 1; offset <= leftCount; offset++) {
      const lIdx = focalIdx - offset
      const rIdx = focalIdx + offset
      const clamped = Math.max(12, snapHalfInch(nextBays[lIdx].widthIn - excessPerSide))
      nextBays[lIdx].widthIn = clamped
      nextBays[rIdx].widthIn = clamped
    }
  }

  return { ...wall, bays: nextBays }
}

export function createBayFromPreset(
  kind: BayKind,
  idSuffix: string,
  widthOverride?: number,
  ceilingDatumIn?: number
): CaseworkBay {
  const preset = getPresetMeta(kind)
  const widthIn = snapHalfInch(widthOverride ?? preset.defaultWidthIn)
  const isTallOrCloset =
    kind === 'tall_oven' ||
    kind === 'fridge' ||
    kind === 'tall_tower' ||
    kind === 'range_hood' ||
    kind.startsWith('closet_')
  const heightIn =
    isTallOrCloset && ceilingDatumIn ? ceilingDatumIn : preset.defaultHeightIn

  return {
    id: `bay-${idSuffix}`,
    kind,
    label: `${formatInchesOnly(widthIn)} ${preset.label}`,
    widthIn,
    heightIn,
    depthIn: preset.defaultDepthIn,
    affIn: preset.defaultAffIn,
    drawerCount: kind === 'closet_drawers' ? 4 : kind === 'drawer_stack' ? 3 : undefined,
    shelfCount: kind === 'floating_shelves' ? 3 : undefined,
    withLowerBase: kind === 'floating_shelves' ? false : undefined,
    lowerBaseHeightIn: kind === 'floating_shelves' ? 30 : undefined,
    hasMirror: kind === 'sink_base' ? true : undefined,
    hasSconces: kind === 'sink_base' ? true : undefined,
    fullHeightSplash: kind === 'sink_base' ? true : undefined,
    hoodWidthIn: kind === 'range_hood' ? snapHalfInch(widthIn + 6) : undefined,
    revitFamily: preset.revitFamily,
    revitParams: preset.revitParams,
  }
}

export function applyQuickCommand(
  matrix: HouseMatrix,
  roomId: string,
  wallId: WallDirection,
  selectedBayId: string | null,
  rawCommand: string
): { matrix: HouseMatrix; message: string; selectedBayId: string | null } {
  const cmd = rawCommand.trim().toLowerCase()
  if (!cmd) {
    return { matrix, message: 'Enter a design command.', selectedBayId }
  }

  const room = matrix.rooms.find((r) => r.id === roomId)
  if (!room) return { matrix, message: 'Active room not found.', selectedBayId }
  const wall = room.walls.find((w) => w.id === wallId) ?? room.walls[0]
  const clearWidthIn = getEffectiveWallWidth(matrix, wall)

  // 1. Nudge shared wall: e.g. "nudge wall +2", "nudge -1.5", "flex +2"
  const nudgeMatch = cmd.match(/(?:nudge|flex|move\s+wall|wall)\s*([+-]?\d+(?:\.\d+)?)/)
  if (nudgeMatch && (cmd.includes('nudge') || cmd.includes('flex') || cmd.includes('wall'))) {
    const delta = snapHalfInch(parseFloat(nudgeMatch[1]))
    const flexId =
      wall.flexBinding?.flexWallId ||
      room.flexPlanBinding?.flexWallId ||
      Object.keys(matrix.flexWalls)[0]
    const flex = matrix.flexWalls[flexId]
    if (flex) {
      const nextNudge = Math.max(
        -flex.maxNudgeIn,
        Math.min(flex.maxNudgeIn, snapHalfInch(flex.nudgeIn + delta))
      )
      return {
        matrix: {
          ...matrix,
          flexWalls: {
            ...matrix.flexWalls,
            [flexId]: { ...flex, nudgeIn: nextNudge },
          },
        },
        message: `Shared partition nudged to ${nextNudge > 0 ? '+' : ''}${formatInchesOnly(nextNudge)} — adjacent rooms & scribes re-solved.`,
        selectedBayId,
      }
    }
  }

  // 1b. Propagate Master Bath styling across all Guest/Powder Baths
  if (
    (cmd.includes('sync') || cmd.includes('propagate') || cmd.includes('apply')) &&
    cmd.includes('master')
  ) {
    const res = propagateMasterBathStyleToHouse(matrix)
    return {
      matrix: res.matrix,
      message:
        res.updatedRooms.length > 0
          ? `Synced Master Bath millwork, 21" depth, 4" stone splash, 96" mirror head & 72" sconces to: ${res.updatedRooms.join(', ')}.`
          : 'No secondary Guest/Powder Baths found to sync.',
      selectedBayId,
    }
  }

  // 1c. 5-Bay Master Double Vanity builder: e.g. "double vanity", "master vanity"
  if (cmd.includes('double vanity') || cmd.includes('master vanity')) {
    const avail = Math.max(78, clearWidthIn - 2.5)
    const sinkW = avail >= 90 ? 24 : 21
    const centerW = avail >= 84 ? 18 : 15
    const outerW = Math.max(12, Math.floor((avail - sinkW * 2 - centerW) / 2 / 3) * 3)
    const mk = (kind: BayKind, suffix: string, wIn: number, lbl: string): CaseworkBay => ({
      ...createBayFromPreset(kind, `${wall.id}-${suffix}`, wIn),
      label: lbl,
      depthIn: 21,
      drawerCount: 3,
      fullHeightSplash: false,
      ...(kind === 'sink_base' ? { hasMirror: true, hasSconces: true } : {}),
    })
    const nextBays = [
      mk('drawer_stack', 'dvl', outerW, `${outerW}" 3-Drawer`),
      mk('sink_base', 'dvs1', sinkW, `${sinkW}" Sink 1`),
      mk('drawer_stack', 'dvc', centerW, `${centerW}" Center 3-Drw`),
      mk('sink_base', 'dvs2', sinkW, `${sinkW}" Sink 2`),
      mk('drawer_stack', 'dvr', outerW, `${outerW}" 3-Drawer`),
    ]
    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, { ...wall, bays: nextBays }),
      message: `Built 5-bay symmetrical double vanity (${outerW}" | ${sinkW}" | ${centerW}" | ${sinkW}" | ${outerW}" = ${outerW * 2 + sinkW * 2 + centerW}").`,
      selectedBayId: nextBays[1].id,
    }
  }

  // 2. Symmetric vanity builder: e.g. "60 vanity symmetric", "72 vanity", "80 vanity symmetric"
  const vanityMatch = cmd.match(/(\d+(?:\.\d+)?)\s*(?:"|in)?\s*vanity/)
  if (vanityMatch) {
    const targetTotal = snapHalfInch(parseFloat(vanityMatch[1]))
    const sinkW = targetTotal >= 72 ? 36 : targetTotal >= 54 ? 30 : 24
    const drawerW = Math.max(12, snapHalfInch((targetTotal - sinkW) / 2))
    const actualTotal = drawerW * 2 + sinkW
    const wetBays = wall.bays.filter((b) => b.kind === 'wet_room_glass' || b.kind === 'toilet_bay')
    const leftBay = createBayFromPreset('drawer_stack', `${wall.id}-vl`, drawerW)
    const sinkBay = createBayFromPreset('sink_base', `${wall.id}-vs`, sinkW)
    const rightBay = createBayFromPreset('drawer_stack', `${wall.id}-vr`, drawerW)
    const nextBays = [leftBay, sinkBay, rightBay, ...wetBays]

    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, { ...wall, bays: nextBays }),
      message: `Built symmetric ${formatInchesOnly(actualTotal)} vanity (${formatInchesOnly(drawerW)} + ${formatInchesOnly(sinkW)} sink + ${formatInchesOnly(drawerW)}).`,
      selectedBayId: sinkBay.id,
    }
  }

  // 3. Align tops to datum: e.g. "align tops 96", "align tops 108"
  const alignMatch = cmd.match(/align.*?(\d+(?:\.\d+)?)/)
  if (alignMatch) {
    const targetTop = snapHalfInch(parseFloat(alignMatch[1]))
    const nextBays = wall.bays.map((b) => {
      if (
        b.kind === 'tall_oven' ||
        b.kind === 'fridge' ||
        b.kind === 'tall_tower' ||
        b.kind === 'range_hood' ||
        b.kind.startsWith('closet_') ||
        b.kind === 'floating_shelves'
      ) {
        return { ...b, heightIn: Math.max(24, snapHalfInch(targetTop - b.affIn)) }
      }
      return b
    })
    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, { ...wall, bays: nextBays }),
      message: `Aligned tall & upper bays on ${wall.shortLabel} to ${formatInchesOnly(targetTop)} AFF datum.`,
      selectedBayId,
    }
  }

  // 4. Floating shelves shorthand: e.g. "3 shelves", "4 shelves", "floating shelves"
  if (cmd.includes('shelf') || cmd.includes('shelves')) {
    const countMatch = cmd.match(/(\d+)\s*shel/)
    const shelfCount = countMatch ? Math.max(2, Math.min(5, parseInt(countMatch[1], 10))) : 3
    if (selectedBayId && wall.bays.some((b) => b.id === selectedBayId)) {
      const nextBays = wall.bays.map((b) =>
        b.id === selectedBayId
          ? {
              ...b,
              kind: 'floating_shelves' as const,
              shelfCount,
              withLowerBase: b.withLowerBase ?? true,
              lowerBaseHeightIn: b.lowerBaseHeightIn ?? 30,
              heightIn: Math.max(b.heightIn, 90),
              label: `${formatInchesOnly(b.widthIn)} Oak Base + ${shelfCount} Shelves`,
              revitFamily: 'Barnhaus_Floating_Oak_Shelf_2in.rfa',
            }
          : b
      )
      return {
        matrix: updateWallInMatrix(matrix, room.id, wall.id, { ...wall, bays: nextBays }),
        message: `Updated selected bay to ${shelfCount} × 2" white oak floating shelves on datum grid.`,
        selectedBayId,
      }
    }
    const added = createBayFromPreset('floating_shelves', `${wall.id}-${wall.bays.length + 1}`, 48)
    added.shelfCount = shelfCount
    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, {
        ...wall,
        bays: [...wall.bays, added],
      }),
      message: `Added 48" bay with ${shelfCount} × 2" floating oak shelves.`,
      selectedBayId: added.id,
    }
  }

  // 5. Add bay shorthand: e.g. "add 18 drawer", "add 24 base", "add 30 tall oven", "add 36 double hang"
  if (cmd.startsWith('add ') || cmd.includes('drawer') || cmd.includes('tower') || cmd.includes('hang')) {
    const widthMatch = cmd.match(/(\d+(?:\.\d+)?)/)
    const widthIn = widthMatch ? snapHalfInch(parseFloat(widthMatch[1])) : 24
    let kind: BayKind = 'drawer_stack'
    if (cmd.includes('oven')) kind = 'tall_oven'
    else if (cmd.includes('fridge')) kind = 'fridge'
    else if (cmd.includes('pantry') || cmd.includes('tower')) kind = 'tall_tower'
    else if (cmd.includes('sink')) kind = 'sink_base'
    else if (cmd.includes('long')) kind = 'closet_long_hang'
    else if (cmd.includes('hang')) kind = 'closet_double_hang'
    else if (cmd.includes('base') || cmd.includes('door')) kind = 'base_doors'

    const topDatum = room.datums.find((d) => d.affIn >= 96)?.affIn
    const newBay = createBayFromPreset(kind, `${wall.id}-${wall.bays.length + 1}`, widthIn, topDatum)
    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, {
        ...wall,
        bays: [...wall.bays, newBay],
      }),
      message: `Added ${newBay.label} (${newBay.revitFamily}).`,
      selectedBayId: newBay.id,
    }
  }

  // 6. Symmetrize command
  if (cmd.includes('sym')) {
    const balanced = symmetrizeWallFlanks(wall, clearWidthIn)
    return {
      matrix: updateWallInMatrix(matrix, room.id, wall.id, balanced),
      message: `Symmetrized flanking bays on ${wall.shortLabel}.`,
      selectedBayId,
    }
  }

  // 7. Room approval status
  if (cmd === 'approve' || cmd === 'approved') {
    return {
      matrix: {
        ...matrix,
        rooms: matrix.rooms.map((r) => (r.id === room.id ? { ...r, status: 'approved' } : r)),
      },
      message: `Marked ${room.number} ${room.name} as Approved.`,
      selectedBayId,
    }
  }

  return {
    matrix,
    message: `Unrecognized shorthand "${rawCommand}" — try "60 vanity symmetric", "add 18 drawer", "3 shelves", "align tops 96", or "nudge wall +2".`,
    selectedBayId,
  }
}

export function updateWallInMatrix(
  matrix: HouseMatrix,
  roomId: string,
  wallId: WallDirection,
  updatedWall: WallEdge
): HouseMatrix {
  return {
    ...matrix,
    rooms: matrix.rooms.map((room) =>
      room.id === roomId
        ? {
            ...room,
            walls: room.walls.map((w) => (w.id === wallId ? updatedWall : w)),
          }
        : room
    ),
  }
}

export function exportRevitBuildContract(matrix: HouseMatrix) {
  return {
    schema: 'barnhaus.designer_canvas.v1',
    exportedAt: new Date().toISOString(),
    projectId: matrix.projectId,
    projectName: matrix.projectName,
    stage: matrix.stageLabel,
    flexPartitions: matrix.flexWalls,
    rooms: matrix.rooms.map((room) => {
      const effectiveRect = getEffectiveRoomRect(matrix, room)
      return {
        roomNumber: room.number,
        roomName: room.name,
        status: room.status,
        footprintIn: effectiveRect,
        ceilingHeightIn: room.ceilingHeightIn,
        ceilingSpec: room.ceilingLabel,
        datums: room.datums,
        island: room.island ?? null,
        walls: room.walls.map((wall) => {
          const layout = computeWallLayout(matrix, wall)
          return {
            wallId: wall.id,
            title: wall.title,
            clearWidthIn: layout.clearWidthIn,
            leftScribeIn: layout.leftScribeIn,
            rightScribeIn: layout.rightScribeIn,
            overflowIn: layout.overflowIn,
            bays: layout.placements.map((p) => ({
              id: p.bay.id,
              tag: p.bay.tag ?? null,
              kind: p.bay.kind,
              label: p.bay.label,
              xStartIn: p.xStartIn,
              xEndIn: p.xEndIn,
              widthIn: p.bay.widthIn,
              heightIn: p.bay.heightIn,
              depthIn: p.bay.depthIn,
              affIn: p.bay.affIn,
              revitFamily: p.bay.revitFamily,
              revitParams: p.bay.revitParams,
            })),
          }
        }),
        checks: evaluateRoomChecks(matrix, room, room.walls[0].id),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Universal Multi-Project Presets, Custom Shell Builder & Revit Scan Importer
// ---------------------------------------------------------------------------

export interface CanvasProjectOption {
  id: string
  name: string
  kind: 'preset' | 'supabase' | 'custom' | 'imported'
  subtitle: string
}

export const CANVAS_PROJECT_PRESETS: CanvasProjectOption[] = [
  {
    id: 'sandbox-two-story',
    name: 'Two-Story Sandbox — (3,120 sf · L1 + L2)',
    kind: 'preset',
    subtitle: 'Two-Story Revit Scan · L1 (15 Rooms) + L2 (8 Rooms + Loft) · 20 Reactive Flex Walls',
  },
  {
    id: 'hill-country-4200',
    name: 'Hill Country Vaulted — 4,200 sf Sample',
    kind: 'preset',
    subtitle: '6 Rooms · Vaulted Great Room, Island Kitchen, Primary Suite & Flex Guest Wing',
  },
  {
    id: 'barnhaus-modern-2800',
    name: 'Barnhaus Modern — 2,800 sf Sample',
    kind: 'preset',
    subtitle: '5 Rooms · Linear Hearth, Galley Kitchen, 72" Primary Bath & Mudroom Lockers',
  },
  {
    id: 'blank-custom-shell',
    name: 'New Custom Project (Blank Shell)',
    kind: 'preset',
    subtitle: 'Starter shell — add rooms, set clear dimensions & author D2 casework from scratch',
  },
]

export type RoomTemplateKind =
  | 'living_fireplace'
  | 'kitchen_island'
  | 'bathroom_vanity'
  | 'walk_in_closet'
  | 'bedroom_suite'
  | 'empty_shell'

export function createHillCountrySampleMatrix(
  projectName = 'Hill Country Vaulted — 4,200 sf Sample',
  projectId = 'hill-country-4200'
): HouseMatrix {
  return {
    projectId,
    projectName,
    stageLabel: 'Draft 2 · Interior Architecture & Casework',
    flexWalls: {
      'flex-bed4-bath2': {
        id: 'flex-bed4-bath2',
        label: 'Partition 104/103 (Bath 2 ↔ Bed 4)',
        roomAId: '104',
        roomBId: '103',
        nudgeIn: 0,
        maxNudgeIn: 4,
        studThicknessIn: 6,
      },
    },
    rooms: [
      // 1. 100 GREAT ROOM — Fireplace & Glass Wall
      {
        id: '100',
        number: '100',
        name: 'Great Room',
        subtitle: 'Fireplace Chase, Symmetric Built-Ins & 16\'-0" Glass Wall',
        status: 'approved',
        planRect: { xIn: 204, yIn: 0, widthIn: 240, depthIn: 216 },
        ceilingHeightIn: 248,
        ceilingLabel: '1:12 Vaulted White Oak T&G (19\'-2" to 20\'-8") w/ W12X16',
        wallThicknessIn: 6,
        datums: [
          { id: 'd-gr-30', affIn: 30, label: '30" BUILT-IN TOP' },
          { id: 'd-gr-62', affIn: 62, label: '62" OAK MANTEL' },
          { id: 'd-gr-86', affIn: 86, label: '86" TOP SHELF' },
          { id: 'd-gr-96', affIn: 96, label: '96" DOOR HEAD' },
        ],
        planOpenings: [
          {
            id: 'op-gr-south-acc',
            wall: 'S',
            offsetIn: 24,
            widthIn: 192,
            kind: 'accordion',
            swing: 'out',
          },
          {
            id: 'op-gr-east-kit',
            wall: 'E',
            offsetIn: 42,
            widthIn: 132,
            kind: 'cased_opening',
            swing: 'none',
          },
          {
            id: 'op-gr-west-hall',
            wall: 'W',
            offsetIn: 156,
            widthIn: 36,
            kind: 'door',
            swing: 'in-left',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Stone Fireplace Chase & Flanking Oak Built-Ins',
            clearWidthIn: 240,
            ceilingHeightIn: 248,
            vaulted: {
              lowIn: 230,
              highIn: 248,
              slopeLabel: '1:12 VAULTED WHITE OAK T&G',
              beamLabel: 'W12X16 STEEL RIDGE BEAM',
              finishLabel: '1x6 Quarter-Sawn White Oak T&G',
            },
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'gr-n-left',
                kind: 'floating_shelves',
                label: '60" Oak Base + 3 Floating Shelves',
                widthIn: 60,
                heightIn: 90,
                depthIn: 18,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: true,
                lowerBaseHeightIn: 30,
                revitFamily: 'Barnhaus_Alcove_Base_3OakShelves.rfa',
                revitParams: 'Width=60" · Base_H=30" · Planks=3×2"',
              },
              {
                id: 'gr-n-chase',
                kind: 'fireplace_chase',
                label: '112" Stone Chase + 42×32 Firebox + 75" TV',
                widthIn: 112,
                heightIn: 239,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Barnhaus_Fireplace_Chase_Assembly.rfa',
                revitParams: '6" Steel Chase · 18" Hearth · 72×8×6 Mantel@62"',
              },
              {
                id: 'gr-n-right',
                kind: 'floating_shelves',
                label: '60" Oak Base + 3 Floating Shelves',
                widthIn: 60,
                heightIn: 90,
                depthIn: 18,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: true,
                lowerBaseHeightIn: 30,
                revitFamily: 'Barnhaus_Alcove_Base_3OakShelves.rfa',
                revitParams: 'Width=60" · Base_H=30" · Planks=3×2"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — 16\'-0" × 8\'-0" 4-Panel Accordion Patio Wall',
            clearWidthIn: 240,
            ceilingHeightIn: 248,
            vaulted: {
              lowIn: 248,
              highIn: 230,
              slopeLabel: '1:12 VAULTED WHITE OAK T&G',
              beamLabel: 'W12X16 STEEL HEADER',
              finishLabel: '1x6 White Oak T&G',
            },
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'gr-s-accordion',
                kind: 'accordion_door',
                label: '192"×96" 4-Panel Accordion Glass Door',
                widthIn: 192,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Accordion_4Panel_Alum.rfa',
                revitParams: 'Width=192" · Height=96" · Panels=4',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Cased Steel Portal to Kitchen',
            clearWidthIn: 216,
            ceilingHeightIn: 248,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'gr-e-portal',
                kind: 'door',
                label: '132"×108" Cased Kitchen Portal',
                widthIn: 132,
                heightIn: 108,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Opening-Cased_WhiteOak_Beam.rfa',
                revitParams: 'Clear_Span=132" · Head=108"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Primary Gallery & Courtyard Window',
            clearWidthIn: 216,
            ceilingHeightIn: 230,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'gr-w-win',
                kind: 'window',
                label: '84"×60" Courtyard Triple Window',
                widthIn: 84,
                heightIn: 60,
                depthIn: 6,
                affIn: 36,
                revitFamily: 'Window-Casement_Triple_Black.rfa',
                revitParams: 'Width=84" · Sill=36" · Head=96"',
              },
              {
                id: 'gr-w-door',
                kind: 'door',
                label: '36"×96" Primary Vestibule Door',
                widthIn: 36,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
                revitParams: 'Width=36" · Height=96"',
              },
            ],
          },
        ],
      },

      // 2. 101 KITCHEN — Cooking Wall, Sink Wall & Island
      {
        id: '101',
        number: '101',
        name: 'Kitchen',
        subtitle: '48" Range + 54" Hood, 108" Tall Towers & 108"×48" Island',
        status: 'approved',
        planRect: { xIn: 450, yIn: 0, widthIn: 180, depthIn: 216 },
        ceilingHeightIn: 144,
        ceilingLabel: '12\'-0" Flat Drywall w/ Perimeter Cove',
        wallThicknessIn: 6,
        island: {
          widthIn: 108,
          depthIn: 48,
          aisleNorthIn: 48,
          overhangSouthIn: 12,
          stoolsCount: 4,
        },
        datums: [
          { id: 'd-k-4', affIn: 4, label: '4" TOE KICK' },
          { id: 'd-k-36', affIn: 36, label: '36" COUNTER' },
          { id: 'd-k-54', affIn: 54, label: '54" SPLASH / UPPER' },
          { id: 'd-k-108', affIn: 108, label: '108" TALL DATUM' },
        ],
        planOpenings: [
          {
            id: 'op-k-east-win',
            wall: 'E',
            offsetIn: 72,
            widthIn: 72,
            kind: 'window',
          },
          {
            id: 'op-k-south-win',
            wall: 'S',
            offsetIn: 42,
            widthIn: 96,
            kind: 'window',
          },
          {
            id: 'op-k-west-open',
            wall: 'W',
            offsetIn: 42,
            widthIn: 132,
            kind: 'cased_opening',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Cooking Wall & Symmetric 108" Appliance Towers',
            clearWidthIn: 180,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'k-n-fridge',
                kind: 'fridge',
                label: '30" Integrated Fridge Column',
                widthIn: 30,
                heightIn: 108,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Appliance-SubZero_30_Column_Panel.rfa',
                revitParams: 'Width=30" · Top_Datum=108"',
              },
              {
                id: 'k-n-drw-l',
                kind: 'drawer_stack',
                label: '30" 3-Drawer Pots Stack',
                widthIn: 30,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=30" · Depth=24" · Height=36"',
              },
              {
                id: 'k-n-range',
                kind: 'range_hood',
                label: '48" Pro Range + 54" Custom Hood',
                widthIn: 48,
                heightIn: 108,
                depthIn: 26,
                affIn: 0,
                hoodWidthIn: 54,
                revitFamily: 'Range_Wolf_48in_Plaster_Hood_54in.rfa',
                revitParams: 'Range=48" · Hood=54" · Top_Datum=108"',
              },
              {
                id: 'k-n-drw-r',
                kind: 'drawer_stack',
                label: '30" 3-Drawer Prep Stack',
                widthIn: 30,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=30" · Depth=24" · Height=36"',
              },
              {
                id: 'k-n-oven',
                kind: 'tall_oven',
                label: '30" Double Wall Oven Tower',
                widthIn: 30,
                heightIn: 108,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Tall Cabinet-Double Oven.rfa',
                revitParams: 'Width=30" · Top_Datum=108" · Cutout=28.5"',
              },
            ],
          },
          {
            id: 'Island',
            shortLabel: 'Island',
            title: 'Center Island — 108"×48" Workstation Sink & Overhang',
            clearWidthIn: 108,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'k-i-trash',
                kind: 'base_doors',
                label: '24" Dual Trash Pullout',
                widthIn: 24,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Base Cabinet-Trash Pullout.rfa',
                revitParams: 'Width=24" · Bins=2×35qt',
              },
              {
                id: 'k-i-sink',
                kind: 'sink_base',
                label: '36" Undermount Workstation Sink',
                widthIn: 36,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                hasMirror: false,
                hasSconces: false,
                fullHeightSplash: false,
                revitFamily: 'Base Cabinet-Sink_36in_Galley.rfa',
                revitParams: 'Width=36" · Bowl=33"×18" · Gooseneck',
              },
              {
                id: 'k-i-dw',
                kind: 'base_doors',
                label: '24" Panel-Ready Dishwasher',
                widthIn: 24,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Dishwasher-Panel_Ready_24in.rfa',
                revitParams: 'Width=24" · Panel_Match=True',
              },
              {
                id: 'k-i-drw',
                kind: 'drawer_stack',
                label: '24" 3-Drawer Cutlery Stack',
                widthIn: 24,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=24" · Depth=24" · Height=36"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Scullery Pantry & Prep Window Run',
            clearWidthIn: 216,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'k-e-pantry-l',
                kind: 'tall_tower',
                label: '36" Dry Goods Pantry Tower',
                widthIn: 36,
                heightIn: 108,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Tall Cabinet-Double Door Pantry.rfa',
                revitParams: 'Width=36" · Top_Datum=108"',
              },
              {
                id: 'k-e-drw-l',
                kind: 'drawer_stack',
                label: '33" 3-Drawer Base',
                widthIn: 33,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=33" · Height=36"',
              },
              {
                id: 'k-e-sink',
                kind: 'sink_base',
                label: '36" Bar/Prep Sink Base',
                widthIn: 36,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                hasMirror: false,
                hasSconces: false,
                revitFamily: 'Base Cabinet-Prep_Sink_36in.rfa',
                revitParams: 'Width=36" · Window_CL_Align=True',
              },
              {
                id: 'k-e-drw-r',
                kind: 'drawer_stack',
                label: '33" 3-Drawer Base',
                widthIn: 33,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=33" · Height=36"',
              },
              {
                id: 'k-e-pantry-r',
                kind: 'tall_tower',
                label: '36" Appliance Garage Tower',
                widthIn: 36,
                heightIn: 108,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Tall Cabinet-Double Door Pantry.rfa',
                revitParams: 'Width=36" · Top_Datum=108"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Dining Terrace Picture Window',
            clearWidthIn: 180,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'k-s-win',
                kind: 'window',
                label: '96"×72" Terrace Mulled Window',
                widthIn: 96,
                heightIn: 72,
                depthIn: 6,
                affIn: 36,
                revitFamily: 'Window-Casement_Quad_Black.rfa',
                revitParams: 'Width=96" · Sill=36" · Head=108"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Open Portal to Great Room',
            clearWidthIn: 216,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'k-w-open',
                kind: 'door',
                label: '132"×108" Cased Portal',
                widthIn: 132,
                heightIn: 108,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Opening-Cased_WhiteOak_Beam.rfa',
                revitParams: 'Width=132" · Head=108"',
              },
            ],
          },
        ],
      },

      // 3. 117 MASTER BATHROOM — Double Vanity & Wet Room
      {
        id: '117',
        number: '117',
        name: 'Master Bathroom',
        subtitle: '80" Hers White Oak Vanity, 66" Sconces & 120" Steam Glass',
        status: 'approved',
        planRect: { xIn: 0, yIn: 0, widthIn: 198, depthIn: 120 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Moisture-Resistant Gypsum (120" AFF)',
        wallThicknessIn: 6,
        datums: [
          { id: 'd-mb-4', affIn: 4, label: '4" TOE KICK' },
          { id: 'd-mb-36', affIn: 36, label: '36" SLAB COUNTER' },
          { id: 'd-mb-66', affIn: 66, label: '66" MIRROR / SCONCE CL' },
          { id: 'd-mb-90', affIn: 90, label: '90" MIRROR TOP' },
          { id: 'd-mb-120', affIn: 120, label: '120" STEAM GLASS TOP' },
        ],
        planOpenings: [
          {
            id: 'op-mb-west-win',
            wall: 'W',
            offsetIn: 24,
            widthIn: 72,
            kind: 'window',
          },
          {
            id: 'op-mb-south-closet',
            wall: 'S',
            offsetIn: 144,
            widthIn: 36,
            kind: 'door',
            swing: 'in-left',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — 80" Hers Oak Vanity (4" Scribes) & Full-Height Steam Room',
            clearWidthIn: 144,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'mb-n-drw-l',
                kind: 'drawer_stack',
                label: '18" Left 3-Drawer Stack',
                widthIn: 18,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=18" · Depth=22" · Scribe_L=4"',
              },
              {
                id: 'mb-n-sink',
                kind: 'sink_base',
                label: '36" Kathryn Sink + 42×48 Mirror & Sconces',
                widthIn: 36,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                hasMirror: true,
                hasSconces: true,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Sink_Kathryn_Undermount.rfa',
                revitParams: 'Width=36" · Mirror=42×48@66"CL · Slab_Splash=120"',
              },
              {
                id: 'mb-n-drw-r',
                kind: 'drawer_stack',
                label: '18" Right 3-Drawer Stack',
                widthIn: 18,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=18" · Depth=22" · Scribe_R=4"',
              },
              {
                id: 'mb-n-steam',
                kind: 'wet_room_glass',
                label: '64" Steam Wet Room (1/8" Glass to 120")',
                widthIn: 64,
                heightIn: 120,
                depthIn: 48,
                affIn: 0,
                revitFamily: 'Shower_Enclosure-Frameless_Steam_120in.rfa',
                revitParams: 'Glass=1/8" · Height=120" · Bench=18" · Niche=14×50"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — 80" His White Oak Vanity & Closet Door',
            clearWidthIn: 144,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'mb-s-drw-l',
                kind: 'drawer_stack',
                label: '18" 3-Drawer Stack',
                widthIn: 18,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=18" · Depth=22"',
              },
              {
                id: 'mb-s-sink',
                kind: 'sink_base',
                label: '36" Kathryn Sink + Mirror & Sconces',
                widthIn: 36,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                hasMirror: true,
                hasSconces: true,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Sink_Kathryn_Undermount.rfa',
                revitParams: 'Width=36" · Mirror=42×48@66"CL',
              },
              {
                id: 'mb-s-drw-r',
                kind: 'drawer_stack',
                label: '18" 3-Drawer Stack',
                widthIn: 18,
                heightIn: 36,
                depthIn: 22,
                affIn: 0,
                drawerCount: 3,
                fullHeightSplash: true,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=18" · Depth=22"',
              },
              {
                id: 'mb-s-door',
                kind: 'door',
                label: '36"×96" Master Closet Pocket Door',
                widthIn: 36,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Pocket_WhiteOak_36x96.rfa',
                revitParams: 'Width=36" · Height=96"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Clerestory Privacy Window over Soaking Tub',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'mb-w-win',
                kind: 'window',
                label: '72"×36" Frosted Awning Window',
                widthIn: 72,
                heightIn: 36,
                depthIn: 6,
                affIn: 54,
                revitFamily: 'Window-Awning_Frosted_Black.rfa',
                revitParams: 'Width=72" · Sill=54" · Head=90"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Steam Bench Wall & Primary Entry',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'mb-e-door',
                kind: 'door',
                label: '36"×96" Primary Suite Door',
                widthIn: 36,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
                revitParams: 'Width=36" · Height=96"',
              },
            ],
          },
        ],
      },

      // 4. 116 MASTER CLOSET — Hers, His & Island
      {
        id: '116',
        number: '116',
        name: 'Master Closet',
        subtitle: 'Shared 32"/42"/84"/96" Datums, 66" Long Hang & Jewelry Island',
        status: 'draft',
        planRect: { xIn: 0, yIn: 126, widthIn: 198, depthIn: 126 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Flat Drywall w/ Linear LED Wardrobe Cove',
        wallThicknessIn: 6,
        island: {
          widthIn: 60,
          depthIn: 30,
          aisleNorthIn: 42,
          overhangSouthIn: 0,
          stoolsCount: 0,
        },
        datums: [
          { id: 'd-mc-4', affIn: 4, label: '4" TOE KICK' },
          { id: 'd-mc-32', affIn: 32, label: '32" DRAWER TOP' },
          { id: 'd-mc-42', affIn: 42, label: '42" LOWER ROD' },
          { id: 'd-mc-84', affIn: 84, label: '84" DOUBLE-HANG SHELF' },
          { id: 'd-mc-96', affIn: 96, label: '96" UPPER SHELF' },
        ],
        planOpenings: [
          {
            id: 'op-mc-north-bath',
            wall: 'N',
            offsetIn: 150,
            widthIn: 36,
            kind: 'door',
            swing: 'none',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Hers Wardrobe (Double Hang, 4-Drawers, Shoes & 66" Long Hang)',
            clearWidthIn: 168,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'mc-n-dh',
                kind: 'closet_double_hang',
                label: '33" Double-Hang Bay',
                widthIn: 33,
                heightIn: 96,
                depthIn: 16,
                affIn: 0,
                revitFamily: 'Closet_Bay-Double_Hang.rfa',
                revitParams: 'Width=33" · Rods=40"/82" · Top=96"',
              },
              {
                id: 'mc-n-drw1',
                kind: 'closet_drawers',
                label: '30" 4-Drawer + Sweater Shelves',
                widthIn: 30,
                heightIn: 96,
                depthIn: 20,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
                revitParams: 'Width=30" · Drawer_Top=32" · Top=96"',
              },
              {
                id: 'mc-n-shoes',
                kind: 'closet_shelves',
                label: '36" Slanted Shoe & Handbag Tower',
                widthIn: 36,
                heightIn: 96,
                depthIn: 14,
                affIn: 0,
                revitFamily: 'Closet_Bay-Slanted_Shoe_Tower.rfa',
                revitParams: 'Width=36" · Tiers=7 · Top=96"',
              },
              {
                id: 'mc-n-drw2',
                kind: 'closet_drawers',
                label: '30" 4-Drawer + Folded Stack',
                widthIn: 30,
                heightIn: 96,
                depthIn: 20,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
                revitParams: 'Width=30" · Drawer_Top=32" · Top=96"',
              },
              {
                id: 'mc-n-lh',
                kind: 'closet_long_hang',
                label: '33" 66" Long-Hang + Lower Shoes',
                widthIn: 33,
                heightIn: 96,
                depthIn: 16,
                affIn: 0,
                revitFamily: 'Closet_Bay-Long_Hang_66in.rfa',
                revitParams: 'Width=33" · Clear_Hang=66" · Shoe_Tiers=2',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — His Wardrobe Wall & Corner Return Ties',
            clearWidthIn: 168,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'mc-s-dh1',
                kind: 'closet_double_hang',
                label: '36" Double-Hang Suits',
                widthIn: 36,
                heightIn: 96,
                depthIn: 16,
                affIn: 0,
                revitFamily: 'Closet_Bay-Double_Hang.rfa',
                revitParams: 'Width=36" · Corner_Tie_L=16"',
              },
              {
                id: 'mc-s-drw-l',
                kind: 'closet_drawers',
                label: '30" 4-Drawer Bank',
                widthIn: 30,
                heightIn: 96,
                depthIn: 20,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
                revitParams: 'Width=30" · Drawer_Top=32"',
              },
              {
                id: 'mc-s-shoes',
                kind: 'closet_shelves',
                label: '30" Boot & Watch Display',
                widthIn: 30,
                heightIn: 96,
                depthIn: 14,
                affIn: 0,
                revitFamily: 'Closet_Bay-Slanted_Shoe_Tower.rfa',
                revitParams: 'Width=30" · Top=96"',
              },
              {
                id: 'mc-s-drw-r',
                kind: 'closet_drawers',
                label: '30" 4-Drawer Bank',
                widthIn: 30,
                heightIn: 96,
                depthIn: 20,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
                revitParams: 'Width=30" · Drawer_Top=32"',
              },
              {
                id: 'mc-s-dh2',
                kind: 'closet_double_hang',
                label: '36" Double-Hang Shirts',
                widthIn: 36,
                heightIn: 96,
                depthIn: 16,
                affIn: 0,
                revitFamily: 'Closet_Bay-Double_Hang.rfa',
                revitParams: 'Width=36" · Corner_Tie_R=16"',
              },
            ],
          },
          {
            id: 'Island',
            shortLabel: 'Island',
            title: 'Closet Island — 60"×30" Glass-Top Velvet Jewelry Chest',
            clearWidthIn: 60,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'mc-i-l',
                kind: 'drawer_stack',
                label: '30" 4-Drawer Velvet Jewelry Bank',
                widthIn: 30,
                heightIn: 36,
                depthIn: 30,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Island-4Drawer_GlassTop.rfa',
                revitParams: 'Width=30" · Depth=30"',
              },
              {
                id: 'mc-i-r',
                kind: 'drawer_stack',
                label: '30" 4-Drawer Accessory Bank',
                widthIn: 30,
                heightIn: 36,
                depthIn: 30,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Island-4Drawer_GlassTop.rfa',
                revitParams: 'Width=30" · Depth=30"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Full-Height Tri-Fold Dressing Mirror',
            clearWidthIn: 126,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'mc-w-mirror',
                kind: 'closet_shelves',
                label: '48" Valet & Luggage Shelves',
                widthIn: 48,
                heightIn: 96,
                depthIn: 14,
                affIn: 0,
                revitFamily: 'Closet_Bay-Valet_Mirror.rfa',
                revitParams: 'Width=48" · Top=96"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Pocket Entry & Steamer Niche',
            clearWidthIn: 126,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'mc-e-door',
                kind: 'door',
                label: '36"×96" Pocket Entry Door',
                widthIn: 36,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Pocket_WhiteOak_36x96.rfa',
                revitParams: 'Width=36" · Height=96"',
              },
            ],
          },
        ],
      },

      // 5. 104 BATH 2 — Shared Flex Partition Demo (Room A)
      {
        id: '104',
        number: '104',
        name: 'Bath 2',
        subtitle: '60" Symmetric Vanity & Shared Flex Partition w/ Bedroom 4',
        status: 'draft',
        planRect: { xIn: 636, yIn: 0, widthIn: 63, depthIn: 120 },
        flexPlanBinding: {
          flexWallId: 'flex-bed4-bath2',
          role: 'expand_east',
        },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Moisture-Resistant Gypsum',
        wallThicknessIn: 6,
        datums: [
          { id: 'd-b2-4', affIn: 4, label: '4" TOE KICK' },
          { id: 'd-b2-36', affIn: 36, label: '36" COUNTER' },
          { id: 'd-b2-66', affIn: 66, label: '66" MIRROR / SCONCE CL' },
          { id: 'd-b2-90', affIn: 90, label: '90" MIRROR / GLASS TOP' },
        ],
        planOpenings: [
          {
            id: 'op-b2-south-door',
            wall: 'W',
            offsetIn: 44,
            widthIn: 32,
            kind: 'door',
            swing: 'in-left',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — 60" Guest Vanity Alcove (Live Flex Wall Scribes!)',
            clearWidthIn: 63,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            flexBinding: {
              flexWallId: 'flex-bed4-bath2',
              polarity: 1,
            },
            bays: [
              {
                id: 'b2-n-drw-l',
                kind: 'drawer_stack',
                label: '15" Left 3-Drawer Stack',
                widthIn: 15,
                heightIn: 36,
                depthIn: 21,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=15" · Depth=21"',
              },
              {
                id: 'b2-n-sink',
                kind: 'sink_base',
                label: '30" Kathryn Sink + Mirror & Sconces',
                widthIn: 30,
                heightIn: 36,
                depthIn: 21,
                affIn: 0,
                hasMirror: true,
                hasSconces: true,
                fullHeightSplash: false,
                revitFamily: 'Vanity_Sink_Kathryn_Undermount.rfa',
                revitParams: 'Width=30" · Sconces@66"CL',
              },
              {
                id: 'b2-n-drw-r',
                kind: 'drawer_stack',
                label: '15" Right 3-Drawer Stack',
                widthIn: 15,
                heightIn: 36,
                depthIn: 21,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Vanity_Base-3_Drawers_WhiteOak.rfa',
                revitParams: 'Width=15" · Depth=21"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Water Closet & Walk-In Glass Shower (Flex Span)',
            clearWidthIn: 63,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            flexBinding: {
              flexWallId: 'flex-bed4-bath2',
              polarity: 1,
            },
            bays: [
              {
                id: 'b2-s-wc',
                kind: 'toilet_bay',
                label: '31" Water Closet Bay',
                widthIn: 31,
                heightIn: 30,
                depthIn: 28,
                affIn: 0,
                revitFamily: 'Plumbing-WC_Skirted_Kohler.rfa',
                revitParams: 'Clear=31"+Flex · Side_CL≥15.5"',
              },
              {
                id: 'b2-s-shower',
                kind: 'wet_room_glass',
                label: '32" Frameless Alcove Shower',
                widthIn: 32,
                heightIn: 96,
                depthIn: 36,
                affIn: 0,
                revitFamily: 'Shower_Enclosure-Frameless_96in.rfa',
                revitParams: 'Width=32" · Glass_H=96"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E (Flex)',
            title: 'East — Shared Non-Bearing Partition w/ Bedroom 4',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'b2-e-shelves',
                kind: 'floating_shelves',
                label: '24" Towel Floating Oak Shelves (3)',
                widthIn: 24,
                heightIn: 84,
                depthIn: 10,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: false,
                revitFamily: 'Barnhaus_Floating_Oak_Shelf_2in.rfa',
                revitParams: 'Width=24" · Planks=3×2"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Guest Hall Entry Door',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'b2-w-door',
                kind: 'door',
                label: '32"×96" Solid-Core Oak Door',
                widthIn: 32,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
                revitParams: 'Width=32" · Height=96"',
              },
            ],
          },
        ],
      },

      // 6. 103 BEDROOM 4 — Shared Flex Partition Demo (Room B)
      {
        id: '103',
        number: '103',
        name: 'Bedroom 4',
        subtitle: 'Guest Suite Connected via Shared Flex Partition to Bath 2',
        status: 'approved',
        planRect: { xIn: 705, yIn: 0, widthIn: 144, depthIn: 156 },
        flexPlanBinding: {
          flexWallId: 'flex-bed4-bath2',
          role: 'shift_west',
        },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Flat Drywall Ceiling',
        wallThicknessIn: 6,
        datums: [
          { id: 'd-bd4-36', affIn: 36, label: '36" WINDOW SILL' },
          { id: 'd-bd4-84', affIn: 84, label: '84" CLOSET SHELF' },
          { id: 'd-bd4-96', affIn: 96, label: '96" HEAD DATUM' },
        ],
        planOpenings: [
          {
            id: 'op-bd4-north-win',
            wall: 'N',
            offsetIn: 36,
            widthIn: 72,
            kind: 'window',
          },
          {
            id: 'op-bd4-south-door',
            wall: 'S',
            offsetIn: 12,
            widthIn: 34,
            kind: 'door',
            swing: 'in-right',
          },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Headboard Wall & Egress Window (Flex Span)',
            clearWidthIn: 144,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            flexBinding: {
              flexWallId: 'flex-bed4-bath2',
              polarity: -1,
            },
            bays: [
              {
                id: 'bd4-n-ns-l',
                kind: 'drawer_stack',
                label: '28" Left Built-In Nightstand',
                widthIn: 28,
                heightIn: 28,
                depthIn: 20,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Casework-Nightstand_Oak_28in.rfa',
                revitParams: 'Width=28" · Height=28"',
              },
              {
                id: 'bd4-n-win',
                kind: 'window',
                label: '72"×60" Mulled Egress Window',
                widthIn: 72,
                heightIn: 60,
                depthIn: 6,
                affIn: 36,
                revitFamily: 'Window-Casement_Double_Egress.rfa',
                revitParams: 'Width=72" · Sill=36" · Head=96"',
              },
              {
                id: 'bd4-n-ns-r',
                kind: 'drawer_stack',
                label: '28" Right Built-In Nightstand',
                widthIn: 28,
                heightIn: 28,
                depthIn: 20,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Casework-Nightstand_Oak_28in.rfa',
                revitParams: 'Width=28" · Height=28"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Built-In Reach-In Wardrobe & Entry (Flex Span)',
            clearWidthIn: 144,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            flexBinding: {
              flexWallId: 'flex-bed4-bath2',
              polarity: -1,
            },
            bays: [
              {
                id: 'bd4-s-door',
                kind: 'door',
                label: '34"×96" Suite Entry Door',
                widthIn: 34,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
                revitParams: 'Width=34" · Height=96"',
              },
              {
                id: 'bd4-s-dh-l',
                kind: 'closet_double_hang',
                label: '34" Double-Hang Bay',
                widthIn: 34,
                heightIn: 96,
                depthIn: 22,
                affIn: 0,
                revitFamily: 'Closet_Bay-Double_Hang.rfa',
                revitParams: 'Width=34" · Top=96"',
              },
              {
                id: 'bd4-s-drw',
                kind: 'closet_drawers',
                label: '28" 4-Drawer Wardrobe',
                widthIn: 28,
                heightIn: 96,
                depthIn: 22,
                affIn: 0,
                drawerCount: 4,
                revitFamily: 'Closet_Bay-4Drawer_Shelves.rfa',
                revitParams: 'Width=28" · Top=96"',
              },
              {
                id: 'bd4-s-dh-r',
                kind: 'closet_double_hang',
                label: '34" Double-Hang Bay',
                widthIn: 34,
                heightIn: 96,
                depthIn: 22,
                affIn: 0,
                revitFamily: 'Closet_Bay-Double_Hang.rfa',
                revitParams: 'Width=34" · Top=96"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W (Flex)',
            title: 'West — Shared Non-Bearing Partition w/ Bath 2',
            clearWidthIn: 156,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'bd4-w-desk',
                kind: 'floating_shelves',
                label: '48" Study Desk + 3 Oak Shelves',
                widthIn: 48,
                heightIn: 84,
                depthIn: 18,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: true,
                lowerBaseHeightIn: 30,
                revitFamily: 'Barnhaus_Floating_Oak_Shelf_2in.rfa',
                revitParams: 'Width=48" · Planks=3×2"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Exterior Garden Window',
            clearWidthIn: 156,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'bd4-e-win',
                kind: 'window',
                label: '60"×54" East Garden Window',
                widthIn: 60,
                heightIn: 54,
                depthIn: 6,
                affIn: 36,
                revitFamily: 'Window-Casement_Double_Black.rfa',
                revitParams: 'Width=60" · Sill=36"',
              },
            ],
          },
        ],
      },
    ],
  }
}

export function createBarnhausModernSampleMatrix(
  projectName = 'Barnhaus Modern — 2,800 sf Sample',
  projectId = 'barnhaus-modern-2800'
): HouseMatrix {
  return {
    projectId,
    projectName,
    stageLabel: 'Draft 2 · Interior Architecture & Casework',
    flexWalls: {},
    rooms: [
      {
        id: '100',
        number: '100',
        name: 'Living Room',
        subtitle: '12\'-0" Steel-Beam Ceiling, Plaster Hearth & Media Built-Ins',
        status: 'approved',
        planRect: { xIn: 168, yIn: 0, widthIn: 216, depthIn: 192 },
        ceilingHeightIn: 144,
        ceilingLabel: '12\'-0" Flat Gypsum w/ Exposed Steel Ties',
        wallThicknessIn: 6,
        datums: [
          { id: 'bm-l-30', affIn: 30, label: '30" MEDIA CONSOLE' },
          { id: 'bm-l-62', affIn: 62, label: '62" MANTEL' },
          { id: 'bm-l-96', affIn: 96, label: '96" HEAD DATUM' },
        ],
        planOpenings: [
          { id: 'bm-op-1', wall: 'S', offsetIn: 24, widthIn: 168, kind: 'accordion', swing: 'out' },
          { id: 'bm-op-2', wall: 'E', offsetIn: 36, widthIn: 120, kind: 'cased_opening' },
        ],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Modern Plaster Fireplace & Symmetric 48" Oak Built-Ins',
            clearWidthIn: 216,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'bm-gr-l',
                kind: 'floating_shelves',
                label: '48" Oak Base + 3 Floating Shelves',
                widthIn: 48,
                heightIn: 90,
                depthIn: 18,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: true,
                lowerBaseHeightIn: 30,
                revitFamily: 'Barnhaus_Alcove_Base_3OakShelves.rfa',
                revitParams: 'Width=48" · Planks=3×2"',
              },
              {
                id: 'bm-gr-fp',
                kind: 'fireplace_chase',
                label: '112" Architectural Stone & Plaster Chase',
                widthIn: 112,
                heightIn: 144,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Barnhaus_Fireplace_Chase_Assembly.rfa',
                revitParams: 'Chase=112" · Mantel=72×8×6@62"',
              },
              {
                id: 'bm-gr-r',
                kind: 'floating_shelves',
                label: '48" Oak Base + 3 Floating Shelves',
                widthIn: 48,
                heightIn: 90,
                depthIn: 18,
                affIn: 0,
                shelfCount: 3,
                withLowerBase: true,
                lowerBaseHeightIn: 30,
                revitFamily: 'Barnhaus_Alcove_Base_3OakShelves.rfa',
                revitParams: 'Width=48" · Planks=3×2"',
              },
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — 14\'-0" Patio Accordion Glass Wall',
            clearWidthIn: 216,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'bm-gr-s',
                kind: 'accordion_door',
                label: '168"×96" 4-Panel Accordion Glass',
                widthIn: 168,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Accordion_4Panel_Alum.rfa',
                revitParams: 'Width=168" · Head=96"',
              },
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Open Span to Galley Kitchen',
            clearWidthIn: 192,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'bm-gr-e',
                kind: 'door',
                label: '120"×108" Cased Steel Portal',
                widthIn: 120,
                heightIn: 108,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Opening-Cased_WhiteOak_Beam.rfa',
                revitParams: 'Width=120" · Head=108"',
              },
            ],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Primary Hall Entry',
            clearWidthIn: 192,
            ceilingHeightIn: 144,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              {
                id: 'bm-gr-w',
                kind: 'door',
                label: '36"×96" Hallway Door',
                widthIn: 36,
                heightIn: 96,
                depthIn: 6,
                affIn: 0,
                revitFamily: 'Door-Single_Flush_Oak_Cased.rfa',
                revitParams: 'Width=36" · Height=96"',
              },
            ],
          },
        ],
      },
      {
        id: '101',
        number: '101',
        name: 'Galley Kitchen',
        subtitle: '36" Pro Range, 96"×42" Island & 96" Tall Appliance Datum',
        status: 'approved',
        planRect: { xIn: 390, yIn: 0, widthIn: 156, depthIn: 192 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Flat Drywall Ceiling',
        wallThicknessIn: 6,
        island: {
          widthIn: 96,
          depthIn: 42,
          aisleNorthIn: 48,
          overhangSouthIn: 12,
          stoolsCount: 3,
        },
        datums: [
          { id: 'bm-k-4', affIn: 4, label: '4" TOE KICK' },
          { id: 'bm-k-36', affIn: 36, label: '36" COUNTER' },
          { id: 'bm-k-96', affIn: 96, label: '96" TALL DATUM' },
        ],
        planOpenings: [{ id: 'bm-kop-1', wall: 'E', offsetIn: 60, widthIn: 72, kind: 'window' }],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Symmetric 36" Range & 96" Appliance Run',
            clearWidthIn: 156,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              {
                id: 'bm-k-fr',
                kind: 'fridge',
                label: '30" Panel Fridge Tower',
                widthIn: 30,
                heightIn: 96,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Appliance-Panel_Column_Fridge.rfa',
                revitParams: 'Width=30" · Top=96"',
              },
              {
                id: 'bm-k-dl',
                kind: 'drawer_stack',
                label: '27" 3-Drawer Base',
                widthIn: 27,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=27" · Height=36"',
              },
              {
                id: 'bm-k-rng',
                kind: 'range_hood',
                label: '36" Range + 42" Plaster Hood',
                widthIn: 36,
                heightIn: 96,
                depthIn: 26,
                affIn: 0,
                hoodWidthIn: 42,
                revitFamily: 'Range_Pro_36in_With_Hood.rfa',
                revitParams: 'Range=36" · Hood=42" · Top=96"',
              },
              {
                id: 'bm-k-dr',
                kind: 'drawer_stack',
                label: '27" 3-Drawer Base',
                widthIn: 27,
                heightIn: 36,
                depthIn: 24,
                affIn: 0,
                drawerCount: 3,
                revitFamily: 'Base Cabinet-3 Drawers.rfa',
                revitParams: 'Width=27" · Height=36"',
              },
              {
                id: 'bm-k-ov',
                kind: 'tall_oven',
                label: '30" Wall Oven Tower',
                widthIn: 30,
                heightIn: 96,
                depthIn: 24,
                affIn: 0,
                revitFamily: 'Tall Cabinet-Double Oven.rfa',
                revitParams: 'Width=30" · Top=96"',
              },
            ],
          },
          {
            id: 'Island',
            shortLabel: 'Island',
            title: 'Island — 96"×42" Prep & Cleanup Island',
            clearWidthIn: 96,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              createBayFromPreset('drawer_stack', 'bm-ki-1', 24),
              { ...createBayFromPreset('sink_base', 'bm-ki-2', 36), hasMirror: false, hasSconces: false },
              createBayFromPreset('base_doors', 'bm-ki-3', 36),
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Garden Window',
            clearWidthIn: 192,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('window', 'bm-ke-w', 72)],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Dining Glass',
            clearWidthIn: 156,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('window', 'bm-ks-w', 84)],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Open Living Portal',
            clearWidthIn: 192,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('door', 'bm-kw-d', 120)],
          },
        ],
      },
      {
        id: '110',
        number: '110',
        name: 'Primary Bath',
        subtitle: '72" Symmetric Vanity + Walk-In Wet Zone',
        status: 'approved',
        planRect: { xIn: 0, yIn: 0, widthIn: 162, depthIn: 108 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Moisture-Resistant Gypsum',
        wallThicknessIn: 6,
        datums: [
          { id: 'bm-pb-36', affIn: 36, label: '36" COUNTER' },
          { id: 'bm-pb-66', affIn: 66, label: '66" MIRROR / SCONCE CL' },
          { id: 'bm-pb-120', affIn: 120, label: '120" GLASS TOP' },
        ],
        planOpenings: [{ id: 'bm-pb-op', wall: 'W', offsetIn: 30, widthIn: 48, kind: 'window' }],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — 72" Oak Vanity & 60" Walk-In Glass Shower',
            clearWidthIn: 138,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              createBayFromPreset('drawer_stack', 'bm-pb-1', 18),
              createBayFromPreset('sink_base', 'bm-pb-2', 36),
              createBayFromPreset('drawer_stack', 'bm-pb-3', 18),
              createBayFromPreset('wet_room_glass', 'bm-pb-4', 60),
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Entry & Linen Tower',
            clearWidthIn: 138,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              createBayFromPreset('tall_tower', 'bm-pbs-1', 30, 96),
              createBayFromPreset('door', 'bm-pbs-2', 36),
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Shower Bench Wall',
            clearWidthIn: 108,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('door', 'bm-pbe-1', 34)],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Frosted Window',
            clearWidthIn: 108,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('window', 'bm-pbw-1', 48)],
          },
        ],
      },
      {
        id: '111',
        number: '111',
        name: 'Primary Wardrobe',
        subtitle: '96" Datum Double-Hang & 4-Drawer Dressing Wall',
        status: 'draft',
        planRect: { xIn: 0, yIn: 114, widthIn: 162, depthIn: 84 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Flat Drywall',
        wallThicknessIn: 6,
        datums: [
          { id: 'bm-pw-32', affIn: 32, label: '32" DRAWER TOP' },
          { id: 'bm-pw-84', affIn: 84, label: '84" ROD SHELF' },
          { id: 'bm-pw-96', affIn: 96, label: '96" TOP SHELF' },
        ],
        planOpenings: [{ id: 'bm-pw-op', wall: 'N', offsetIn: 114, widthIn: 34, kind: 'door' }],
        walls: [
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Full-Span Wardrobe System',
            clearWidthIn: 150,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              createBayFromPreset('closet_double_hang', 'bm-pw-1', 36, 96),
              createBayFromPreset('closet_drawers', 'bm-pw-2', 30, 96),
              createBayFromPreset('closet_shelves', 'bm-pw-3', 18, 96),
              createBayFromPreset('closet_long_hang', 'bm-pw-4', 30, 96),
              createBayFromPreset('closet_double_hang', 'bm-pw-5', 30, 96),
            ],
          },
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Bath Pocket Door & Valet',
            clearWidthIn: 150,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [
              createBayFromPreset('closet_shelves', 'bm-pwn-1', 42, 96),
              createBayFromPreset('door', 'bm-pwn-2', 34),
            ],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Mirror Wall',
            clearWidthIn: 84,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('closet_drawers', 'bm-pwe-1', 30, 96)],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Exterior Wall',
            clearWidthIn: 84,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('closet_double_hang', 'bm-pww-1', 48, 96)],
          },
        ],
      },
      {
        id: '105',
        number: '105',
        name: 'Mudroom & Drop Zone',
        subtitle: '4 Symmetric Oak Locker Bays & Utility Pantry',
        status: 'draft',
        planRect: { xIn: 552, yIn: 0, widthIn: 132, depthIn: 120 },
        ceilingHeightIn: 120,
        ceilingLabel: '10\'-0" Flat Drywall',
        wallThicknessIn: 6,
        datums: [
          { id: 'bm-md-36', affIn: 36, label: '36" DROP COUNTER' },
          { id: 'bm-md-96', affIn: 96, label: '96" LOCKER TOP' },
        ],
        planOpenings: [{ id: 'bm-md-op', wall: 'S', offsetIn: 48, widthIn: 36, kind: 'door', swing: 'in-left' }],
        walls: [
          {
            id: 'N',
            shortLabel: 'Wall N',
            title: 'North — Symmetric Tall Storage & Drop Zone Run',
            clearWidthIn: 126,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              createBayFromPreset('tall_tower', 'bm-md-1', 30, 96),
              createBayFromPreset('drawer_stack', 'bm-md-2', 30),
              createBayFromPreset('drawer_stack', 'bm-md-3', 30),
              createBayFromPreset('tall_tower', 'bm-md-4', 30, 96),
            ],
          },
          {
            id: 'S',
            shortLabel: 'Wall S',
            title: 'South — Garage Entry Door',
            clearWidthIn: 126,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('door', 'bm-mds-1', 36)],
          },
          {
            id: 'E',
            shortLabel: 'Wall E',
            title: 'East — Exterior Service Wall',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('window', 'bm-mde-1', 48)],
          },
          {
            id: 'W',
            shortLabel: 'Wall W',
            title: 'West — Kitchen Pantry Pass-Through',
            clearWidthIn: 120,
            ceilingHeightIn: 120,
            autoCenter: true,
            isCaseworkWall: false,
            bays: [createBayFromPreset('door', 'bm-mdw-1', 34)],
          },
        ],
      },
    ],
  }
}

export function buildRoomFromTemplate(params: {
  id: string
  number: string
  name: string
  template: RoomTemplateKind
  widthIn: number
  depthIn: number
  ceilingHeightIn: number
  xIn: number
  yIn: number
}): RoomNode {
  const w = Math.max(48, snapHalfInch(params.widthIn))
  const d = Math.max(48, snapHalfInch(params.depthIn))
  const clg = Math.max(96, snapHalfInch(params.ceilingHeightIn))
  const tallDatum = clg >= 144 ? 108 : 96

  let northBays: CaseworkBay[] = []
  let subtitle = 'Custom Architectural Shell · Ready for D2 Layout'
  let island: IslandSpec | undefined
  let datums: DatumLine[] = [
    { id: `d-${params.id}-36`, affIn: 36, label: '36" COUNTER' },
    { id: `d-${params.id}-${tallDatum}`, affIn: tallDatum, label: `${tallDatum}" HEAD DATUM` },
  ]
  let isCaseworkWall = true

  if (params.template === 'living_fireplace') {
    const chaseW = Math.min(112, Math.max(60, snapHalfInch(w * 0.45)))
    const flankW = Math.max(24, snapHalfInch((w - chaseW - 8) / 2))
    const left = createBayFromPreset('floating_shelves', `${params.id}-l`, flankW)
    left.withLowerBase = true
    const chase = createBayFromPreset('fireplace_chase', `${params.id}-fp`, chaseW)
    chase.heightIn = clg
    const right = createBayFromPreset('floating_shelves', `${params.id}-r`, flankW)
    right.withLowerBase = true
    northBays = [left, chase, right]
    subtitle = 'Fireplace Chase & Symmetric Flanking Built-Ins'
    datums = [
      { id: `d-${params.id}-30`, affIn: 30, label: '30" BASE TOP' },
      { id: `d-${params.id}-62`, affIn: 62, label: '62" MANTEL' },
      { id: `d-${params.id}-96`, affIn: 96, label: '96" HEAD DATUM' },
    ]
  } else if (params.template === 'kitchen_island') {
    const rangeW = w >= 168 ? 48 : 36
    const towerW = 30
    const drwW = Math.max(18, snapHalfInch((w - rangeW - towerW * 2 - 8) / 2))
    northBays = [
      createBayFromPreset('fridge', `${params.id}-fr`, towerW, tallDatum),
      createBayFromPreset('drawer_stack', `${params.id}-dl`, drwW),
      createBayFromPreset('range_hood', `${params.id}-rg`, rangeW, tallDatum),
      createBayFromPreset('drawer_stack', `${params.id}-dr`, drwW),
      createBayFromPreset('tall_oven', `${params.id}-ov`, towerW, tallDatum),
    ]
    if (w >= 120 && d >= 144) {
      island = {
        widthIn: Math.min(108, snapHalfInch(w - 72)),
        depthIn: 42,
        aisleNorthIn: 48,
        overhangSouthIn: 12,
        stoolsCount: 3,
      }
    }
    subtitle = 'Cooking Wall, Tall Towers & Prep Island'
  } else if (params.template === 'bathroom_vanity') {
    const isMaster = params.name.toLowerCase().includes('master') || params.name.toLowerCase().includes('primary')
    const hasWetRoom = w >= 138
    const wetW = hasWetRoom ? 60 : 0
    const vanSpan = w - wetW - 3
    if (isMaster || vanSpan >= 84) {
      const sinkW = vanSpan >= 92 ? 24 : 21
      const centerW = 18
      const outerW = Math.max(12, Math.floor((Math.min(96, vanSpan) - sinkW * 2 - centerW) / 2 / 3) * 3)
      northBays = [
        { ...createBayFromPreset('drawer_stack', `${params.id}-vl`, outerW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('sink_base', `${params.id}-vs1`, sinkW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('drawer_stack', `${params.id}-vc`, centerW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('sink_base', `${params.id}-vs2`, sinkW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('drawer_stack', `${params.id}-vr`, outerW), depthIn: 21, fullHeightSplash: false },
        ...(hasWetRoom ? [createBayFromPreset('wet_room_glass', `${params.id}-wet`, wetW, clg)] : []),
      ]
      subtitle = '5-Bay Master Double Vanity · 4" Splash · 96" Mirror Head · 72" Sconces'
    } else {
      const sinkW = vanSpan >= 66 ? 36 : 30
      const drwW = Math.max(12, Math.floor((Math.min(72, vanSpan) - sinkW) / 2 / 3) * 3)
      northBays = [
        { ...createBayFromPreset('drawer_stack', `${params.id}-vl`, drwW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('sink_base', `${params.id}-vs`, sinkW), depthIn: 21, fullHeightSplash: false },
        { ...createBayFromPreset('drawer_stack', `${params.id}-vr`, drwW), depthIn: 21, fullHeightSplash: false },
        ...(hasWetRoom ? [createBayFromPreset('wet_room_glass', `${params.id}-wet`, wetW, clg)] : []),
      ]
      subtitle = 'Symmetric 21" Vanity · 4" Stone Splash · 96" Mirror Head · 72" Sconces'
    }
    datums = [
      { id: `d-${params.id}-36`, affIn: 36, label: '36" STONE COUNTER' },
      { id: `d-${params.id}-40`, affIn: 40, label: '40" SEPARATE 4" SPLASH' },
      { id: `d-${params.id}-72`, affIn: 72, label: '72" LINEAR SCONCE MID' },
      { id: `d-${params.id}-96`, affIn: 96, label: '96" DOOR-HEAD MIRROR TOP' },
    ]
  } else if (params.template === 'walk_in_closet') {
    const bayCount = Math.max(3, Math.min(5, Math.floor((w - 6) / 30)))
    const bayW = snapHalfInch((w - 6) / bayCount)
    northBays = Array.from({ length: bayCount }, (_, idx) => {
      const kind: BayKind =
        idx === Math.floor(bayCount / 2)
          ? 'closet_drawers'
          : idx === bayCount - 1
            ? 'closet_long_hang'
            : 'closet_double_hang'
      return createBayFromPreset(kind, `${params.id}-c${idx}`, bayW, 96)
    })
    subtitle = 'Shared 32"/42"/84"/96" Wardrobe Datums'
    datums = [
      { id: `d-${params.id}-32`, affIn: 32, label: '32" DRAWER TOP' },
      { id: `d-${params.id}-42`, affIn: 42, label: '42" LOWER ROD' },
      { id: `d-${params.id}-84`, affIn: 84, label: '84" DOUBLE-HANG SHELF' },
      { id: `d-${params.id}-96`, affIn: 96, label: '96" UPPER SHELF' },
    ]
  } else if (params.template === 'bedroom_suite') {
    isCaseworkWall = false
    const winW = Math.min(72, snapHalfInch(w * 0.45))
    northBays = [
      createBayFromPreset('drawer_stack', `${params.id}-nsl`, 24),
      createBayFromPreset('window', `${params.id}-win`, winW),
      createBayFromPreset('drawer_stack', `${params.id}-nsr`, 24),
    ]
    subtitle = 'Suite Shell, Fenestration & Wardrobe Wall'
  } else {
    isCaseworkWall = false
    northBays = [createBayFromPreset('window', `${params.id}-win`, Math.min(72, snapHalfInch(w * 0.4)))]
  }

  const walls: WallEdge[] = [
    {
      id: 'N',
      shortLabel: 'Wall N',
      title: `North — ${params.name} Primary Elevation`,
      clearWidthIn: w,
      ceilingHeightIn: clg,
      autoCenter: true,
      isCaseworkWall,
      bays: northBays,
    },
    ...(island
      ? [
          {
            id: 'Island' as const,
            shortLabel: 'Island',
            title: `Center Island — ${formatInchesOnly(island.widthIn)}×${formatInchesOnly(island.depthIn)}`,
            clearWidthIn: island.widthIn,
            ceilingHeightIn: clg,
            autoCenter: true,
            isCaseworkWall: true,
            bays: [
              createBayFromPreset('drawer_stack', `${params.id}-i1`, snapHalfInch((island.widthIn - 36) / 2)),
              { ...createBayFromPreset('sink_base', `${params.id}-i2`, 36), hasMirror: false, hasSconces: false },
              createBayFromPreset('base_doors', `${params.id}-i3`, snapHalfInch((island.widthIn - 36) / 2)),
            ],
          },
        ]
      : []),
    {
      id: 'E',
      shortLabel: 'Wall E',
      title: `East — ${params.name} Side Wall`,
      clearWidthIn: d,
      ceilingHeightIn: clg,
      autoCenter: true,
      isCaseworkWall: false,
      bays: [createBayFromPreset('window', `${params.id}-ew`, Math.min(60, snapHalfInch(d * 0.4)))],
    },
    {
      id: 'S',
      shortLabel: 'Wall S',
      title: `South — ${params.name} Opposite Wall`,
      clearWidthIn: w,
      ceilingHeightIn: clg,
      autoCenter: true,
      isCaseworkWall: false,
      bays: [createBayFromPreset('door', `${params.id}-sd`, 36)],
    },
    {
      id: 'W',
      shortLabel: 'Wall W',
      title: `West — ${params.name} Side Wall`,
      clearWidthIn: d,
      ceilingHeightIn: clg,
      autoCenter: true,
      isCaseworkWall: false,
      bays: [createBayFromPreset('door', `${params.id}-wd`, 36)],
    },
  ]

  return {
    id: params.id,
    number: params.number,
    name: params.name,
    subtitle,
    status: 'draft',
    planRect: {
      xIn: params.xIn,
      yIn: params.yIn,
      widthIn: w,
      depthIn: d,
    },
    ceilingHeightIn: clg,
    ceilingLabel: `${formatArchInches(clg)} Flat Drywall Ceiling`,
    wallThicknessIn: 6,
    island,
    datums,
    planOpenings: [
      { id: `op-${params.id}-s`, wall: 'S', offsetIn: Math.max(12, snapHalfInch(w * 0.2)), widthIn: 36, kind: 'door', swing: 'in-left' },
    ],
    walls,
  }
}

export function createBlankCustomHouseMatrix(
  projectName = 'New Custom Project (Blank Shell)',
  projectId = 'blank-custom-shell'
): HouseMatrix {
  return {
    projectId,
    projectName,
    stageLabel: 'Custom Shell · Pre-Scan Architectural Authoring',
    flexWalls: {},
    rooms: [
      buildRoomFromTemplate({
        id: '100',
        number: '100',
        name: 'Great Room',
        template: 'living_fireplace',
        widthIn: 216,
        depthIn: 192,
        ceilingHeightIn: 144,
        xIn: 0,
        yIn: 0,
      }),
      buildRoomFromTemplate({
        id: '101',
        number: '101',
        name: 'Kitchen',
        template: 'kitchen_island',
        widthIn: 180,
        depthIn: 192,
        ceilingHeightIn: 144,
        xIn: 222,
        yIn: 0,
      }),
    ],
  }
}

export function createInitialHouseMatrix(
  projectName = 'Hill Country Vaulted — 4,200 sf Sample'
): HouseMatrix {
  return createHillCountrySampleMatrix(projectName, 'hill-country-4200')
}

export function createMatrixForProjectSelection(
  optionId: string,
  optionName: string
): HouseMatrix {
  if (optionId === 'sandbox-two-story' || optionId.startsWith('sandbox-two-story')) {
    return structuredClone(SYNATSCHK_TWO_STORY_SANDBOX)
  }
  if (optionId === 'hill-country-4200') {
    return createHillCountrySampleMatrix(optionName, optionId)
  }
  if (optionId === 'barnhaus-modern-2800') {
    return createBarnhausModernSampleMatrix(optionName, optionId)
  }
  if (optionId === 'blank-custom-shell') {
    return createBlankCustomHouseMatrix(optionName, optionId)
  }
  // Real Supabase project or custom named house: initialize a clean custom matrix shell
  return createBlankCustomHouseMatrix(optionName, optionId)
}

export function addCustomRoomToMatrix(
  matrix: HouseMatrix,
  input: {
    number: string
    name: string
    template: RoomTemplateKind
    widthIn: number
    depthIn: number
    ceilingHeightIn: number
  }
): { matrix: HouseMatrix; addedRoomId: string } {
  const maxRight = matrix.rooms.reduce((max, r) => {
    const rect = getEffectiveRoomRect(matrix, r)
    return Math.max(max, rect.xIn + rect.widthIn)
  }, 0)
  const xIn = matrix.rooms.length === 0 ? 0 : maxRight + 6
  const uniqueId = `${input.number}-${matrix.rooms.length + 1}`

  const newRoom = buildRoomFromTemplate({
    id: uniqueId,
    number: input.number.trim() || String(100 + matrix.rooms.length),
    name: input.name.trim() || 'New Room',
    template: input.template,
    widthIn: input.widthIn,
    depthIn: input.depthIn,
    ceilingHeightIn: input.ceilingHeightIn,
    xIn,
    yIn: 0,
  })

  return {
    matrix: {
      ...matrix,
      rooms: [...matrix.rooms, newRoom],
    },
    addedRoomId: newRoom.id,
  }
}

export function updateRoomShellInMatrix(
  matrix: HouseMatrix,
  roomId: string,
  updates: {
    name?: string
    number?: string
    widthIn?: number
    depthIn?: number
    ceilingHeightIn?: number
  }
): HouseMatrix {
  return {
    ...matrix,
    rooms: matrix.rooms.map((room) => {
      if (room.id !== roomId) return room
      const nextW = updates.widthIn ? Math.max(48, snapHalfInch(updates.widthIn)) : room.planRect.widthIn
      const nextD = updates.depthIn ? Math.max(48, snapHalfInch(updates.depthIn)) : room.planRect.depthIn
      const nextClg = updates.ceilingHeightIn
        ? Math.max(96, snapHalfInch(updates.ceilingHeightIn))
        : room.ceilingHeightIn

      return {
        ...room,
        name: updates.name?.trim() || room.name,
        number: updates.number?.trim() || room.number,
        ceilingHeightIn: nextClg,
        ceilingLabel: room.walls[0]?.vaulted
          ? room.ceilingLabel
          : `${formatArchInches(nextClg)} Flat Drywall Ceiling`,
        planRect: {
          ...room.planRect,
          widthIn: nextW,
          depthIn: nextD,
        },
        walls: room.walls.map((w) => {
          if (w.id === 'N' || w.id === 'S') {
            return { ...w, clearWidthIn: nextW, ceilingHeightIn: nextClg }
          }
          if (w.id === 'E' || w.id === 'W') {
            return { ...w, clearWidthIn: nextD, ceilingHeightIn: nextClg }
          }
          return { ...w, ceilingHeightIn: nextClg }
        }),
      }
    }),
  }
}

// Parse either an exported `barnhaus.designer_canvas.v1` JSON or a Revit shell scan JSON
export function parseImportedRevitScanJson(
  rawJson: unknown,
  fallbackName: string
): HouseMatrix | null {
  if (!rawJson || typeof rawJson !== 'object') return null
  const obj = rawJson as Record<string, unknown>

  // Direct HouseMatrix format
  if (Array.isArray(obj.rooms) && obj.rooms.length > 0) {
    const first = obj.rooms[0] as Record<string, unknown>
    if (Array.isArray(first.walls) && first.planRect) {
      return rawJson as HouseMatrix
    }

    // Exported build contract or Revit `project_state.json` / shell scan format
    const projectName =
      (typeof obj.projectName === 'string' && obj.projectName) ||
      (typeof obj.project_name === 'string' && obj.project_name) ||
      fallbackName.replace(/\.json$/i, '')

    let cursorX = 0
    const parsedRooms: RoomNode[] = (obj.rooms as Record<string, unknown>[]).map((r, idx) => {
      const num = String(r.roomNumber ?? r.number ?? 100 + idx)
      const name = String(r.roomName ?? r.name ?? `Room ${num}`)
      const footprint = (r.footprintIn ?? {}) as Record<string, unknown>
      const wIn =
        Number(footprint.widthIn ?? r.width_in ?? (Number(r.width_ft || 14) * 12)) || 168
      const dIn =
        Number(footprint.depthIn ?? r.depth_in ?? (Number(r.depth_ft || 12) * 12)) || 144
      const clgIn =
        Number(r.ceilingHeightIn ?? r.ceiling_in ?? (Number(r.ceiling_ft || 10) * 12)) || 120

      const lower = name.toLowerCase()
      let template: RoomTemplateKind = 'empty_shell'
      if (lower.includes('great') || lower.includes('living') || lower.includes('family')) {
        template = 'living_fireplace'
      } else if (lower.includes('kitchen') || lower.includes('scullery')) {
        template = 'kitchen_island'
      } else if (lower.includes('bath') || lower.includes('powder')) {
        template = 'bathroom_vanity'
      } else if (lower.includes('closet') || lower.includes('wardrobe')) {
        template = 'walk_in_closet'
      } else if (lower.includes('bed') || lower.includes('study')) {
        template = 'bedroom_suite'
      }

      const built = buildRoomFromTemplate({
        id: `scan-${num}-${idx}`,
        number: num,
        name,
        template,
        widthIn: wIn,
        depthIn: dIn,
        ceilingHeightIn: clgIn,
        xIn: Number(footprint.xIn ?? cursorX),
        yIn: Number(footprint.yIn ?? 0),
      })
      cursorX += wIn + 6
      return built
    })

    return {
      projectId: `imported-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      projectName,
      stageLabel: 'Imported Revit Shell Scan · D2 Matrix',
      flexWalls: {},
      rooms: parsedRooms,
    }
  }

  return null
}

