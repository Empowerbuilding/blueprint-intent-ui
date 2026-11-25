'use client'

import React, { useMemo, useRef, useState } from 'react'
import {
  formatArchInches,
  formatInchesOnly,
  getEffectiveRoomRect,
  type CadTheme,
  type FlexWallSpec,
  type HouseMatrix,
  type RoomNode,
  type StageLayoutMode,
} from '@/lib/canvas-matrix'

interface WholeHouseStageSvgProps {
  matrix: HouseMatrix
  activeLevel: 1 | 2
  hasMultipleLevels: boolean
  activeRoomId: string
  theme: CadTheme
  layoutMode: StageLayoutMode
  showDimensions: boolean
  onSelectLevel: (lvl: 1 | 2) => void
  onSelectRoom: (roomId: string) => void
  onEnterRoomStudio: (roomId: string) => void
  onChangeLayoutMode: (mode: StageLayoutMode) => void
  onNudgeFlexWall: (flexWallId: string, deltaIn: number) => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

export function WholeHouseStageSvg({
  matrix,
  activeLevel,
  hasMultipleLevels,
  activeRoomId,
  theme,
  layoutMode,
  showDimensions,
  onSelectLevel,
  onSelectRoom,
  onEnterRoomStudio,
  onChangeLayoutMode,
  onNudgeFlexWall,
  svgRef,
}: WholeHouseStageSvgProps) {
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false,
    sx: 0,
    sy: 0,
    px: 0,
    py: 0,
  })

  const levelRooms = useMemo(
    () =>
      matrix.rooms.filter((r) =>
        hasMultipleLevels ? (r.level ?? 1) === activeLevel : true
      ),
    [activeLevel, hasMultipleLevels, matrix.rooms]
  )

  const outdoorZones = useMemo(
    () =>
      (matrix.outdoorZones ?? []).filter((z) =>
        hasMultipleLevels ? z.level === activeLevel : true
      ),
    [activeLevel, hasMultipleLevels, matrix.outdoorZones]
  )

  const voidZones = useMemo(
    () =>
      (matrix.voidZones ?? []).filter((z) =>
        hasMultipleLevels ? z.level === activeLevel : true
      ),
    [activeLevel, hasMultipleLevels, matrix.voidZones]
  )

  const levelFlexWalls = useMemo(
    () =>
      Object.values(matrix.flexWalls).filter((fw) =>
        hasMultipleLevels ? (fw.level ?? 1) === activeLevel : true
      ),
    [activeLevel, hasMultipleLevels, matrix.flexWalls]
  )

  const roomRects = useMemo(
    () =>
      levelRooms.map((room) => ({
        room,
        rect: getEffectiveRoomRect(matrix, room),
      })),
    [levelRooms, matrix]
  )

  const selectedRoomObj = useMemo(
    () => roomRects.find((item) => item.room.id === activeRoomId) ?? roomRects[0] ?? null,
    [activeRoomId, roomRects]
  )

  const selectedRoomFlex: FlexWallSpec | null = useMemo(() => {
    if (!selectedRoomObj) return null
    const rm = selectedRoomObj.room
    const directId = rm.flexPlanBinding?.flexWallId
    if (directId && matrix.flexWalls[directId]) return matrix.flexWalls[directId]
    return (
      levelFlexWalls.find((fw) => fw.roomAId === rm.id || fw.roomBId === rm.id) ?? null
    )
  }, [levelFlexWalls, matrix.flexWalls, selectedRoomObj])

  // Compute full floorplan bounding box (conditioned + outdoor + void)
  const bounds = useMemo(() => {
    const allRects = [
      ...roomRects.map((r) => r.rect),
      ...outdoorZones,
      ...voidZones,
    ]
    if (allRects.length === 0) {
      return { vbX: -60, vbY: -60, vbW: 800, vbH: 560 }
    }
    const minX = Math.min(...allRects.map((r) => r.xIn))
    const minY = Math.min(...allRects.map((r) => r.yIn))
    const maxX = Math.max(...allRects.map((r) => r.xIn + r.widthIn))
    const maxY = Math.max(...allRects.map((r) => r.yIn + r.depthIn))
    const pad = 48
    return {
      vbX: minX - pad,
      vbY: minY - pad,
      vbW: Math.max(360, maxX - minX + pad * 2),
      vbH: Math.max(260, maxY - minY + pad * 2),
    }
  }, [outdoorZones, roomRects, voidZones])

  const isPaper = theme === 'paper'
  const cBg = isPaper ? '#f7f5ef' : '#0b1220'
  const cGridMinor = isPaper ? 'rgba(15,23,42,0.04)' : 'rgba(148,163,184,0.05)'
  const cGridMajor = isPaper ? 'rgba(15,23,42,0.09)' : 'rgba(148,163,184,0.11)'
  const cWallStroke = isPaper ? '#0f172a' : '#e2e8f0'
  const cRoomFill = isPaper ? '#ffffff' : '#132036'
  const cActiveFill = isPaper ? 'rgba(218, 165, 32, 0.16)' : 'rgba(218, 165, 32, 0.24)'
  const cActiveStroke = '#f59e0b'
  const cTextMain = isPaper ? '#0f172a' : '#f8fafc'
  const cTextSub = isPaper ? '#475569' : '#94a3b8'
  const cOutdoorFill = isPaper ? 'rgba(226,232,240,0.45)' : 'rgba(30,41,59,0.45)'
  const cOutdoorStroke = isPaper ? '#94a3b8' : '#475569'
  const cFlex = isPaper ? '#0284c7' : '#00e0ff'

  const zoomedVbW = bounds.vbW / zoom
  const zoomedVbH = bounds.vbH / zoom
  const zoomedVbX = bounds.vbX + (bounds.vbW - zoomedVbW) / 2 - pan.x
  const zoomedVbY = bounds.vbY + (bounds.vbH - zoomedVbH) / 2 - pan.y

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-bh-black relative overflow-hidden">
      {/* Stage Top Toolbar: Floor Switcher + Stage Mode Switcher + Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bh-border bg-bh-panel px-3 py-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gold-light uppercase tracking-wider">
            Whole-House Interactive Floor Plan
          </span>

          {hasMultipleLevels && (
            <div
              className="inline-flex rounded-lg border border-gold/40 bg-bh-black p-0.5 text-xs"
              role="tablist"
              aria-label="Floor Switcher"
            >
              {([1, 2] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  data-testid={`stage-floor-btn-${lvl}`}
                  onClick={() => {
                    onSelectLevel(lvl)
                    setPan({ x: 0, y: 0 })
                  }}
                  className={
                    'rounded-md px-2.5 py-1 font-semibold transition-colors ' +
                    (activeLevel === lvl
                      ? 'bg-gold text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white')
                  }
                >
                  {lvl === 1 ? 'L1 · Main Floor' : 'L2 · Upper Floor'}
                </button>
              ))}
            </div>
          )}

          <span className="hidden sm:inline text-[11px] text-slate-400">
            Click room to select · Double-click (or tap Open Room) to edit walls &amp; casework
          </span>
        </div>

        {/* Right: Mode Switcher + Zoom */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-bh-border bg-bh-black p-0.5 text-[11px]">
            {(
              [
                { id: 'house', label: 'Whole House' },
                { id: 'split', label: 'Split: Elev + Plan' },
                { id: 'elevation', label: 'Elevation' },
                { id: 'plan', label: 'Room Plan' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`layout-mode-${m.id}`}
                onClick={() => onChangeLayoutMode(m.id)}
                className={
                  'rounded-md px-2 py-1 transition-colors whitespace-nowrap ' +
                  (layoutMode === m.id
                    ? 'bg-gold text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white')
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-lg border border-bh-border bg-bh-card text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.2).toFixed(2)))}
              className="px-2 py-1 hover:text-white"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              className="border-x border-bh-border px-2 py-1 font-mono text-[10px] hover:text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.2).toFixed(2)))}
              className="px-2 py-1 hover:text-white"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Floor Plan Canvas */}
      <div
        className="flex-1 relative min-h-[340px] cursor-grab active:cursor-grabbing select-none"
        style={{ background: cBg }}
        onWheel={(e) => {
          e.preventDefault()
          const delta = e.deltaY < 0 ? 0.12 : -0.12
          setZoom((z) => Math.max(0.65, Math.min(3.0, +(z + delta).toFixed(2))))
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-room-interactive="true"]')) return
          dragRef.current = {
            active: true,
            sx: e.clientX,
            sy: e.clientY,
            px: pan.x,
            py: pan.y,
          }
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return
          const dx = ((e.clientX - dragRef.current.sx) * (bounds.vbW / 900)) / zoom
          const dy = ((e.clientY - dragRef.current.sy) * (bounds.vbH / 650)) / zoom
          setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy })
        }}
        onPointerUp={() => {
          dragRef.current.active = false
        }}
        onPointerCancel={() => {
          dragRef.current.active = false
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${zoomedVbX} ${zoomedVbY} ${zoomedVbW} ${zoomedVbH}`}
          className="w-full h-full block"
          role="img"
          aria-label={`Whole House Floor Plan — Level ${activeLevel}`}
        >
          <defs>
            <pattern id="wh-grid-12" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke={cGridMinor} strokeWidth="0.6" />
            </pattern>
            <pattern id="wh-grid-60" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="url(#wh-grid-12)" />
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke={cGridMajor} strokeWidth="1.1" />
            </pattern>
          </defs>

          <rect
            x={bounds.vbX - 600}
            y={bounds.vbY - 600}
            width={bounds.vbW + 1200}
            height={bounds.vbH + 1200}
            fill="url(#wh-grid-60)"
          />

          {/* Outdoor Covered Patios / Carport / Balcony */}
          {outdoorZones.map((oz) => (
            <g key={oz.id}>
              <rect
                x={oz.xIn}
                y={oz.yIn}
                width={oz.widthIn}
                height={oz.depthIn}
                fill={cOutdoorFill}
                stroke={cOutdoorStroke}
                strokeWidth="2.2"
                strokeDasharray="10 7"
              />
              <text
                x={oz.xIn + oz.widthIn / 2}
                y={oz.yIn + oz.depthIn / 2 - 4}
                textAnchor="middle"
                fill={cTextSub}
                fontSize="13"
                fontWeight="600"
                letterSpacing="1.6"
              >
                {oz.label}
              </text>
              {showDimensions && (
                <text
                  x={oz.xIn + oz.widthIn / 2}
                  y={oz.yIn + oz.depthIn / 2 + 13}
                  textAnchor="middle"
                  fill={cTextSub}
                  fontSize="10.5"
                  fontFamily="ui-monospace, monospace"
                >
                  {formatArchInches(oz.widthIn)} × {formatArchInches(oz.depthIn)}
                </text>
              )}
            </g>
          ))}

          {/* Open-to-Below Double-Height Voids on Level 2 */}
          {voidZones.map((vz) => (
            <g key={vz.id}>
              <rect
                x={vz.xIn}
                y={vz.yIn}
                width={vz.widthIn}
                height={vz.depthIn}
                fill={isPaper ? 'rgba(15,23,42,0.03)' : 'rgba(8,14,26,0.75)'}
                stroke={cOutdoorStroke}
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <line
                x1={vz.xIn}
                y1={vz.yIn}
                x2={vz.xIn + vz.widthIn}
                y2={vz.yIn + vz.depthIn}
                stroke={cOutdoorStroke}
                strokeWidth="1.2"
                strokeOpacity="0.55"
              />
              <line
                x1={vz.xIn + vz.widthIn}
                y1={vz.yIn}
                x2={vz.xIn}
                y2={vz.yIn + vz.depthIn}
                stroke={cOutdoorStroke}
                strokeWidth="1.2"
                strokeOpacity="0.55"
              />
              <text
                x={vz.xIn + vz.widthIn / 2}
                y={vz.yIn + vz.depthIn / 2}
                textAnchor="middle"
                fill={cTextSub}
                fontSize="12"
                fontWeight="600"
                letterSpacing="1.4"
              >
                {vz.label}
              </text>
            </g>
          ))}

          {/* Conditioned Rooms — Single-Click Selects, Double-Click Opens Room Studio */}
          {roomRects.map(({ room, rect }) => {
            const isSelected = room.id === activeRoomId
            const cx = rect.xIn + rect.widthIn / 2
            const cy = rect.yIn + rect.depthIn / 2
            const sf = Math.round((rect.widthIn * rect.depthIn) / 144)
            const totalBays = room.walls.reduce((sum, w) => sum + w.bays.length, 0)
            const compact = rect.widthIn < 90 || rect.depthIn < 66

            return (
              <g
                key={room.id}
                data-room-interactive="true"
                data-testid={`wh-room-${room.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectRoom(room.id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onEnterRoomStudio(room.id)
                }}
                className="cursor-pointer group"
              >
                <rect
                  x={rect.xIn}
                  y={rect.yIn}
                  width={rect.widthIn}
                  height={rect.depthIn}
                  fill={isSelected ? cActiveFill : cRoomFill}
                  stroke={isSelected ? cActiveStroke : cWallStroke}
                  strokeWidth={isSelected ? 5 : 3.2}
                />

                {/* Kitchen Center Island Footprint */}
                {room.island && (
                  <rect
                    x={cx - room.island.widthIn / 2}
                    y={cy - room.island.depthIn / 2 + 8}
                    width={room.island.widthIn}
                    height={room.island.depthIn}
                    fill={isPaper ? 'rgba(184,134,11,0.14)' : 'rgba(56,189,248,0.14)'}
                    stroke={cWallStroke}
                    strokeWidth="1.8"
                  />
                )}

                {/* Openings Along Room Edges (Doors = Amber Swing Arc · Windows = Sky Glazing) */}
                {room.planOpenings.map((op) => {
                  const isHoriz = op.wall === 'N' || op.wall === 'S'
                  const ox = isHoriz
                    ? rect.xIn + Math.min(rect.widthIn - op.widthIn, Math.max(0, op.offsetIn))
                    : op.wall === 'W'
                      ? rect.xIn - 2.5
                      : rect.xIn + rect.widthIn - 2.5
                  const oy = isHoriz
                    ? op.wall === 'N'
                      ? rect.yIn - 2.5
                      : rect.yIn + rect.depthIn - 2.5
                    : rect.yIn + Math.min(rect.depthIn - op.widthIn, Math.max(0, op.offsetIn))
                  const ow = isHoriz ? op.widthIn : 5
                  const oh = isHoriz ? 5 : op.widthIn
                  const isWin = op.kind === 'window'
                  return (
                    <rect
                      key={op.id}
                      x={ox}
                      y={oy}
                      width={ow}
                      height={oh}
                      fill={isWin ? '#38bdf8' : '#f59e0b'}
                      rx="1.5"
                    />
                  )
                })}

                {/* Room Number + Name + Dimensions */}
                <text
                  x={cx}
                  y={cy - (compact ? 2 : 10)}
                  textAnchor="middle"
                  fill={cTextMain}
                  fontSize={compact ? '10.5' : '13.5'}
                  fontWeight="700"
                >
                  {room.number} {room.name}
                </text>

                {showDimensions && !compact && (
                  <text
                    x={cx}
                    y={cy + 9}
                    textAnchor="middle"
                    fill={cTextSub}
                    fontSize="10.5"
                    fontFamily="ui-monospace, monospace"
                  >
                    {formatArchInches(rect.widthIn)} × {formatArchInches(rect.depthIn)} · {sf} sf
                  </text>
                )}

                {totalBays > 0 && !compact && rect.depthIn >= 96 && (
                  <text
                    x={cx}
                    y={cy + 24}
                    textAnchor="middle"
                    fill={isSelected ? '#fbbf24' : cFlex}
                    fontSize="9.5"
                    fontWeight="600"
                  >
                    {totalBays} Casework {totalBays === 1 ? 'Bay' : 'Bays'}
                  </text>
                )}
              </g>
            )
          })}

          {/* Highlighted Shared Interior Flex Partitions */}
          {levelFlexWalls.map((fw) => {
            const rA = roomRects.find((r) => r.room.id === fw.roomAId)
            const rB = roomRects.find((r) => r.room.id === fw.roomBId)
            if (!rA || !rB) return null
            const a = rA.rect
            const b = rB.rect
            // Vertical shared edge vs horizontal shared edge
            const vTouch = Math.abs(a.xIn + a.widthIn - b.xIn) < 18 || Math.abs(b.xIn + b.widthIn - a.xIn) < 18
            if (vTouch) {
              const xEdge =
                Math.abs(a.xIn + a.widthIn - b.xIn) < 18 ? a.xIn + a.widthIn : b.xIn + b.widthIn
              const y0 = Math.max(a.yIn, b.yIn)
              const y1 = Math.min(a.yIn + a.depthIn, b.yIn + b.depthIn)
              if (y1 <= y0) return null
              return (
                <line
                  key={fw.id}
                  x1={xEdge}
                  y1={y0}
                  x2={xEdge}
                  y2={y1}
                  stroke={cFlex}
                  strokeWidth="4.2"
                  strokeDasharray="9 5"
                />
              )
            }
            const yEdge =
              Math.abs(a.yIn + a.depthIn - b.yIn) < 18 ? a.yIn + a.depthIn : b.yIn + b.depthIn
            const x0 = Math.max(a.xIn, b.xIn)
            const x1 = Math.min(a.xIn + a.widthIn, b.xIn + b.widthIn)
            if (x1 <= x0) return null
            return (
              <line
                key={fw.id}
                x1={x0}
                y1={yEdge}
                x2={x1}
                y2={yEdge}
                stroke={cFlex}
                strokeWidth="4.2"
                strokeDasharray="9 5"
              />
            )
          })}
        </svg>

        {/* Floating Bottom Selected-Room Action Card (Click Room -> Open Room Studio or Nudge Flex Wall!) */}
        {selectedRoomObj && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-xl rounded-xl border border-gold/50 bg-bh-panel/95 px-3.5 py-2.5 shadow-2xl backdrop-blur flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gold/20 px-1.5 py-0.5 font-mono text-xs font-bold text-gold-light">
                  {selectedRoomObj.room.number}
                </span>
                <span className="text-sm font-semibold text-white truncate">
                  {selectedRoomObj.room.name}
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {formatArchInches(selectedRoomObj.rect.widthIn)} ×{' '}
                  {formatArchInches(selectedRoomObj.rect.depthIn)}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                {selectedRoomObj.room.subtitle}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedRoomFlex && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-sky-600/50 bg-sky-950/40 px-2 py-1 text-[11px]">
                  <span className="text-sky-300 font-medium hidden md:inline">Flex:</span>
                  <button
                    type="button"
                    onClick={() => onNudgeFlexWall(selectedRoomFlex.id, -1)}
                    className="rounded bg-bh-black px-1.5 py-0.5 font-mono text-sky-200 hover:bg-sky-900/60"
                  >
                    −1&quot;
                  </button>
                  <span className="font-mono text-white px-0.5">
                    {selectedRoomFlex.nudgeIn > 0 ? '+' : ''}
                    {formatInchesOnly(selectedRoomFlex.nudgeIn)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNudgeFlexWall(selectedRoomFlex.id, 1)}
                    className="rounded bg-bh-black px-1.5 py-0.5 font-mono text-sky-200 hover:bg-sky-900/60"
                  >
                    +1&quot;
                  </button>
                </div>
              )}

              <button
                type="button"
                data-testid="btn-enter-room-studio"
                onClick={() => onEnterRoomStudio(selectedRoomObj.room.id)}
                className="rounded-lg bg-gold px-3.5 py-2 text-xs font-bold text-slate-950 shadow hover:bg-gold-light transition-colors whitespace-nowrap"
              >
                Open Room Studio →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
