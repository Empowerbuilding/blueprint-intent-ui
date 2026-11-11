// Project progress — derived from the data, never set by hand.
// One function answers the same three questions everywhere in the app (inbox,
// project list, project page): where is this project, what is done, and what
// is next and who is it waiting on.
//
// Pure: no imports, no I/O.

export type ProgressRoom = { id: string; section_code: string; name: string; review_state: string }

export type ProgressData = {
  project: { id: string; status: string | null; emitted_version: number | null }
  rooms: ProgressRoom[] // board order
  openQuestions: { room_id: string | null; blocking: boolean }[] // unanswered only
  unassignedImages: number
  outlines: { room_id: string; status: string }[] // superseded excluded
  changesSinceLock: number // decisions / questions / redlines / images added after the last emit
}

export type StepKey = 'board' | 'review' | 'lock' | '2d' | 'build'
export type Step = { key: StepKey; label: string; state: 'done' | 'current' | 'todo'; detail: string }
export type NextStep = { who: 'you' | 'blueprint' | 'nobody'; label: string; detail: string; href: string }

export type Progress = {
  steps: Step[]
  current: StepKey | 'done'
  currentLabel: string
  next: NextStep
  stale: boolean // contract emitted, then intent changed
  counts: {
    rooms: number
    unreviewed: number
    blockingQuestions: number
    unassignedImages: number
    pendingOutlines: number
    designedRooms: number
    approved2d: number
    roomsReadyFor2d: number
  }
}

const STEP_LABEL: Record<StepKey, string> = {
  board: 'Board',
  review: 'Review',
  lock: 'Lock',
  '2d': '2D',
  build: 'Build',
}

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many)

