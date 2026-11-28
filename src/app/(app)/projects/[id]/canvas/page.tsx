// DESIGNER CANVAS — project-scoped route (/projects/<id>/canvas).
// Same studio, anchored to this project's context label.

export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CanvasStudio } from '@/components/canvas/live/CanvasStudio'

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('intent_projects')
    .select('id, name')
    .eq('id', id)
    .single()
  if (!data) notFound()

  return <CanvasStudio projectLabel={String(data.name)} />
}
