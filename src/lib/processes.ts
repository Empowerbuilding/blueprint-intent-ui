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
}

export const DEFAULT_PROCESS = 'd1_to_d2'

// What the pages fall back to when the table cannot be read (before the migration has run, or a read error):
// the one process that has always existed, so no page breaks and no project loses its label.
export const FALLBACK_PROCESSES: ProcessRow[] = [
  { key: 'd1_to_d2', title: 'Draft 1 to Draft 2', description: '', status: 'live', sort: 10 },
]

type Reader = {
  from: (table: string) => { select: (cols: string) => { order: (col: string) => PromiseLike<{ data: unknown; error: unknown }> } }
}

export async function loadProcesses(supabase: unknown): Promise<ProcessRow[]> {
  try {
    const { data, error } = await (supabase as Reader).from('intent_processes').select('key, title, description, status, sort').order('sort')
    const rows = (data || []) as ProcessRow[]
    if (error || rows.length === 0) return FALLBACK_PROCESSES
    return rows
  } catch {
    return FALLBACK_PROCESSES
  }
}

export function processOf(processes: ProcessRow[], key: string | null | undefined): ProcessRow {
  const k = key || DEFAULT_PROCESS
  return processes.find((p) => p.key === k) || { key: k, title: k, description: '', status: 'draft', sort: 999 }
}
