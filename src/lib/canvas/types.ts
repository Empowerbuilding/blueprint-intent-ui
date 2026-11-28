// Designer Canvas — engine contract types.
// Source: Blueprint handoff 2026-11-28 (portal barnhaus-codie-intent-app).
// Engine: canvas_live_server.py (HTTP, port 8787) — see GET /api/state.
//
// PENDING contract asks (flagged in INTENT-CANVAS-TAB-SCOPE.md):
//  #1 RoomCanvasEntry.status / roomVersion — added here as optional fields;
//     engine should populate them so lock badges + write-gating are data-driven.
//  #2 redraw on a frozen room should answer { ok:false, code:"room_frozen" }.

export interface StudioConstraints {
  revitWrites: number
  frozenRoomsProtected: boolean
}

/** A single editable spec control on a room sheet (4-Input Inspector — tab 1). */
export interface EditableSpecField {
  label: string
  type: 'number' | 'select' | 'text'
  value: number | string
  min?: number
  max?: number
  step?: number
  options?: string[]
  unit?: string
  group?: string
}

export interface TranscriptEntry {
  status: 'CONFIRMED' | 'OPEN'
  meeting: string
  topic: string
  quote: string
}

export interface PlanNote {
  note: string
  resolution: string
}

export interface ShellAndNotes {
  dimensions: string
  revitElements: string[]
  planNotes: PlanNote[]
}

export interface KnowledgeBase {
  standardDoc: string
  rules: string[]
  preCommandedRevitCalls: Array<{ call: number; op: string; target: string }>
}

export interface Hotspot {
  id: string
  label: string
  /** Percent coords over the sheet image. */
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  /** Clicking this hotspot focuses this editableSpec key in the inspector. */
  specKey?: string
}

export type RoomStatus = 'frozen' | 'updated' | 'approved' | 'draft'

export interface RoomCanvasEntry {
  id: string
  code: string
  name: string
  category: string
  level: string
  /** 3200x2240 architectural matrix PNG — served by the engine under /sheets/<sheetFile>. */
  sheetFile: string
  /** Approved baseline PNG for the 1-click before/after compare toggle. */
  baselineFile: string
  engine: string
  lastRedrawMs?: number
  lastUpdatedAt?: string
  editableSpec: Record<string, EditableSpecField>
  transcripts: TranscriptEntry[]
  shellAndNotes: ShellAndNotes
  knowledgeBase: KnowledgeBase
  hotspots?: Hotspot[]
  /** Contract v2 (2026-11-28): live on all rooms. */
  status?: RoomStatus
  /** Contract v2: per-room sheet version, e.g. "v23" / "v23-r1". */
  roomVersion?: string
}

export interface TunableSetting {
  key: string
  value: number | string
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface PatternEntry {
  id: string
  name: string
  type: string
  settingsType: string
  title: string
  description: string
  status: string
  mode: string
  /** library_patterns/lib_<id>.png — served under /sheets/. */
  imageFile: string
  wallWidthIn: number
  ceilingIn: number
  referencedKeysCount: number
  tunableSettings: TunableSetting[]
}

export interface PatternLibraryCatalog {
  patternCount: number
  roomSettingsFileCount: number
  totalSettingsKeys: number
  primitiveCount: number
  patterns: PatternEntry[]
  settingsByType: Record<string, Record<string, unknown>>
  primitives: Array<Record<string, unknown>>
}

export interface StudioStateV16 {
  project: string
  subtitle: string
  version: string
  generatedAt: string
  constraints: StudioConstraints
  defaultRoomId: string
  rooms: RoomCanvasEntry[]
  library: PatternLibraryCatalog
}

/** GET /api/health */
export interface EngineHealth {
  ok: boolean
  service: string
  project: string
  port: number
  revitWrites: number
  roomCount: number
  patternCount: number
  settingsKeys: number
  timestamp: string
}

/** POST /api/redraw (success shape) */
export interface RedrawResponse {
  ok: boolean
  roomId: string
  sheetFile: string
  renderMs: number
  updatedRoom: RoomCanvasEntry
}

/** POST /api/redraw-pattern (success shape) */
export interface RedrawPatternResponse {
  ok: boolean
  patternId: string
  imageFile: string
  renderMs: number
  updatedPattern: PatternEntry
}

/** Contract v2: POST /api/rooms/:id/lock — engine-side freeze/unlock. */
export interface RoomLockResponse {
  ok: boolean
  roomId: string
  status: RoomStatus
  room: RoomCanvasEntry
}

/** Contract v2: GET /api/vectors/:roomId — CAD overlay geometry. */
export interface VectorElement {
  id: string
  view: string
  type: string
  label: string
  specKey?: string
  /** SVG path data in the response viewBox (0 0 3200 2240, 1:1 with the sheet). */
  svgPath?: string
  rect?: { x: number; y: number; w: number; h: number }
  pct?: { xPct: number; yPct: number; wPct: number; hPct: number }
  stroke?: string
  fill?: string
  dimensions?: string
}

export interface VectorsResponse {
  ok: boolean
  roomId: string
  roomVersion: string
  status: RoomStatus
  /** e.g. "0 0 3200 2240" — 1:1 with the sheet PNG. */
  viewBox: string
  views: string[]
  elementCount: number
  elements: VectorElement[]
}

export interface EngineError {
  ok: false
  error: string
  code?: string
}

/** Helper — URL-safe path for a sheet served through the Next.js proxy. */
export function sheetProxyUrl(file: string): string {
  const safe = file
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `/api/canvas/sheets/${safe}`
}
