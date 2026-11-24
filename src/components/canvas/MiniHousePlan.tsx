'use client'

import React from 'react'
import {
  formatArchInches,
  getEffectiveRoomRect,
  type HouseMatrix,
  type RoomStatus,
} from '@/lib/canvas-matrix'

interface MiniHousePlanProps {
  matrix: HouseMatrix
  activeRoomId: string
  onSelectRoom: (roomId: string) => void
}

const STATUS_STYLE: Record<
  RoomStatus,
  { fill: string; activeFill: string; stroke: string; badge: string }
> = {
  approved: {
    fill: 'rgba(16, 185, 129, 0.12)',
    activeFill: 'rgba(16, 185, 129, 0.26)',
    stroke: '#10b981',
    badge: '#34d399',
  },
  draft: {
    fill: 'rgba(218, 165, 32, 0.12)',
    activeFill: 'rgba(218, 165, 32, 0.26)',
    stroke: '#daa520',
    badge: '#fbbf24',
  },
  needs_review: {
    fill: 'rgba(244, 63, 94, 0.14)',
    activeFill: 'rgba(244, 63, 94, 0.28)',
    stroke: '#f43f5e',
    badge: '#fb7185',
  },
}

export function MiniHousePlan({ matrix, activeRoomId, onSelectRoom }: MiniHousePlanProps) {
  const rects = matrix.rooms.map((room) => ({
    room,
    rect: getEffectiveRoomRect(matrix, room),
  }))

  if (rects.length === 0) {
    return (
      <div className="h-36 rounded-lg border border-bh-border bg-bh-black/80 flex items-center justify-center text-xs text-slate-500">
        No rooms yet — click + Add Room
      </div>
    )
  }

  const minX = Math.min(...rects.map((r) => r.rect.xIn))
  const minY = Math.min(...rects.map((r) => r.rect.yIn))
  const maxX = Math.max(...rects.map((r) => r.rect.xIn + r.rect.widthIn))
  const maxY = Math.max(...rects.map((r) => r.rect.yIn + r.rect.depthIn))

  const pad = 42
  const vbX = minX - pad
  const vbY = minY - pad
  const vbW = Math.max(240, maxX - minX + pad * 2)
  const vbH = Math.max(180, maxY - minY + pad * 2 + 24)

  const flexEntries = Object.values(matrix.flexWalls)

  return (
    <div className="rounded-lg border border-bh-border bg-[#0e1217] p-2 relative overflow-hidden">
      <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] font-medium text-slate-400">
        <span className="uppercase tracking-[0.16em] text-slate-400 font-semibold">
          Whole-House Matrix
        </span>
        <span className="text-[10px] text-slate-500 font-mono">Click room to jump</span>
      </div>

      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full h-40 block select-none"
        role="img"
        aria-label="Interactive Whole-House Mini Floorplan"
      >
        <defs>
          <pattern
            id="mini-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(148, 163, 184, 0.07)"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>

        <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#mini-grid)" />

        {/* Subtle Rear Covered Terrace Footprint under Living/Great Room if present */}
        {rects
          .filter((item) =>
            item.room.planOpenings.some((op) => op.kind === 'accordion' && op.wall === 'S')
          )
          .map(({ room, rect }) => (
            <g key={`patio-${room.id}`}>
              <rect
                x={rect.xIn}
                y={rect.yIn + rect.depthIn + 4}
                width={rect.widthIn}
                height={42}
                fill="rgba(148, 163, 184, 0.03)"
                stroke="rgba(148, 163, 184, 0.22)"
                strokeWidth="2"
                strokeDasharray="10 8"
              />
              <text
                x={rect.xIn + rect.widthIn / 2}
                y={rect.yIn + rect.depthIn + 29}
                textAnchor="middle"
                fill="rgba(148, 163, 184, 0.45)"
                fontSize="16"
                fontFamily="ui-monospace, monospace"
                letterSpacing="2"
              >
                COVERED TERRACE
              </text>
            </g>
          ))}

        {/* Room Polygons */}
        {rects.map(({ room, rect }) => {
          const isActive = room.id === activeRoomId
          const palette = STATUS_STYLE[room.status]
          const cx = rect.xIn + rect.widthIn / 2
          const cy = rect.yIn + rect.depthIn / 2

          return (
            <g
              key={room.id}
              data-testid={`mini-room-${room.id}`}
              onClick={() => onSelectRoom(room.id)}
              className="cursor-pointer transition-opacity hover:opacity-95"
            >
              {/* Outer selection halo */}
              {isActive && (
                <rect
                  x={rect.xIn - 5}
                  y={rect.yIn - 5}
                  width={rect.widthIn + 10}
                  height={rect.depthIn + 10}
                  rx="4"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="4"
                  opacity="0.9"
                />
              )}

              <rect
                x={rect.xIn}
                y={rect.yIn}
                width={rect.widthIn}
                height={rect.depthIn}
                fill={isActive ? palette.activeFill : palette.fill}
                stroke={isActive ? '#f8fafc' : palette.stroke}
                strokeWidth={isActive ? 4 : 2.4}
              />

              {/* Island mini footprint */}
              {room.island && (
                <rect
                  x={cx - room.island.widthIn / 2}
                  y={rect.yIn + 24 + room.island.aisleNorthIn}
                  width={room.island.widthIn}
                  height={room.island.depthIn}
                  fill="rgba(248, 250, 252, 0.12)"
                  stroke="rgba(248, 250, 252, 0.45)"
                  strokeWidth="1.8"
                />
              )}

              {/* Doors & Windows ticks on perimeter */}
              {room.planOpenings.map((op) => {
                if (op.wall === 'N' || op.wall === 'S') {
                  const y = op.wall === 'N' ? rect.yIn : rect.yIn + rect.depthIn
                  const x1 = rect.xIn + Math.min(rect.widthIn - 12, op.offsetIn)
                  const w = Math.min(op.widthIn, rect.widthIn - 12)
                  return (
                    <line
                      key={op.id}
                      x1={x1}
                      y1={y}
                      x2={x1 + w}
                      y2={y}
                      stroke={op.kind === 'window' || op.kind === 'accordion' ? '#38bdf8' : '#0e1217'}
                      strokeWidth={op.kind === 'accordion' ? 6 : 5}
                    />
                  )
                }
                const x = op.wall === 'W' ? rect.xIn : rect.xIn + rect.widthIn
                const y1 = rect.yIn + Math.min(rect.depthIn - 12, op.offsetIn)
                const h = Math.min(op.widthIn, rect.depthIn - 12)
                return (
                  <line
                    key={op.id}
                    x1={x}
                    y1={y1}
                    x2={x}
                    y2={y1 + h}
                    stroke={op.kind === 'window' ? '#38bdf8' : '#0e1217'}
                    strokeWidth="5"
                  />
                )
              })}

              {/* Room Number + Short Label + Clear Width */}
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize={rect.widthIn < 90 ? '18' : '21'}
                fontWeight="700"
                fontFamily="var(--font-sans), sans-serif"
              >
                {room.number}
              </text>
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize={rect.widthIn < 90 ? '14' : '16'}
                fontWeight="500"
                fontFamily="var(--font-sans), sans-serif"
              >
                {rect.widthIn < 90 ? room.name.slice(0, 7) : room.name}
              </text>
              <text
                x={cx}
                y={cy + 31}
                textAnchor="middle"
                fill={palette.badge}
                fontSize="14"
                fontFamily="ui-monospace, monospace"
              >
                {formatArchInches(rect.widthIn)}
              </text>
            </g>
          )
        })}

        {/* Shared Flex Partition Indicator */}
        {flexEntries.map((flex) => {
          const roomA = matrix.rooms.find((r) => r.id === flex.roomAId)
          if (!roomA) return null
          const rectA = getEffectiveRoomRect(matrix, roomA)
          const wallX = rectA.xIn + rectA.widthIn + flex.studThicknessIn / 2
          return (
            <g key={flex.id}>
              <line
                x1={wallX}
                y1={rectA.yIn - 10}
                x2={wallX}
                y2={rectA.yIn + rectA.depthIn + 10}
                stroke="#f59e0b"
                strokeWidth="5"
                strokeDasharray="8 5"
              />
              <circle cx={wallX} cy={rectA.yIn - 12} r="8" fill="#f59e0b" />
            </g>
          )
        })}

        {/* Architectural North Arrow */}
        <g transform={`translate(${maxX + 18}, ${minY + 18})`}>
          <circle cx="0" cy="0" r="16" fill="rgba(15,23,42,0.85)" stroke="#64748b" strokeWidth="2" />
          <path d="M 0 -11 L 6 7 L 0 3 L -6 7 Z" fill="#e2e8f0" />
          <text
            x="0"
            y="29"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="13"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
          >
            N
          </text>
        </g>
      </svg>

      {/* Status Legend */}
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-slate-400">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Approved
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Draft
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Review
          </span>
        </div>
        {flexEntries.length > 0 && (
          <span className="text-amber-300 font-mono text-[10px]">
            Flex {flexEntries[0].nudgeIn >= 0 ? '+' : ''}
            {flexEntries[0].nudgeIn}&quot;
          </span>
        )}
      </div>
    </div>
  )
}
