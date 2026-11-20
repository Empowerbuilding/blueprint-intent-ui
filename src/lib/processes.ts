// PROCESSES: the kinds of job a project can follow (table intent_processes). The process picks the stage pack
// Blueprint compiles the work order from. A new process is a row in the table, not a code change.
// (Mitch 2026-11-17: "design intent essentially needs a new process we can choose from so it knows what process
// to follow when setting up the work order".)

export type ProcessRow = {
  key: string
  title: string
  description: string
  status: 'live' | 'draft'
  sort: number
  // What the board of this process is made of and whether it has a 2D drawing step (migration 20261120073600).
  //   rooms = a room board pushed from the model scan (Draft 1 to Draft 2, Draft 2 to Draft 3)
  //   frame = one house-level section of frame lines pushed from the engineer's set: no rooms, no room scan
  // (Mitch 2026-11-20 07:33Z: "for engineerering it shoudlnt have to scan the rooms though why is it in ui")
  board: 'rooms' | 'frame'
  has_2d: boolean
}

export type ProcessShape = { board: 'rooms' | 'frame'; has2d: boolean }

export const DEFAULT_PROCESS = 'd1_to_d2'

// What the pages fall back to when the table cannot be read (before the migration has run, or a read error):
// the one process that has always existed, so no page breaks and no project loses its label.
export const FALLBACK_PROCESSES: ProcessRow[] = [
  { key: 'd1_to_d2', title: 'Draft 1 to Draft 2', description: '', status: 'live', sort: 10, board: 'rooms', has_2d: true },
]

// The shape a process has when the table does not say (a database read before migration 20261120073600 has run):
// the one frame process that exists. Every other process is a room board with a 2D step, as before the columns existed.
const SHAPE_WHEN_NOT_SAID: Record<string, { board: 'rooms' | 'frame'; has_2d: boolean }> = {
  eng_frame: { board: 'frame', has_2d: false },
}

type RawProcess = Omit<ProcessRow, 'board' | 'has_2d'> & { board?: unknown; has_2d?: unknown }

function withShape(r: RawProcess): ProcessRow {
  const fb = SHAPE_WHEN_NOT_SAID[r.key] || { board: 'rooms' as const, has_2d: true }
  return {
    ...r,
    board: r.board === 'frame' || r.board === 'rooms' ? r.board : fb.board,
    has_2d: typeof r.has_2d === 'boolean' ? r.has_2d : fb.has_2d,
  }
}

export function shapeOf(p: ProcessRow): ProcessShape {
  return { board: p.board, has2d: p.has_2d }
}

type Reader = {
  from: (table: string) => { select: (cols: string) => { order: (col: string) => PromiseLike<{ data: unknown; error: unknown }> } }
}

export async function loadProcesses(supabase: unknown): Promise<ProcessRow[]> {
  const read = async (cols: string): Promise<RawProcess[] | null> => {
    try {
      const { data, error } = await (supabase as Reader).from('intent_processes').select(cols).order('sort')
      return error ? null : ((data || []) as RawProcess[])
    } catch {
      return null
    }
  }
  // the shape columns first; a database that does not have them yet is read without them, so no page breaks
  const rows = (await read('key, title, description, status, sort, board, has_2d')) ?? (await read('key, title, description, status, sort'))
  if (!rows || rows.length === 0) return FALLBACK_PROCESSES
  return rows.map(withShape)
}

export function processOf(processes: ProcessRow[], key: string | null | undefined): ProcessRow {
  const k = key || DEFAULT_PROCESS
  return processes.find((p) => p.key === k) || withShape({ key: k, title: k, description: '', status: 'draft', sort: 999 })
}
