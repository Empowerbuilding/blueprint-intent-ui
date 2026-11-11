// One loader for "where is every project" — used by the Inbox, the project
// list and the project page so they can never disagree.
// Queries run in parallel; joins happen in memory (same pattern as the pages).

import { createClient } from '@/lib/supabase/server'
import { projectProgress, type Progress } from '@/lib/progress'

export type ProjectRow = {
  id: string
  name: string
  client: string | null
  status: string | null
  emitted_version: number | null
  created_at: string
}
export type RoomRow = {
  id: string
  project_id: string
  section_code: string
  name: string
  review_state: string
  area_sf: number | null
  source: string | null
}
export type QuestionRow = {
  id: string
  project_id: string
  room_id: string | null
  question: string
  default_if_unanswered: string | null
  blocking: boolean
}
export type OutlineRow = {
  id: string
  project_id: string
  room_id: string
  outline_type: string
  label: string | null
  status: string
  pushed_at: string
  checks: Record<string, unknown> | null
}

export type ProjectOverview = {
  project: ProjectRow
  rooms: RoomRow[]
  openQuestions: QuestionRow[] // unanswered
  outlines: OutlineRow[] // superseded excluded
  unassignedImages: number
  emittedAt: string | null
  changesSinceLock: number
  progress: Progress
}

type Stamp = { project_id: string; created_at: string; status_changed_at?: string | null }

export async function loadOverview(projectId?: string): Promise<ProjectOverview[]> {
  const supabase = await createClient()
  // each query is narrowed to one project when projectId is given
  let projectsQ = supabase.from('intent_projects').select('id, name, client, status, emitted_version, created_at')
  let roomsQ = supabase
    .from('intent_rooms')
    .select('id, project_id, section_code, name, review_state, area_sf, source')
  let questionsQ = supabase
    .from('intent_open_questions')
    .select('id, project_id, room_id, question, default_if_unanswered, blocking')
    .is('answer', null)
  let imagesQ = supabase.from('intent_inspo_images').select('project_id, room_id, parked, assigned_at')
  let outlinesQ = supabase
    .from('intent_outlines')
    .select('id, project_id, room_id, outline_type, label, status, pushed_at, checks')
    .neq('status', 'superseded')
  let emissionsQ = supabase.from('intent_emissions').select('project_id, version, emitted_at')
  if (projectId) {
    projectsQ = projectsQ.eq('id', projectId)
    roomsQ = roomsQ.eq('project_id', projectId)
    questionsQ = questionsQ.eq('project_id', projectId)
    imagesQ = imagesQ.eq('project_id', projectId)
    outlinesQ = outlinesQ.eq('project_id', projectId)
    emissionsQ = emissionsQ.eq('project_id', projectId)
  }

  const [projectsRes, roomsRes, questionsRes, imagesRes, outlinesRes, emissionsRes] = await Promise.all([
    projectsQ.order('created_at', { ascending: false }),
    roomsQ.order('sort_order'),
    questionsQ.order('created_at'),
    imagesQ,
    outlinesQ.order('pushed_at'),
    emissionsQ.order('version', { ascending: false }),
  ])

  const projects = (projectsRes.data || []) as ProjectRow[]
  const rooms = (roomsRes.data || []) as RoomRow[]
  const questions = (questionsRes.data || []) as QuestionRow[]
  const images = (imagesRes.data || []) as {
    project_id: string
    room_id: string | null
    parked: boolean
    assigned_at: string | null
  }[]
  const outlines = (outlinesRes.data || []) as OutlineRow[]
  const emissions = (emissionsRes.data || []) as { project_id: string; version: number; emitted_at: string }[]

  // latest emission per project (rows arrive newest version first)
  const emittedAt = new Map<string, string>()
  for (const e of emissions) if (!emittedAt.has(e.project_id)) emittedAt.set(e.project_id, e.emitted_at)

  // "changed since lock": anything added to the intent after the last emit.
  // Only fetched for projects that have been emitted.
  const emittedIds = [...emittedAt.keys()]
  const changes = new Map<string, number>()
  if (emittedIds.length) {
    const [dec, ques, red] = await Promise.all([
      supabase.from('intent_decisions').select('project_id, created_at, status_changed_at').in('project_id', emittedIds),
      supabase.from('intent_open_questions').select('project_id, created_at').in('project_id', emittedIds),
      supabase.from('intent_redline_notes').select('project_id, created_at').in('project_id', emittedIds),
    ])
    const stamps = [...((dec.data || []) as Stamp[]), ...((ques.data || []) as Stamp[]), ...((red.data || []) as Stamp[])]
    for (const s of stamps) {
      const at = emittedAt.get(s.project_id)
      // a decision line removed or put back by hand after the lock counts too (status_changed_at)
      if (at && (s.created_at > at || (s.status_changed_at && s.status_changed_at > at)))
        changes.set(s.project_id, (changes.get(s.project_id) || 0) + 1)
    }
    for (const i of images) {
      const at = emittedAt.get(i.project_id)
      if (at && i.assigned_at && i.assigned_at > at) changes.set(i.project_id, (changes.get(i.project_id) || 0) + 1)
    }
  }

  return projects.map((project) => {
    const pRooms = rooms.filter((r) => r.project_id === project.id)
    const pQuestions = questions.filter((q) => q.project_id === project.id)
    const pOutlines = outlines.filter((o) => o.project_id === project.id)
    const unassignedImages = images.filter((i) => i.project_id === project.id && !i.room_id && !i.parked).length
    const changesSinceLock = changes.get(project.id) || 0
    return {
      project,
      rooms: pRooms,
      openQuestions: pQuestions,
      outlines: pOutlines,
      unassignedImages,
      emittedAt: emittedAt.get(project.id) || null,
      changesSinceLock,
      progress: projectProgress({
        project,
        rooms: pRooms,
        openQuestions: pQuestions,
        unassignedImages,
        outlines: pOutlines,
        changesSinceLock,
      }),
    }
  })
}
