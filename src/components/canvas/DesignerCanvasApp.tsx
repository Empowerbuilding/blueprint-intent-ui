'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  addCustomRoomToMatrix,
  applyQuickCommand,
  CANVAS_PROJECT_PRESETS,
  computeWallLayout,
  createBayFromPreset,
  createMatrixForProjectSelection,
  evaluateRoomChecks,
  exportRevitBuildContract,
  formatArchInches,
  formatInchesOnly,
  getEffectiveRoomRect,
  getPresetMeta,
  parseImportedRevitScanJson,
  snapHalfInch,
  symmetrizeWallFlanks,
  updateRoomShellInMatrix,
  updateWallInMatrix,
  type BayKind,
  type CadTheme,
  type CanvasProjectOption,
  type CaseworkBay,
  type HouseMatrix,
  type RoomStatus,
  type StageLayoutMode,
  type WallDirection,
} from '@/lib/canvas-matrix'
import { MiniHousePlan } from './MiniHousePlan'
import { ArchitecturalStageSvg } from './ArchitecturalStageSvg'
import { WholeHouseStageSvg } from './WholeHouseStageSvg'
import { BayInspector } from './BayInspector'
import { ShellModal, type StudioModalMode } from './ShellModal'

type MobileStudioTab = 'house' | 'room' | 'bays'

interface DesignerCanvasAppProps {
  supabaseProjects: CanvasProjectOption[]
  initialRoomId?: string
  initialWallId?: WallDirection
  initialTheme?: CadTheme
  initialNudgeIn?: number
}

const STATUS_DOT: Record<RoomStatus, string> = {
  approved: 'bg-emerald-400',
  draft: 'bg-amber-400',
  needs_review: 'bg-rose-400',
}

