// Project progress — derived from the data, never set by hand.
// One function answers the same three questions everywhere in the app (inbox,
// project list, project page): where is this project, what is done, and what is
// next and who is it waiting on.
//
// Pure: no imports, no I/O.

export type ProgressRoom = {
  id: string
  section_code: string
  name: string
  review_state: string
  needs_2d: boolean | null
}

export type ProgressData = {
  project: { id: string; status: string | null; emitted_version: number | null }
  rooms: ProgressRoom[] // board order
  openQuestions: { room_id: string | null; blocking: boolean }[] // unanswered only
  unassignedImages: number
  outlines: { room_id: string; status: string }[] // superseded excluded
  changesSinceLock: number // decisions / questions / redlines / images added after the last emit
  // What the board of the project's process is made of and whether it has a 2D step (lib/processes.ts).
  // Absent = a room board with a 2D step, as before the field existed.
  shape?: { board: 'rooms' | 'frame'; has2d: boolean }
  // Which step pack the tracker shows (lib/processes.ts flowOf, 2026-11-21). Absent = the shape decides,
  // as before the flows existed: rooms with a 2D step, or frame without.
  //   rooms  — board → review → lock → 2d → build
  //   frame  — board → review → lock → build
  //   lite   — board → review → lock → build → sheets (catalog framing package: generated sheet set)
  //   study  — board → review → lock → generate → package ($99 study set from the plan model)
  flow?: 'rooms' | 'frame' | 'lite' | 'study'
  // Live phase rows from the runner (intent_run_phases), when a run has reported them: the fine-grained
  // "what is it actually doing" under the steps. A 32-phase run is no longer one opaque Build dot.
  phases?: { phase_key: string; state: string }[]
}