export function projectProgress(d: ProgressData): Progress {
  const base = '/projects/' + d.project.id
  const roomHref = (roomId: string, view: 'decide' | '2d') => base + '/rooms/' + roomId + '?view=' + view

  const total = d.rooms.length
  const unreviewed = d.rooms.filter((r) => r.review_state === 'unreviewed')
  const blocking = d.openQuestions.filter((q) => q.blocking)
  const emitted = d.project.emitted_version || 0
  const stale = emitted > 0 && d.changesSinceLock > 0
  const status = d.project.status || ''

  // "designed" rooms are the ones that go through 2D: confirmed or already 2D-approved.
  // Rooms built from defaults are not drawn.
  const designed = d.rooms.filter((r) => r.review_state === 'confirmed' || r.review_state === '2d_approved')
  const approved2d = designed.filter((r) => r.review_state === '2d_approved')

  const pendingByRoom = new Map<string, number>()
  const approvedByRoom = new Map<string, number>()
  for (const o of d.outlines) {
    if (o.status === 'pushed') pendingByRoom.set(o.room_id, (pendingByRoom.get(o.room_id) || 0) + 1)
    if (o.status === 'approved') approvedByRoom.set(o.room_id, (approvedByRoom.get(o.room_id) || 0) + 1)
  }
  const pendingOutlines = [...pendingByRoom.values()].reduce((a, b) => a + b, 0)
  const firstPendingRoom = d.rooms.find((r) => (pendingByRoom.get(r.id) || 0) > 0)
  const readyFor2d = d.rooms.filter(
    (r) => r.review_state === 'confirmed' && !pendingByRoom.get(r.id) && (approvedByRoom.get(r.id) || 0) > 0
  )

  const done: Record<StepKey, boolean> = {
    board: total > 0,
    review: false,
    lock: false,
    '2d': false,
    build: false,
  }
  done.review = done.board && unreviewed.length === 0 && blocking.length === 0 && d.unassignedImages === 0
  done.lock = done.review && emitted > 0 && !stale
  done['2d'] = done.lock && approved2d.length === designed.length
  done.build = done['2d'] && status === 'done'

  const order: StepKey[] = ['board', 'review', 'lock', '2d', 'build']
  const current: StepKey | 'done' = order.find((k) => !done[k]) || 'done'

  const reviewBits: string[] = []
  if (total) reviewBits.push(total - unreviewed.length + '/' + total + ' rooms reviewed')
  if (blocking.length) reviewBits.push(plural(blocking.length, 'blocking question'))
  if (d.unassignedImages) reviewBits.push(plural(d.unassignedImages, 'unassigned image'))

  const detail: Record<StepKey, string> = {
    board: total ? plural(total, 'room') : 'no rooms yet',
    review: reviewBits.join(' · ') || 'not started',
    lock: emitted ? 'contract v' + emitted + (stale ? ' · out of date' : '') : 'not locked',
    '2d': designed.length
      ? approved2d.length + '/' + designed.length + ' rooms approved'
      : done.lock
        ? 'no rooms need drawings'
        : 'not started',
    build: status === 'done' ? 'complete' : status === 'building' ? 'in progress' : 'not started',
  }

  const steps: Step[] = order.map((k) => ({
    key: k,
    label: STEP_LABEL[k],
    state: done[k] ? 'done' : k === current ? 'current' : 'todo',
    detail: detail[k],
  }))

  let next: NextStep
  if (current === 'board') {
    next = {
      who: 'blueprint',
      label: 'Waiting on the room board',
      detail:
        'Blueprint pushes the rooms from the model scan. For a project with no model yet, generate the standard room set.',
      href: base,
    }
  } else if (current === 'review') {
    if (unreviewed.length) {
      next = {
        who: 'you',
        label: 'Review ' + plural(unreviewed.length, 'room'),
        detail: 'Next: ' + unreviewed[0]!.section_code + ' ' + unreviewed[0]!.name,
        href: roomHref(unreviewed[0]!.id, 'decide'),
      }
    } else if (blocking.length) {
      const roomId = blocking[0]!.room_id
      next = {
        who: 'you',
        label: 'Answer ' + plural(blocking.length, 'blocking question'),
        detail: 'Blocking questions must be answered before the contract can be locked.',
        href: roomId ? roomHref(roomId, 'decide') + '#questions' : base,
      }
    } else {
      next = {
        who: 'you',
        label: 'Assign ' + plural(d.unassignedImages, 'image'),
        detail: 'Every inspo image is assigned to a room or parked before the contract can be locked.',
        href: base + '/images',
      }
    }
  } else if (current === 'lock') {
    next = stale
      ? {
          who: 'you',
          label: 'Re-emit the contract (v' + (emitted + 1) + ')',
          detail:
            plural(d.changesSinceLock, 'change') +
            ' since v' +
            emitted +
            ' was locked. Blueprint is still working from v' +
            emitted +
            '.',
          href: base + '/emit',
        }
      : {
          who: 'you',
          label: emitted ? 'Re-emit the contract (v' + (emitted + 1) + ')' : 'Lock & Emit',
          detail: 'Every room is reviewed. Locking sends the contract to Blueprint.',
          href: base + '/emit',
        }
  } else if (current === '2d') {
    if (firstPendingRoom) {
      next = {
        who: 'you',
        label: 'Review ' + plural(pendingOutlines, '2D outline'),
        detail: 'Next: ' + firstPendingRoom.section_code + ' ' + firstPendingRoom.name,
        href: roomHref(firstPendingRoom.id, '2d'),
      }
    } else if (readyFor2d.length) {
      next = {
        who: 'you',
        label: 'Mark ' + plural(readyFor2d.length, 'room') + ' 2D approved',
        detail: 'Every outline in ' + readyFor2d[0]!.section_code + ' ' + readyFor2d[0]!.name + ' has been reviewed.',
        href: roomHref(readyFor2d[0]!.id, '2d'),
      }
    } else {
      next = {
        who: 'blueprint',
        label: 'Waiting on Blueprint to draft 2D',
        detail: plural(designed.length - approved2d.length, 'room') + ' still to draw or redraw.',
        href: base,
      }
    }
  } else if (current === 'build') {
    next =
      status === 'building'
        ? {
            who: 'blueprint',
            label: 'Build in progress',
            detail: 'Blueprint is running the work order in Revit.',
            href: base,
          }
        : {
            who: 'you',
            label: 'Give Blueprint the go in chat',
            detail: 'All 2D is approved. Blueprint compiles the work order; your go in chat starts the build.',
            href: base,
          }
  } else {
    next = { who: 'nobody', label: 'Complete', detail: 'Nothing left to do on this project.', href: base }
  }

  return {
    steps,
    current,
    currentLabel: current === 'done' ? 'Done' : STEP_LABEL[current],
    next,
    stale,
    counts: {
      rooms: total,
      unreviewed: unreviewed.length,
      blockingQuestions: blocking.length,
      unassignedImages: d.unassignedImages,
      pendingOutlines,
      designedRooms: designed.length,
      approved2d: approved2d.length,
      roomsReadyFor2d: readyFor2d.length,
    },
  }
}
