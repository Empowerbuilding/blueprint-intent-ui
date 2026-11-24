export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { DesignerCanvasApp } from '@/components/canvas/DesignerCanvasApp'
import type {
  CadTheme,
  CanvasProjectOption,
  WallDirection,
} from '@/lib/canvas-matrix'

interface CanvasPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const VALID_WALLS: WallDirection[] = ['N', 'E', 'S', 'W', 'Island']

export default async function CanvasPage({ searchParams }: CanvasPageProps) {
  const params = await searchParams
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const isPreview =
    process.env.CANVAS_PREVIEW === '1' ||
    process.env['CANVAS_PREVIEW'] === '1' ||
    !supabaseUrl ||
    !supabaseAnonKey

  let supabaseProjects: CanvasProjectOption[] = []
  if (!isPreview) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('created_at', { ascending: false })
        .limit(30)

      if (Array.isArray(data)) {
        supabaseProjects = data.map((row) => ({
          id: String(row.id),
          name: String(row.name ?? 'Project'),
          kind: 'supabase' as const,
          subtitle: String(row.status ?? 'active'),
        }))
      }
    } catch {
      // Fall back gracefully to built-in architectural presets
    }
  }

  const rawRoom = typeof params.room === 'string' ? params.room : undefined
  const rawWall = typeof params.wall === 'string' ? params.wall : undefined
  const rawTheme = typeof params.theme === 'string' ? params.theme : undefined
  const rawNudge = typeof params.nudge === 'string' ? parseFloat(params.nudge) : undefined

  const initialWallId =
    rawWall && VALID_WALLS.includes(rawWall as WallDirection)
      ? (rawWall as WallDirection)
      : undefined
  const initialTheme: CadTheme = rawTheme === 'blueprint' ? 'blueprint' : 'paper'

  return (
    <DesignerCanvasApp
      supabaseProjects={supabaseProjects}
      initialRoomId={rawRoom}
      initialWallId={initialWallId}
      initialTheme={initialTheme}
      initialNudgeIn={Number.isFinite(rawNudge) ? rawNudge : undefined}
    />
  )
}