export type StepKey = 'board' | 'review' | 'lock' | '2d' | 'build' | 'sheets' | 'generate' | 'package'
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
  sheets: 'Sheets',
  generate: 'Generate',
  package: 'Package',
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
  // the flow picks the step pack; the shape is the pre-flow way of saying the same thing for rooms/frame
  const flow: 'rooms' | 'frame' | 'lite' | 'study' = d.flow || (d.shape?.board === 'frame' ? 'frame' : 'rooms')
  // a frame-line board: the engineer-set process and the lite catalog package both work this way
  const frame = flow === 'frame' || flow === 'lite'
  const has2d = flow === 'rooms' && (d.shape ? d.shape.has2d : true)
  const phaseDone = (key: string) => !!d.phases?.some((p) => p.phase_key === key && p.state === 'done')

  const pendingByRoom = new Map<string, number>()
  const approvedByRoom = new Map<string, number>()
  for (const o of d.outlines) {
    if (o.status === 'pushed') pendingByRoom.set(o.room_id, (pendingByRoom.get(o.room_id) || 0) + 1)
    if (o.status === 'approved') approvedByRoom.set(o.room_id, (approvedByRoom.get(o.room_id) || 0) + 1)
  }

  // "designed" rooms are the ones that go through 2D: typed needs_2d, already
  // 2D-approved, or carrying outlines (rooms typed before the needs_2d column
  // existed). Confirmed rooms with needs_2d=false are built from defaults —
  // they are not drawn and must not pad the denominator.
  const designed = d.rooms.filter(
    (r) =>
      r.needs_2d === true ||
      r.review_state === '2d_approved' ||
      (pendingByRoom.get(r.id) || 0) > 0 ||
      (approvedByRoom.get(r.id) || 0) > 0
  )
  const approved2d = designed.filter((r) => r.review_state === '2d_approved')
  const pendingOutlines = [...pendingByRoom.values()].reduce((a, b) => a + b, 0)
  const firstPendingRoom = d.rooms.find((r) => (pendingByRoom.get(r.id) || 0) > 0)
  const readyFor2d = d.rooms.filter(
    (r) => r.review_state === 'confirmed' && !pendingByRoom.get(r.id) && (approvedByRoom.get(r.id) || 0) > 0
  )

  const done: Record<StepKey, boolean> = {
    board: false,
    review: false,
    lock: false,
    '2d': false,
    build: false,
    sheets: false,
    generate: false,
    package: false,
  }
  done.board = total > 0
  done.review = done.board && unreviewed.length === 0 && blocking.length === 0 && d.unassignedImages === 0
  done.lock = done.review && emitted > 0 && !stale
  done['2d'] = done.lock && (!has2d || approved2d.length === designed.length)
  if (flow === 'lite') {
    // the runner moves the project building → sheets (frame built, sheet set generating) → done
    done.build = done.lock && (status === 'sheets' || status === 'done')
    done.sheets = done.build && status === 'done'
  } else if (flow === 'study') {
    // generation runs in the model copy; packaging is the PDF + voucher for the listing
    done.generate = done.lock && (phaseDone('generate') || status === 'done')
    done.package = done.generate && status === 'done'
  } else {
    done.build = done['2d'] && status === 'done'
  }

  // which steps this process runs (flow picks the pack; has2d only matters for the rooms flow)
  const order: StepKey[] =
    flow === 'study'
      ? ['board', 'review', 'lock', 'generate', 'package']
      : flow === 'lite'
        ? ['board', 'review', 'lock', 'build', 'sheets']
        : has2d
          ? ['board', 'review', 'lock', '2d', 'build']
          : ['board', 'review', 'lock', 'build']
  const current: StepKey | 'done' = order.find((k) => !done[k]) || 'done'

  const reviewBits: string[] = []
  if (total)
    reviewBits.push(
      frame
        ? unreviewed.length
          ? 'frame lines to confirm'
          : 'frame lines confirmed'
        : flow === 'study'
          ? unreviewed.length
            ? 'plan to confirm'
            : 'plan confirmed'
          : total - unreviewed.length + '/' + total + ' rooms reviewed'
    )
  if (blocking.length) reviewBits.push(plural(blocking.length, 'blocking question'))
  if (d.unassignedImages) reviewBits.push(plural(d.unassignedImages, 'unassigned image'))

  const detail: Record<StepKey, string> = {
    board: frame
      ? total
        ? 'frame lines pushed'
        : 'no frame lines yet'
      : flow === 'study'
        ? total
          ? 'plan row pushed'
          : 'no plan row yet'
        : total
          ? plural(total, 'room')
          : 'no rooms yet',
    review: reviewBits.join(' · ') || 'not started',
    lock: emitted ? 'contract v' + emitted + (stale ? ' · out of date' : '') : 'not locked',
    '2d': designed.length
      ? approved2d.length + '/' + designed.length + ' rooms approved'
      : done.lock
        ? 'no rooms need drawings'
        : 'not started',
    build:
      flow === 'lite'
        ? status === 'done' || status === 'sheets'
          ? 'frame complete'
          : status === 'building'
            ? 'in progress — 3D frame'
            : 'not started'
        : status === 'done'
          ? 'complete'
          : status === 'building'
            ? 'in progress'
            : 'not started',
    sheets:
      flow === 'lite'
        ? status === 'done'
          ? 'framing plans · 3D views · takeoff'
          : status === 'sheets'
            ? 'generating — acceptance check'
            : 'after the frame build'
        : '',
    generate: status === 'building'
      ? 'in progress — STUDY sheets in the model copy'
      : phaseDone('generate') || status === 'done'
        ? 'complete'
        : 'not started',
    package: status === 'done' ? 'PDF + voucher — ready for the listing' : 'after generation',
  }

  const steps: Step[] = order.map((k) => ({
    key: k,
    label: STEP_LABEL[k],
    state: done[k] ? 'done' : k === current ? 'current' : 'todo',
    detail: detail[k],
  }))

  let next: NextStep
  if (current === 'board') {
    if (flow === 'lite') {
      next = {
        who: 'blueprint',
        label: 'Waiting on the frame board',
        detail:
          'Blueprint reads the catalog plan model, sizes every member by calculation, then pushes the frame board (one line per member group) for you to confirm. No engineer set involved.',
        href: base,
      }
    } else if (flow === 'study') {
      next = {
        who: 'blueprint',
        label: 'Waiting on the plan row',
        detail:
          'Blueprint pushes one row: the plan and the study-set format version to confirm. No room scan, no decisions, no model changes.',
        href: base,
      }
    } else if (frame) {
      next = {
        who: 'blueprint',
        label: 'Waiting on the frame board',
        detail:
          "Blueprint reads the engineer's set and the open model, then pushes the frame lines (one per member group). This process has no room scan.",
        href: base,
      }
    } else {
      next = {
        who: 'blueprint',
        label: 'Waiting on the room board',
        detail:
          'Blueprint pushes the rooms from the model scan. For a project with no model yet, generate the standard room set.',
        href: base,
      }
    }
  } else if (current === 'review') {
    if (unreviewed.length) {
      if (flow === 'study') {
        next = {
          who: 'you',
          label: 'Confirm the plan',
          detail: 'One row: the plan and the format version. That is the whole review for a study set.',
          href: roomHref(unreviewed[0]!.id, 'decide'),
        }
      } else if (frame) {
        next = {
          who: 'you',
          label: 'Review the frame lines',
          detail: 'Correct or strike lines, then confirm ' + unreviewed[0]!.name + '.',
          href: roomHref(unreviewed[0]!.id, 'decide'),
        }
      } else {
        next = {
          who: 'you',
          label: 'Review ' + plural(unreviewed.length, 'room'),
          detail: 'Next: ' + unreviewed[0]!.section_code + ' ' + unreviewed[0]!.name,
          href: roomHref(unreviewed[0]!.id, 'decide'),
        }
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
          detail: frame
            ? 'The frame lines are confirmed. Locking sends the contract to Blueprint.'
            : flow === 'study'
              ? 'The plan is confirmed. Locking sends the study-set contract to Blueprint.'
              : 'Every room is reviewed. Locking sends the contract to Blueprint.',
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
            detail: flow === 'lite' ? 'Blueprint is building the 3D frame in Revit.' : 'Blueprint is running the work order in Revit.',
            href: base,
          }
        : {
            who: 'you',
            label: 'Give Blueprint the go in chat',
            detail: has2d
              ? 'All 2D is approved. Blueprint compiles the work order; your go in chat starts the build.'
              : 'The contract is locked. Blueprint compiles the work order; your go in chat starts the build.',
            href: base,
          }
  } else if (current === 'sheets') {
    next = {
      who: 'blueprint',
      label: status === 'sheets' ? 'Sheet set in progress' : 'Sheets after the build',
      detail: 'Framing plans, 3D views and the takeoff, then the acceptance check against the pack standard.',
      href: base,
    }
  } else if (current === 'generate') {
    next = {
      who: 'blueprint',
      label: status === 'building' ? 'Generation in progress' : 'Generation next',
      detail:
        'STUDY layouts per level (red room dimensions, SF zone inset), elevations with blue heights, upsell page — generated in the model copy, then the automated diff against the study-set template.',
      href: base,
    }
  } else if (current === 'package') {
    next = {
      who: 'blueprint',
      label: 'Packaging',
      detail: 'PDF assembled and the voucher code attached, ready for the Shopify listing.',
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