export function DesignerCanvasApp({
  supabaseProjects,
  initialRoomId,
  initialWallId,
  initialTheme = 'paper',
  initialNudgeIn,
}: DesignerCanvasAppProps) {
  const [customProjects, setCustomProjects] = useState<CanvasProjectOption[]>([])
  const [projectMatrices, setProjectMatrices] = useState<Record<string, HouseMatrix>>(() => {
    const defaultMatrix = createMatrixForProjectSelection(
      CANVAS_PROJECT_PRESETS[0].id,
      CANVAS_PROJECT_PRESETS[0].name
    )
    if (typeof initialNudgeIn === 'number' && Number.isFinite(initialNudgeIn)) {
      const flexKey = Object.keys(defaultMatrix.flexWalls)[0]
      if (flexKey) {
        defaultMatrix.flexWalls[flexKey] = {
          ...defaultMatrix.flexWalls[flexKey],
          nudgeIn: snapHalfInch(initialNudgeIn),
        }
      }
    }
    return { [CANVAS_PROJECT_PRESETS[0].id]: defaultMatrix }
  })

  const [activeProjectId, setActiveProjectId] = useState<string>(CANVAS_PROJECT_PRESETS[0].id)
  const [undoStack, setUndoStack] = useState<HouseMatrix[]>([])

  const matrix = useMemo(() => {
    return (
      projectMatrices[activeProjectId] ??
      createMatrixForProjectSelection(activeProjectId, 'Custom Project')
    )
  }, [activeProjectId, projectMatrices])

  const [activeRoomId, setActiveRoomId] = useState<string>(() => {
    if (initialRoomId && matrix.rooms.some((r) => r.id === initialRoomId)) {
      return initialRoomId
    }
    return matrix.rooms[0]?.id ?? '100'
  })

  const [activeWallId, setActiveWallId] = useState<WallDirection>(initialWallId ?? 'N')
  const [selectedBayId, setSelectedBayId] = useState<string | null>(() => {
    const rm =
      matrix.rooms.find((r) => r.id === (initialRoomId ?? matrix.rooms[0]?.id)) ??
      matrix.rooms[0]
    const wl = rm?.walls.find((w) => w.id === (initialWallId ?? 'N')) ?? rm?.walls[0]
    return wl?.bays[0]?.id ?? null
  })

  const [theme, setTheme] = useState<CadTheme>(initialTheme)
  const [layoutMode, setLayoutMode] = useState<StageLayoutMode>(
    initialRoomId ? 'split' : 'house'
  )
  const [activeLevel, setActiveLevel] = useState<1 | 2>(1)
  const [mobileTab, setMobileTab] = useState<MobileStudioTab>(
    initialRoomId ? 'room' : 'house'
  )
  const [showDatums, setShowDatums] = useState<boolean>(true)
  const [showDimensions, setShowDimensions] = useState<boolean>(true)
  const [modalMode, setModalMode] = useState<StudioModalMode>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const commitMatrix = useCallback(
    (next: HouseMatrix) => {
      setUndoStack((prev) => [...prev.slice(-19), matrix])
      setProjectMatrices((prev) => ({
        ...prev,
        [activeProjectId]: next,
      }))
    },
    [activeProjectId, matrix]
  )

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setProjectMatrices((prev) => ({
      ...prev,
      [activeProjectId]: previous,
    }))
    setFeedback('Reverted last matrix edit.')
  }, [activeProjectId, undoStack])

  const allProjectOptions = useMemo(
    () => [...customProjects, ...supabaseProjects, ...CANVAS_PROJECT_PRESETS],
    [customProjects, supabaseProjects]
  )

  const handleSwitchProject = (nextId: string) => {
    const opt = allProjectOptions.find((o) => o.id === nextId)
    const existing =
      projectMatrices[nextId] ??
      createMatrixForProjectSelection(nextId, opt?.name ?? 'Custom Residence')
    if (!projectMatrices[nextId]) {
      setProjectMatrices((prev) => ({ ...prev, [nextId]: existing }))
    }
    setActiveProjectId(nextId)
    setUndoStack([])
    setActiveLevel(1)
    setLayoutMode('house')
    setMobileTab('house')
    const firstRoom = existing.rooms.find((r) => (r.level ?? 1) === 1) ?? existing.rooms[0]
    if (firstRoom) {
      setActiveRoomId(firstRoom.id)
      setActiveWallId(firstRoom.walls[0]?.id ?? 'N')
      setSelectedBayId(firstRoom.walls[0]?.bays[0]?.id ?? null)
    }
    setFeedback(`Loaded project "${existing.projectName}".`)
  }

  const handleCreateNewHouse = (name: string, baseTemplateId: string) => {
    const slug = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${customProjects.length + 1}`
    const newMatrix = createMatrixForProjectSelection(baseTemplateId, name)
    newMatrix.projectId = slug
    newMatrix.projectName = name

    const option: CanvasProjectOption = {
      id: slug,
      name,
      kind: 'custom',
      subtitle: 'Custom Studio Matrix',
    }
    setCustomProjects((prev) => [option, ...prev])
    setProjectMatrices((prev) => ({ ...prev, [slug]: newMatrix }))
    setActiveProjectId(slug)
    setUndoStack([])
    const firstRoom = newMatrix.rooms[0]
    if (firstRoom) {
      setActiveRoomId(firstRoom.id)
      setActiveWallId(firstRoom.walls[0]?.id ?? 'N')
      setSelectedBayId(firstRoom.walls[0]?.bays[0]?.id ?? null)
    }
    setFeedback(`Created new custom house "${name}".`)
  }

  const handleImportScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      const imported = parseImportedRevitScanJson(json, file.name)
      if (!imported) {
        setFeedback('Could not parse JSON — expected rooms[] array or Canvas Build JSON.')
        return
      }
      const id = `${imported.projectId}-${customProjects.length + 1}`
      imported.projectId = id
      const option: CanvasProjectOption = {
        id,
        name: imported.projectName,
        kind: 'imported',
        subtitle: `Imported (${imported.rooms.length} rooms)`,
      }
      setCustomProjects((prev) => [option, ...prev])
      setProjectMatrices((prev) => ({ ...prev, [id]: imported }))
      setActiveProjectId(id)
      setUndoStack([])
      if (imported.rooms[0]) {
        setActiveRoomId(imported.rooms[0].id)
        setActiveWallId(imported.rooms[0].walls[0]?.id ?? 'N')
        setSelectedBayId(imported.rooms[0].walls[0]?.bays[0]?.id ?? null)
      }
      setFeedback(`Imported "${imported.projectName}" (${imported.rooms.length} rooms).`)
    } catch {
      setFeedback('Invalid JSON file — verify scan export syntax.')
    }
  }

  const hasMultipleLevels = useMemo(
    () => matrix.rooms.some((r) => r.level === 2),
    [matrix.rooms]
  )

  const visibleLevelRooms = useMemo(
    () =>
      hasMultipleLevels
        ? matrix.rooms.filter((r) => (r.level ?? 1) === activeLevel)
        : matrix.rooms,
    [activeLevel, hasMultipleLevels, matrix.rooms]
  )

  const activeRoom = useMemo(
    () => matrix.rooms.find((r) => r.id === activeRoomId) ?? visibleLevelRooms[0] ?? matrix.rooms[0],
    [activeRoomId, matrix.rooms, visibleLevelRooms]
  )

  const activeWall = useMemo(
    () => activeRoom.walls.find((w) => w.id === activeWallId) ?? activeRoom.walls[0],
    [activeRoom, activeWallId]
  )

  const selectedBay = useMemo(
    () => activeWall.bays.find((b) => b.id === selectedBayId) ?? null,
    [activeWall.bays, selectedBayId]
  )

  const roomChecks = useMemo(
    () => evaluateRoomChecks(matrix, activeRoom, activeWall.id),
    [activeRoom, activeWall.id, matrix]
  )

  // House-wide summary pills
  const houseSummary = useMemo(() => {
    const approved = matrix.rooms.filter((r) => r.status === 'approved').length
    const draft = matrix.rooms.filter((r) => r.status === 'draft').length
    let issueCount = 0
    for (const r of matrix.rooms) {
      const chks = evaluateRoomChecks(matrix, r, r.walls[0].id)
      issueCount += chks.filter((c) => c.status !== 'pass').length
    }
    return { total: matrix.rooms.length, approved, draft, issueCount }
  }, [matrix])

  const handleSelectLevel = (lvl: 1 | 2) => {
    setActiveLevel(lvl)
    const lvlRoom = matrix.rooms.find((r) => (r.level ?? 1) === lvl)
    if (lvlRoom) {
      setActiveRoomId(lvlRoom.id)
      const w0 = lvlRoom.walls.find((w) => w.bays.length > 0) ?? lvlRoom.walls[0]
      setActiveWallId(w0.id)
      setSelectedBayId(w0.bays[0]?.id ?? null)
    }
  }

  const handleSelectRoom = (roomId: string) => {
    const nextRoom = matrix.rooms.find((r) => r.id === roomId)
    if (!nextRoom) return
    if (nextRoom.level && nextRoom.level !== activeLevel) {
      setActiveLevel(nextRoom.level)
    }
    setActiveRoomId(roomId)
    const nextWall = nextRoom.walls.find((w) => w.bays.length > 0) ?? nextRoom.walls[0]
    setActiveWallId(nextWall.id)
    setSelectedBayId(nextWall.bays[0]?.id ?? null)
  }

  const handleEnterRoomStudio = (roomId: string) => {
    handleSelectRoom(roomId)
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 1024
    setLayoutMode(isNarrow ? 'elevation' : 'split')
    setMobileTab('room')
  }

  const handleSelectWall = (wallId: WallDirection) => {
    setActiveWallId(wallId)
    const w = activeRoom.walls.find((item) => item.id === wallId)
    setSelectedBayId(w?.bays[0]?.id ?? null)
  }

  // Bay CRUD operations
  const handleUpdateBay = (bayId: string, patch: Partial<CaseworkBay>) => {
    const nextWall = {
      ...activeWall,
      bays: activeWall.bays.map((b) => (b.id === bayId ? { ...b, ...patch } : b)),
    }
    commitMatrix(updateWallInMatrix(matrix, activeRoom.id, activeWall.id, nextWall))
  }

  const handleChangeBayKind = (bayId: string, kind: BayKind) => {
    const preset = getPresetMeta(kind)
    const topDatum = activeRoom.datums.find((d) => d.affIn >= 96)?.affIn
    const templateBay = createBayFromPreset(kind, bayId, undefined, topDatum)
    handleUpdateBay(bayId, {
      kind,
      heightIn: templateBay.heightIn,
      depthIn: templateBay.depthIn,
      affIn: templateBay.affIn,
      drawerCount: templateBay.drawerCount,
      shelfCount: templateBay.shelfCount,
      withLowerBase: templateBay.withLowerBase,
      hasMirror: templateBay.hasMirror,
      hasSconces: templateBay.hasSconces,
      fullHeightSplash: templateBay.fullHeightSplash,
      revitFamily: preset.revitFamily,
      revitParams: preset.revitParams,
      label: `${formatInchesOnly(selectedBay?.widthIn ?? preset.defaultWidthIn)} ${preset.label}`,
    })
  }

  const handleMoveBay = (bayId: string, dir: -1 | 1) => {
    const idx = activeWall.bays.findIndex((b) => b.id === bayId)
    const targetIdx = idx + dir
    if (idx < 0 || targetIdx < 0 || targetIdx >= activeWall.bays.length) return
    const copy = [...activeWall.bays]
    const [item] = copy.splice(idx, 1)
    copy.splice(targetIdx, 0, item)
    commitMatrix(
      updateWallInMatrix(matrix, activeRoom.id, activeWall.id, { ...activeWall, bays: copy })
    )
  }

  const handleDuplicateBay = (bayId: string) => {
    const idx = activeWall.bays.findIndex((b) => b.id === bayId)
    if (idx < 0) return
    const orig = activeWall.bays[idx]
    const dup: CaseworkBay = {
      ...orig,
      id: `${orig.id}-copy-${activeWall.bays.length + 1}`,
    }
    const copy = [...activeWall.bays]
    copy.splice(idx + 1, 0, dup)
    commitMatrix(
      updateWallInMatrix(matrix, activeRoom.id, activeWall.id, { ...activeWall, bays: copy })
    )
    setSelectedBayId(dup.id)
  }

  const handleDeleteBay = (bayId: string) => {
    if (activeWall.bays.length <= 1) return
    const nextBays = activeWall.bays.filter((b) => b.id !== bayId)
    commitMatrix(
      updateWallInMatrix(matrix, activeRoom.id, activeWall.id, {
        ...activeWall,
        bays: nextBays,
      })
    )
    setSelectedBayId(nextBays[0]?.id ?? null)
  }

  const handleAddBay = (kind: BayKind) => {
    const topDatum = activeRoom.datums.find((d) => d.affIn >= 96)?.affIn
    const created = createBayFromPreset(
      kind,
      `${activeRoom.id}-${activeWall.id}-${activeWall.bays.length + 1}`,
      undefined,
      topDatum
    )
    commitMatrix(
      updateWallInMatrix(matrix, activeRoom.id, activeWall.id, {
        ...activeWall,
        bays: [...activeWall.bays, created],
      })
    )
    setSelectedBayId(created.id)
  }

  const handleSymmetrize = () => {
    const clearW = computeWallLayout(matrix, activeWall).clearWidthIn
    const nextWall = symmetrizeWallFlanks(activeWall, clearW)
    commitMatrix(updateWallInMatrix(matrix, activeRoom.id, activeWall.id, nextWall))
    setFeedback(`Symmetrized flanking bays on ${activeWall.shortLabel}.`)
  }

  const handleChangeRoomStatus = (status: RoomStatus) => {
    commitMatrix({
      ...matrix,
      rooms: matrix.rooms.map((r) => (r.id === activeRoom.id ? { ...r, status } : r)),
    })
  }

  const handleRunQuickCommand = (command: string) => {
    const res = applyQuickCommand(
      matrix,
      activeRoom.id,
      activeWall.id,
      selectedBayId,
      command
    )
    commitMatrix(res.matrix)
    setSelectedBayId(res.selectedBayId)
    setFeedback(res.message)
  }

  // Shared Flex Partition Nudge
  const activeFlexWall = useMemo(() => {
    const flexId =
      activeWall.flexBinding?.flexWallId ??
      activeRoom.flexPlanBinding?.flexWallId ??
      null
    if (flexId && matrix.flexWalls[flexId]) return matrix.flexWalls[flexId]
    const allFlex = Object.values(matrix.flexWalls)
    return allFlex[0] ?? null
  }, [activeRoom.flexPlanBinding?.flexWallId, activeWall.flexBinding?.flexWallId, matrix.flexWalls])

  const handleNudgeFlexWallById = (flexWallId: string, deltaIn: number) => {
    const target = matrix.flexWalls[flexWallId]
    if (!target) return
    const nextNudge = Math.max(
      -target.maxNudgeIn,
      Math.min(target.maxNudgeIn, snapHalfInch(target.nudgeIn + deltaIn))
    )
    commitMatrix({
      ...matrix,
      flexWalls: {
        ...matrix.flexWalls,
        [flexWallId]: {
          ...target,
          nudgeIn: nextNudge,
        },
      },
    })
    setFeedback(
      `Partition nudged to ${nextNudge > 0 ? '+' : ''}${formatInchesOnly(nextNudge)} — both rooms & scribes updated.`
    )
  }

  const handleNudgeFlexWall = (deltaIn: number) => {
    if (!activeFlexWall) return
    handleNudgeFlexWallById(activeFlexWall.id, deltaIn)
  }

  // Export Clean Revit Build JSON & Vector Linework SVG
  const handleExportJson = () => {
    const contract = exportRevitBuildContract(matrix)
    const blob = new Blob([JSON.stringify(contract, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${matrix.projectId}-revit-build.json`
    a.click()
    URL.revokeObjectURL(url)
    setFeedback('Exported Revit Build Contract JSON.')
  }

  const handleExportSvg = () => {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const serialized = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${matrix.projectId}-${activeRoom.number}-${activeWall.id}.svg`
    a.click()
    URL.revokeObjectURL(url)
    setFeedback(`Exported crisp vector SVG (${activeRoom.number} ${activeWall.shortLabel}).`)
  }

  const isActiveRoomOnFlex = Boolean(activeRoom.flexPlanBinding || activeWall.flexBinding)

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-4rem)] lg:overflow-hidden bg-bh-black text-slate-200">
      {/* Hidden File Input for Importing Revit Shell Scan / Matrix JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportScanFile}
        className="hidden"
      />

      {/* ================================================================= */}
      {/* TOP STUDIO BAR — Universal Project Switcher, Shell Actions, Theme */}
      {/* ================================================================= */}
      <div className="border-b border-bh-border bg-bh-panel px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Title + Universal Project Switcher + New House + Import Scan */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-gold shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
              Barnhaus Design Canvas
            </h1>
          </div>

          <select
            aria-label="Select Project"
            data-testid="project-switcher"
            value={activeProjectId}
            onChange={(e) => handleSwitchProject(e.target.value)}
            className="rounded-lg border border-bh-border bg-bh-black px-2.5 py-1.5 text-xs font-medium text-white focus:border-gold focus:outline-none max-w-[270px]"
          >
            {customProjects.length > 0 && (
              <optgroup label="Session / Imported Houses">
                {customProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {supabaseProjects.length > 0 && (
              <optgroup label="Design Intent Projects">
                {supabaseProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Architectural Templates & Samples">
              {CANVAS_PROJECT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Multi-Story Floor Switcher (L1 / L2) */}
          {hasMultipleLevels && (
            <div
              className="inline-flex rounded-lg border border-gold/50 bg-bh-black p-0.5 text-xs"
              role="tablist"
              aria-label="Floor Level Switcher"
            >
              {([1, 2] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`top-floor-btn-${lvl}`}
                  onClick={() => handleSelectLevel(lvl)}
                  className={
                    'rounded-md px-2.5 py-1 font-semibold transition-colors ' +
                    (activeLevel === lvl
                      ? 'bg-gold text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white')
                  }
                >
                  L{lvl}
                </button>
              ))}
            </div>
          )}

          {/* Front-and-Center Whole House Floor Plan Quick Button */}
          <button
            type="button"
            data-testid="btn-whole-house-center"
            onClick={() => {
              if (layoutMode === 'house') {
                setLayoutMode('split')
                setMobileTab('room')
              } else {
                setLayoutMode('house')
                setMobileTab('house')
              }
            }}
            className={
              'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ' +
              (layoutMode === 'house'
                ? 'border-gold bg-gold text-slate-950 shadow-sm'
                : 'border-gold/50 bg-gold/10 text-gold-light hover:bg-gold/20')
            }
          >
            {layoutMode === 'house' ? 'Whole House Plan (Active)' : 'Whole House Plan'}
          </button>

          <button
            type="button"
            data-testid="btn-new-house"
            onClick={() => setModalMode('new_house')}
            className="hidden sm:inline-flex rounded-lg border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors whitespace-nowrap"
          >
            + New House
          </button>

          <button
            type="button"
            data-testid="btn-import-scan"
            onClick={() => fileInputRef.current?.click()}
            className="hidden md:inline-flex btn-secondary-sm"
            title="Import Revit room scan JSON or Canvas Build JSON"
          >
            Import Revit Scan (.json)
          </button>

          {/* House Summary Pills */}
          <div className="hidden xl:flex items-center gap-1.5 pl-1">
            <span className="pill pill-neutral">{houseSummary.total} Rooms</span>
            <span className="pill pill-gold">
              {houseSummary.approved} Approved / {houseSummary.draft} Draft
            </span>
            <span className={`pill ${houseSummary.issueCount === 0 ? 'pill-green' : 'pill-gold'}`}>
              {houseSummary.issueCount === 0
                ? 'Checks: All Passing'
                : `Checks: ${houseSummary.issueCount} Flagged`}
            </span>
          </div>
        </div>

        {/* Right: CAD Theme, Datums, Dimensions, Undo & Export */}
        <div className="flex flex-wrap items-center gap-1.5">
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="btn-secondary-sm"
              title="Undo last edit"
            >
              ↶ Undo
            </button>
          )}

          {/* CAD Paper vs Dark Blueprint Toggle */}
          <button
            type="button"
            data-testid="toggle-theme"
            onClick={() => setTheme((t) => (t === 'paper' ? 'blueprint' : 'paper'))}
            className="rounded-lg border border-bh-border bg-bh-card px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors"
          >
            CAD: {theme === 'paper' ? 'Architectural Paper' : 'Dark Blueprint'}
          </button>

          <button
            type="button"
            data-testid="toggle-datums"
            onClick={() => setShowDatums((v) => !v)}
            className={
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ' +
              (showDatums
                ? 'border-sky-700/70 bg-sky-950/50 text-sky-300'
                : 'border-bh-border bg-bh-card text-slate-400')
            }
          >
            Datums {showDatums ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            data-testid="toggle-dims"
            onClick={() => setShowDimensions((v) => !v)}
            className={
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ' +
              (showDimensions
                ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-300'
                : 'border-bh-border bg-bh-card text-slate-400')
            }
          >
            Dims {showDimensions ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            data-testid="btn-export-json"
            onClick={handleExportJson}
            className="btn-secondary-sm"
          >
            Export Build JSON
          </button>

          <button
            type="button"
            data-testid="btn-export-svg"
            onClick={handleExportSvg}
            className="btn-primary-sm"
          >
            Export Linework SVG
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOBILE TOUCH TAB BAR (< 1024px Phone & Tablet)                    */}
      {/* ================================================================= */}
      <div className="lg:hidden grid grid-cols-3 gap-1 border-b border-bh-border bg-bh-black px-3 py-1.5 shrink-0">
        <button
          type="button"
          data-testid="mobile-tab-house"
          onClick={() => {
            setMobileTab('house')
            setLayoutMode('house')
          }}
          className={
            'min-h-[40px] rounded-lg text-xs font-semibold transition-colors ' +
            (mobileTab === 'house'
              ? 'bg-gold text-slate-950 shadow-sm'
              : 'bg-bh-panel text-slate-300 border border-bh-border')
          }
        >
          House Plan {hasMultipleLevels ? `(L${activeLevel})` : ''}
        </button>
        <button
          type="button"
          data-testid="mobile-tab-room"
          onClick={() => {
            setMobileTab('room')
            if (layoutMode === 'house') setLayoutMode('elevation')
          }}
          className={
            'min-h-[40px] rounded-lg text-xs font-semibold transition-colors truncate px-1.5 ' +
            (mobileTab === 'room'
              ? 'bg-gold text-slate-950 shadow-sm'
              : 'bg-bh-panel text-slate-300 border border-bh-border')
          }
        >
          Room: {activeRoom.number} {activeRoom.name}
        </button>
        <button
          type="button"
          data-testid="mobile-tab-bays"
          onClick={() => setMobileTab('bays')}
          className={
            'min-h-[40px] rounded-lg text-xs font-semibold transition-colors ' +
            (mobileTab === 'bays'
              ? 'bg-gold text-slate-950 shadow-sm'
              : 'bg-bh-panel text-slate-300 border border-bh-border')
          }
        >
          Bays &amp; List ({visibleLevelRooms.length})
        </button>
      </div>

      {/* ================================================================= */}
      {/* 3-PANE STUDIO BODY (Responsive Desktop 3-Col / Mobile Full-Pane)  */}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* LEFT PANE (280px Desktop; shown inside 'Bays & List' tab on Mobile): Mini-Plan, Room List & Flex Wall */}
        <aside
          className={
            (mobileTab === 'bays' ? 'flex ' : 'hidden lg:flex ') +
            'w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r border-bh-border bg-bh-panel flex-col min-h-0'
          }
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Interactive Whole-House Mini-Floorplan */}
            <MiniHousePlan
              matrix={matrix}
              activeLevel={activeLevel}
              hasMultipleLevels={hasMultipleLevels}
              activeRoomId={activeRoom.id}
              onSelectRoom={handleSelectRoom}
              onDoubleClickRoom={handleEnterRoomStudio}
              onOpenWholeHouse={() => {
                setLayoutMode('house')
                setMobileTab('house')
              }}
            />

            {/* Room List + Add Room / Edit Shell Action */}
            <div>
              <div className="flex items-center justify-between px-0.5 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {hasMultipleLevels ? `L${activeLevel} Rooms (${visibleLevelRooms.length})` : `Rooms (${visibleLevelRooms.length})`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="btn-add-room"
                    onClick={() => setModalMode('add_room')}
                    className="rounded border border-bh-border bg-bh-black px-2 py-0.5 text-[10px] font-semibold text-gold-light hover:border-gold transition-colors"
                  >
                    + Add Room / Edit Shell
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {visibleLevelRooms.map((rm) => {
                  const isActive = rm.id === activeRoom.id
                  const rect = getEffectiveRoomRect(matrix, rm)
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      data-testid={`room-item-${rm.id}`}
                      onClick={() => handleSelectRoom(rm.id)}
                      onDoubleClick={() => handleEnterRoomStudio(rm.id)}
                      className={
                        'w-full text-left rounded-lg border px-2.5 py-2 transition-colors ' +
                        (isActive
                          ? 'border-sky-500/70 bg-sky-950/25 text-white'
                          : 'border-bh-border bg-bh-card/60 text-slate-300 hover:border-slate-500 hover:text-white')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[rm.status]}`} />
                          <span className="font-mono text-xs text-slate-400">{rm.number}</span>
                          <span className="text-xs font-semibold truncate">{rm.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {formatArchInches(rect.widthIn)}×{formatArchInches(rect.depthIn)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                        {rm.subtitle}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Shared Interior Flex Wall Nudge Panel */}
            {activeFlexWall && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                    Shared Flex Partition
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-amber-200">
                    {activeFlexWall.nudgeIn > 0 ? '+' : ''}
                    {formatInchesOnly(activeFlexWall.nudgeIn)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug">
                  {activeFlexWall.label} (max ±{activeFlexWall.maxNudgeIn}&quot;)
                </p>

                <div className="grid grid-cols-4 gap-1">
                  {([-1, -0.5, 0.5, 1] as const).map((step) => (
                    <button
                      key={step}
                      type="button"
                      data-testid={`flex-nudge-${step}`}
                      onClick={() => {
                        if (!isActiveRoomOnFlex) {
                          handleSelectRoom(activeFlexWall.roomAId)
                        }
                        handleNudgeFlexWall(step)
                      }}
                      className="rounded border border-amber-700/60 bg-bh-black py-1 text-[11px] font-mono text-amber-200 hover:bg-amber-900/40 transition-colors"
                    >
                      {step > 0 ? `+${step}"` : `${step}"`}
                    </button>
                  ))}
                </div>

                {/* Live Adjacent Room Impact Readout */}
                {(() => {
                  const roomA = matrix.rooms.find((r) => r.id === activeFlexWall.roomAId)
                  const roomB = matrix.rooms.find((r) => r.id === activeFlexWall.roomBId)
                  if (!roomA || !roomB) return null
                  const rectA = getEffectiveRoomRect(matrix, roomA)
                  const rectB = getEffectiveRoomRect(matrix, roomB)
                  const bathWall = roomA.walls[0]
                  const bathLayout = computeWallLayout(matrix, bathWall)
                  return (
                    <div className="rounded bg-bh-black/80 px-2 py-1.5 text-[10px] font-mono text-slate-300 space-y-0.5">
                      <div className="flex justify-between">
                        <span>
                          {roomA.number} {roomA.name}:
                        </span>
                        <span className="text-emerald-300">
                          {formatArchInches(rectA.widthIn)} ({formatInchesOnly(bathLayout.leftScribeIn)} scribes)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          {roomB.number} {roomB.name}:
                        </span>
                        <span className="text-sky-300">{formatArchInches(rectB.widthIn)} clear</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER STAGE (Flex-1): Either Front-and-Center Whole-House Plan OR Room Studio */}
        <div
          className={
            (mobileTab === 'house' || mobileTab === 'room' ? 'flex ' : 'hidden lg:flex ') +
            'flex-1 flex-col min-w-0 min-h-[68dvh] lg:min-h-0'
          }
        >
          {layoutMode === 'house' ? (
            <WholeHouseStageSvg
              matrix={matrix}
              activeLevel={activeLevel}
              hasMultipleLevels={hasMultipleLevels}
              activeRoomId={activeRoom.id}
              theme={theme}
              layoutMode={layoutMode}
              showDimensions={showDimensions}
              onSelectLevel={handleSelectLevel}
              onSelectRoom={handleSelectRoom}
              onEnterRoomStudio={handleEnterRoomStudio}
              onChangeLayoutMode={(nextMode) => {
                setLayoutMode(nextMode)
                if (nextMode !== 'house') setMobileTab('room')
              }}
              onNudgeFlexWall={handleNudgeFlexWallById}
              svgRef={svgRef}
            />
          ) : (
            <ArchitecturalStageSvg
              matrix={matrix}
              room={activeRoom}
              wall={activeWall}
              theme={theme}
              layoutMode={layoutMode}
              showDatums={showDatums}
              showDimensions={showDimensions}
              selectedBayId={selectedBayId}
              onSelectBay={setSelectedBayId}
              onChangeWall={handleSelectWall}
              onChangeLayoutMode={(nextMode) => {
                setLayoutMode(nextMode)
                if (nextMode === 'house') setMobileTab('house')
              }}
              svgRef={svgRef}
            />
          )}
        </div>

        {/* RIGHT PANE (320px Desktop; shown inside 'Bays & List' tab on Mobile): Parametric Bay Inspector */}
        <div className={mobileTab === 'bays' ? 'block w-full lg:w-auto' : 'hidden lg:block'}>
          <BayInspector
            room={activeRoom}
            wall={activeWall}
            selectedBay={selectedBay}
            checks={roomChecks}
            lastCommandFeedback={feedback}
            onSelectBay={setSelectedBayId}
            onUpdateBay={handleUpdateBay}
            onChangeBayKind={handleChangeBayKind}
            onMoveBay={handleMoveBay}
            onDuplicateBay={handleDuplicateBay}
            onDeleteBay={handleDeleteBay}
            onAddBay={handleAddBay}
            onSymmetrizeWall={handleSymmetrize}
            onChangeRoomStatus={handleChangeRoomStatus}
            onRunQuickCommand={handleRunQuickCommand}
          />
        </div>
      </div>

      {/* Add Room / Edit Shell / New House Modal */}
      {modalMode && (
        <ShellModal
          mode={modalMode}
          activeRoom={activeRoom}
          nextRoomNumber={String(100 + matrix.rooms.length + 1)}
          onClose={() => setModalMode(null)}
          onCreateHouse={handleCreateNewHouse}
          onAddRoom={(input) => {
            const { matrix: next, addedRoomId } = addCustomRoomToMatrix(matrix, input)
            commitMatrix(next)
            setActiveRoomId(addedRoomId)
            const added = next.rooms.find((r) => r.id === addedRoomId)
            setActiveWallId(added?.walls[0]?.id ?? 'N')
            setSelectedBayId(added?.walls[0]?.bays[0]?.id ?? null)
            setFeedback(`Added room ${input.number} ${input.name} to house matrix.`)
          }}
          onUpdateShell={(roomId, updates) => {
            const next = updateRoomShellInMatrix(matrix, roomId, updates)
            commitMatrix(next)
            setFeedback(`Updated room shell (${updates.number} ${updates.name}).`)
          }}
        />
      )}
    </div>
  )
}
