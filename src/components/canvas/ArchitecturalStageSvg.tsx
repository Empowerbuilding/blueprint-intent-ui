'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  computeWallLayout,
  formatArchInches,
  formatInchesOnly,
  getEffectiveRoomRect,
  getEffectiveWallWidth,
  type CadTheme,
  type HouseMatrix,
  type ResolvedBayPlacement,
  type RoomNode,
  type StageLayoutMode,
  type WallDirection,
  type WallEdge,
} from '@/lib/canvas-matrix'

const S = 4 // 4 SVG units = 1 architectural inch

interface ThemePalette {
  bg: string
  gridMinor: string
  gridMajor: string
  cutStroke: string
  primaryStroke: string
  fineStroke: string
  dashedStroke: string
  dimStroke: string
  dimText: string
  datumStroke: string
  datumText: string
  titleText: string
  subText: string
  pocheBg: string
  pocheLine: string
  oakFill: string
  oakGrain: string
  stoneFill: string
  stoneJoint: string
  slabFill: string
  steelFill: string
  steelStroke: string
  glassFill: string
  glassGlint: string
  applianceFill: string
  selectStroke: string
  selectFill: string
  hoverStroke: string
  sheetBorder: string
}

const PALETTES: Record<CadTheme, ThemePalette> = {
  paper: {
    bg: '#f7f5ef',
    gridMinor: 'rgba(15, 23, 42, 0.035)',
    gridMajor: 'rgba(15, 23, 42, 0.075)',
    cutStroke: '#0f172a',
    primaryStroke: '#1e293b',
    fineStroke: '#334155',
    dashedStroke: '#64748b',
    dimStroke: '#334155',
    dimText: '#0f172a',
    datumStroke: '#0369a1',
    datumText: '#0369a1',
    titleText: '#0f172a',
    subText: '#475569',
    pocheBg: '#e2e8f0',
    pocheLine: '#94a3b8',
    oakFill: 'rgba(184, 134, 11, 0.13)',
    oakGrain: 'rgba(120, 83, 30, 0.38)',
    stoneFill: 'rgba(148, 142, 130, 0.14)',
    stoneJoint: '#64748b',
    slabFill: 'rgba(226, 232, 240, 0.55)',
    steelFill: '#1e293b',
    steelStroke: '#0f172a',
    glassFill: 'rgba(56, 189, 248, 0.08)',
    glassGlint: '#0284c7',
    applianceFill: 'rgba(203, 213, 225, 0.45)',
    selectStroke: '#0284c7',
    selectFill: 'rgba(2, 132, 199, 0.09)',
    hoverStroke: '#0ea5e9',
    sheetBorder: '#cbd5e1',
  },
  blueprint: {
    bg: '#09101a',
    gridMinor: 'rgba(56, 189, 248, 0.04)',
    gridMajor: 'rgba(56, 189, 248, 0.09)',
    cutStroke: '#f1f5f9',
    primaryStroke: '#cbd5e1',
    fineStroke: '#94a3b8',
    dashedStroke: '#64748b',
    dimStroke: '#38bdf8',
    dimText: '#e0f2fe',
    datumStroke: '#f59e0b',
    datumText: '#fbbf24',
    titleText: '#f8fafc',
    subText: '#94a3b8',
    pocheBg: '#132032',
    pocheLine: '#334155',
    oakFill: 'rgba(218, 165, 32, 0.14)',
    oakGrain: 'rgba(245, 158, 11, 0.4)',
    stoneFill: 'rgba(148, 163, 184, 0.09)',
    stoneJoint: '#475569',
    slabFill: 'rgba(51, 65, 85, 0.45)',
    steelFill: '#0f172a',
    steelStroke: '#94a3b8',
    glassFill: 'rgba(56, 189, 248, 0.1)',
    glassGlint: '#38bdf8',
    applianceFill: 'rgba(30, 41, 59, 0.7)',
    selectStroke: '#38bdf8',
    selectFill: 'rgba(56, 189, 248, 0.12)',
    hoverStroke: '#7dd3fc',
    sheetBorder: '#1e293b',
  },
}

interface ArchitecturalStageSvgProps {
  matrix: HouseMatrix
  room: RoomNode
  wall: WallEdge
  theme: CadTheme
  layoutMode: StageLayoutMode
  showDatums: boolean
  showDimensions: boolean
  selectedBayId: string | null
  onSelectBay: (bayId: string | null) => void
  onChangeWall: (wallId: WallDirection) => void
  onChangeLayoutMode: (mode: StageLayoutMode) => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

// Architectural 45° slash tick dimension helper
function DimHorizontal({
  x1,
  x2,
  y,
  refY,
  label,
  palette,
  bold = false,
}: {
  x1: number
  x2: number
  y: number
  refY: number
  label: string
  palette: ThemePalette
  bold?: boolean
}) {
  const w = Math.abs(x2 - x1)
  if (w < 6) return null
  const mid = (x1 + x2) / 2
  const dir = y > refY ? 1 : -1

  return (
    <g className="pointer-events-none">
      {/* Witness extension lines */}
      <line
        x1={x1}
        y1={refY + dir * 6}
        x2={x1}
        y2={y + dir * 6}
        stroke={palette.dimStroke}
        strokeWidth="0.7"
        opacity="0.65"
      />
      <line
        x1={x2}
        y1={refY + dir * 6}
        x2={x2}
        y2={y + dir * 6}
        stroke={palette.dimStroke}
        strokeWidth="0.7"
        opacity="0.65"
      />
      {/* Main dimension line */}
      <line
        x1={x1 - 4}
        y1={y}
        x2={x2 + 4}
        y2={y}
        stroke={palette.dimStroke}
        strokeWidth={bold ? '1.15' : '0.85'}
      />
      {/* 45-degree architectural ticks */}
      <line
        x1={x1 - 4.5}
        y1={y + 4.5}
        x2={x1 + 4.5}
        y2={y - 4.5}
        stroke={palette.dimStroke}
        strokeWidth="1.4"
      />
      <line
        x1={x2 - 4.5}
        y1={y + 4.5}
        x2={x2 + 4.5}
        y2={y - 4.5}
        stroke={palette.dimStroke}
        strokeWidth="1.4"
      />
      {/* Label pill background so line never strikes through text */}
      <rect
        x={mid - Math.max(18, label.length * 3.5)}
        y={y - 8}
        width={Math.max(36, label.length * 7)}
        height={15}
        rx="2"
        fill={palette.bg}
      />
      <text
        x={mid}
        y={y + 3.5}
        textAnchor="middle"
        fill={palette.dimText}
        fontSize={bold ? '11.5' : '10'}
        fontWeight={bold ? '700' : '600'}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  )
}

function DimVertical({
  x,
  y1,
  y2,
  refX,
  label,
  palette,
}: {
  x: number
  y1: number
  y2: number
  refX: number
  label: string
  palette: ThemePalette
}) {
  const h = Math.abs(y2 - y1)
  if (h < 18) return null
  const midY = (y1 + y2) / 2
  const dir = x < refX ? -1 : 1

  return (
    <g className="pointer-events-none">
      <line
        x1={refX + dir * 6}
        y1={y1}
        x2={x + dir * 6}
        y2={y1}
        stroke={palette.dimStroke}
        strokeWidth="0.7"
        opacity="0.65"
      />
      <line
        x1={refX + dir * 6}
        y1={y2}
        x2={x + dir * 6}
        y2={y2}
        stroke={palette.dimStroke}
        strokeWidth="0.7"
        opacity="0.65"
      />
      <line x1={x} y1={y1 - 4} x2={x} y2={y2 + 4} stroke={palette.dimStroke} strokeWidth="0.9" />
      <line
        x1={x - 4.5}
        y1={y1 + 4.5}
        x2={x + 4.5}
        y2={y1 - 4.5}
        stroke={palette.dimStroke}
        strokeWidth="1.4"
      />
      <line
        x1={x - 4.5}
        y1={y2 + 4.5}
        x2={x + 4.5}
        y2={y2 - 4.5}
        stroke={palette.dimStroke}
        strokeWidth="1.4"
      />
      <g transform={`translate(${x}, ${midY}) rotate(-90)`}>
        <rect
          x={-Math.max(20, label.length * 3.5)}
          y={-8}
          width={Math.max(40, label.length * 7)}
          height={15}
          rx="2"
          fill={palette.bg}
        />
        <text
          x={0}
          y={3.5}
          textAnchor="middle"
          fill={palette.dimText}
          fontSize="10"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {label}
        </text>
      </g>
    </g>
  )
}

function GlassGlint({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number
  y: number
  w: number
  h: number
  color: string
}) {
  const cx = x + w * 0.5
  const cy = y + h * 0.46
  const len = Math.min(w, h) * 0.24
  return (
    <g stroke={color} strokeWidth="0.9" opacity="0.55" className="pointer-events-none">
      <line x1={cx - len} y1={cy + len} x2={cx + len} y2={cy - len} />
      <line x1={cx - len * 0.55 + 6} y1={cy + len * 0.55 + 6} x2={cx + len * 0.55 + 6} y2={cy - len * 0.55 + 6} />
      <line x1={cx - len * 0.4 - 7} y1={cy + len * 0.4 - 7} x2={cx + len * 0.4 - 7} y2={cy - len * 0.4 - 7} />
    </g>
  )
}

// Compute ceiling height at xIn along the wall (handles 1:12 vaulted ceiling)
function ceilingHeightAtX(wall: WallEdge, clearWidthIn: number, xIn: number): number {
  if (!wall.vaulted) return wall.ceilingHeightIn
  const half = clearWidthIn / 2
  if (half <= 0) return wall.vaulted.highIn
  const distFromCenter = Math.abs(xIn - half)
  const ratio = 1 - Math.min(1, distFromCenter / half)
  return wall.vaulted.lowIn + (wall.vaulted.highIn - wall.vaulted.lowIn) * ratio
}

// Detailed CAD Elevation Bay Renderer
function ElevationBayGraphic({
  placement,
  wall,
  clearWidthIn,
  maxCeilingIn,
  palette,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: {
  placement: ResolvedBayPlacement
  wall: WallEdge
  clearWidthIn: number
  maxCeilingIn: number
  palette: ThemePalette
  isSelected: boolean
  isHovered: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const { bay, xStartIn, xEndIn } = placement
  const ey = (affIn: number) => (maxCeilingIn - affIn) * S
  const x = xStartIn * S
  const w = bay.widthIn * S
  const yBottom = ey(bay.affIn)
  const yTop = ey(bay.affIn + bay.heightIn)
  const h = yBottom - yTop
  const cx = x + w / 2

  const renderLowerCabinetCarcase = (
    topAffIn: number,
    mode: 'doors' | 'drawers' | 'sink',
    drawerCount: 3 | 4 = 3
  ) => {
    const toeIn = 4
    const slabIn = 1.5
    const yFloor = ey(0)
    const yToe = ey(toeIn)
    const yBoxTop = ey(topAffIn - slabIn)
    const ySlabTop = ey(topAffIn)
    const boxH = yToe - yBoxTop
    const reveal = 3

    return (
      <g>
        {/* Cabinet Carcase */}
        <rect
          x={x}
          y={yBoxTop}
          width={w}
          height={boxH}
          fill={palette.oakFill}
          stroke={palette.primaryStroke}
          strokeWidth="1.35"
        />
        {/* Recessed 4" Toe Kick */}
        <rect
          x={x + 2}
          y={yToe}
          width={Math.max(4, w - 4)}
          height={yFloor - yToe}
          fill="rgba(15, 23, 42, 0.16)"
          stroke={palette.fineStroke}
          strokeWidth="0.9"
        />
        {/* Continuous 1.5" Stone Countertop Slab (NO integral backsplash!) */}
        <rect
          x={x - 1}
          y={ySlabTop}
          width={w + 2}
          height={yBoxTop - ySlabTop}
          fill={palette.slabFill}
          stroke={palette.cutStroke}
          strokeWidth="1.4"
        />

        {mode === 'drawers' &&
          (() => {
            const ratios = drawerCount === 4 ? [0.18, 0.24, 0.28, 0.3] : [0.22, 0.38, 0.4]
            let curY = yBoxTop + reveal
            const availH = boxH - reveal * (ratios.length + 1)
            return ratios.map((r, idx) => {
              const dh = Math.max(8, availH * r)
              const dy = curY
              curY += dh + reveal
              const pullW = Math.min(24, w * 0.34)
              return (
                <g key={idx}>
                  <rect
                    x={x + reveal}
                    y={dy}
                    width={Math.max(6, w - reveal * 2)}
                    height={dh}
                    fill="none"
                    stroke={palette.fineStroke}
                    strokeWidth="0.95"
                  />
                  {/* Subtle inner shaker stile/rail */}
                  {w > 44 && dh > 18 && (
                    <rect
                      x={x + reveal + 7}
                      y={dy + 5}
                      width={w - reveal * 2 - 14}
                      height={dh - 10}
                      fill="none"
                      stroke={palette.fineStroke}
                      strokeWidth="0.55"
                      opacity="0.55"
                    />
                  )}
                  {/* Centered horizontal bar pull */}
                  <line
                    x1={cx - pullW / 2}
                    y1={dy + dh / 2}
                    x2={cx + pullW / 2}
                    y2={dy + dh / 2}
                    stroke={palette.cutStroke}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </g>
              )
            })
          })()}

        {(mode === 'doors' || mode === 'sink') &&
          (() => {
            const headerH = mode === 'sink' ? 24 : 22
            const doorY = yBoxTop + reveal + headerH + reveal
            const doorH = Math.max(16, yToe - doorY - reveal)
            const doorW = Math.max(8, (w - reveal * 3) / 2)
            const lx = x + reveal
            const rx = x + reveal * 2 + doorW
            return (
              <g>
                {/* Top false panel (sink) or top drawer */}
                <rect
                  x={x + reveal}
                  y={yBoxTop + reveal}
                  width={Math.max(8, w - reveal * 2)}
                  height={headerH}
                  fill="none"
                  stroke={palette.fineStroke}
                  strokeWidth="0.95"
                />
                {mode === 'doors' && (
                  <line
                    x1={cx - 10}
                    y1={yBoxTop + reveal + headerH / 2}
                    x2={cx + 10}
                    y2={yBoxTop + reveal + headerH / 2}
                    stroke={palette.cutStroke}
                    strokeWidth="1.6"
                  />
                )}
                {/* Left & Right Cabinet Doors */}
                <rect
                  x={lx}
                  y={doorY}
                  width={doorW}
                  height={doorH}
                  fill="none"
                  stroke={palette.fineStroke}
                  strokeWidth="0.95"
                />
                <rect
                  x={rx}
                  y={doorY}
                  width={doorW}
                  height={doorH}
                  fill="none"
                  stroke={palette.fineStroke}
                  strokeWidth="0.95"
                />
                {/* Vertical pulls */}
                <line
                  x1={lx + doorW - 5}
                  y1={doorY + 8}
                  x2={lx + doorW - 5}
                  y2={doorY + Math.min(26, doorH - 6)}
                  stroke={palette.cutStroke}
                  strokeWidth="1.6"
                />
                <line
                  x1={rx + 5}
                  y1={doorY + 8}
                  x2={rx + 5}
                  y2={doorY + Math.min(26, doorH - 6)}
                  stroke={palette.cutStroke}
                  strokeWidth="1.6"
                />
                {/* Architectural dashed hinge V-lines */}
                <path
                  d={`M ${lx} ${doorY} L ${lx + doorW} ${doorY + doorH / 2} L ${lx} ${doorY + doorH}`}
                  fill="none"
                  stroke={palette.dashedStroke}
                  strokeWidth="0.65"
                  strokeDasharray="4 3"
                  opacity="0.65"
                />
                <path
                  d={`M ${rx + doorW} ${doorY} L ${rx} ${doorY + doorH / 2} L ${rx + doorW} ${doorY + doorH}`}
                  fill="none"
                  stroke={palette.dashedStroke}
                  strokeWidth="0.65"
                  strokeDasharray="4 3"
                  opacity="0.65"
                />
              </g>
            )
          })()}
      </g>
    )
  }

  return (
    <g
      data-testid={`elev-bay-${bay.id}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(bay.id)
      }}
      onMouseEnter={() => onHover(bay.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer"
    >
      {/* Full-Height Bookmatched Quartzite Slab Splash behind bay when enabled */}
      {bay.fullHeightSplash && (
        <g className="pointer-events-none">
          <rect
            x={x}
            y={ey(wall.ceilingHeightIn)}
            width={w}
            height={ey(bay.heightIn) - ey(wall.ceilingHeightIn)}
            fill={palette.slabFill}
            opacity="0.32"
          />
          <path
            d={`M ${x + w * 0.15} ${ey(bay.heightIn)} Q ${x + w * 0.55} ${ey((bay.heightIn + wall.ceilingHeightIn) / 2)} ${x + w * 0.85} ${ey(wall.ceilingHeightIn)}`}
            fill="none"
            stroke={palette.dashedStroke}
            strokeWidth="0.6"
            opacity="0.35"
          />
        </g>
      )}

      {/* 1. DRAWER STACK */}
      {bay.kind === 'drawer_stack' &&
        renderLowerCabinetCarcase(bay.heightIn, 'drawers', bay.drawerCount ?? 3)}

      {/* 2. BASE DOORS */}
      {bay.kind === 'base_doors' && renderLowerCabinetCarcase(bay.heightIn, 'doors')}

      {/* 3. SINK BASE + UNDERMOUNT BOWL + FAUCET + OPTIONAL MIRROR & SCONCES @ 66" AFF */}
      {bay.kind === 'sink_base' && (
        <g>
          {renderLowerCabinetCarcase(bay.heightIn, 'sink')}
          {/* Dashed Undermount Kathryn Sink Basin below slab */}
          {(() => {
            const bowlW = Math.min(w - 16, 21 * S)
            const bowlH = 7.5 * S
            const bowlY = ey(bay.heightIn - 1.5)
            return (
              <path
                d={`M ${cx - bowlW / 2} ${bowlY} L ${cx - bowlW / 2 + 4} ${bowlY + bowlH} Q ${cx} ${bowlY + bowlH + 4} ${cx + bowlW / 2 - 4} ${bowlY + bowlH} L ${cx + bowlW / 2} ${bowlY}`}
                fill="none"
                stroke={palette.dashedStroke}
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            )
          })()}
          {/* Architectural Gooseneck Faucet + Hot/Cold Handles */}
          <g stroke={palette.cutStroke} fill="none" strokeWidth="1.5">
            <path
              d={`M ${cx} ${ey(bay.heightIn)} L ${cx} ${ey(bay.heightIn + 7)} A 12 12 0 0 1 ${cx + 18} ${ey(bay.heightIn + 5)}`}
            />
            <line x1={cx - 18} y1={ey(bay.heightIn)} x2={cx - 18} y2={ey(bay.heightIn + 2.5)} />
            <line x1={cx - 23} y1={ey(bay.heightIn + 2.5)} x2={cx - 14} y2={ey(bay.heightIn + 2.5)} />
            <line x1={cx + 18} y1={ey(bay.heightIn)} x2={cx + 18} y2={ey(bay.heightIn + 2.5)} />
            <line x1={cx + 14} y1={ey(bay.heightIn + 2.5)} x2={cx + 23} y2={ey(bay.heightIn + 2.5)} />
          </g>

          {/* 42"x48" Black-Frame Mirror centered @ 66" AFF (42" to 90" AFF) */}
          {bay.hasMirror &&
            (() => {
              const mirrorW = (bay.widthIn >= 36 ? 42 : bay.widthIn - 2) * S
              const mirrorBottomAff = 42
              const mirrorTopAff = 90
              const mx = cx - mirrorW / 2
              const my = ey(mirrorTopAff)
              const mh = ey(mirrorBottomAff) - my
              return (
                <g>
                  <rect
                    x={mx}
                    y={my}
                    width={mirrorW}
                    height={mh}
                    rx="3"
                    fill={palette.glassFill}
                    stroke={palette.cutStroke}
                    strokeWidth="2.2"
                  />
                  <rect
                    x={mx + 4}
                    y={my + 4}
                    width={mirrorW - 8}
                    height={mh - 8}
                    fill="none"
                    stroke={palette.fineStroke}
                    strokeWidth="0.7"
                  />
                  <GlassGlint x={mx} y={my} w={mirrorW} h={mh} color={palette.glassGlint} />
                </g>
              )
            })()}

          {/* Flanking Architectural Tube Sconces centered @ 66" AFF */}
          {bay.hasSconces &&
            (() => {
              const sconceCenterY = ey(66)
              const sconceOffset = ((bay.widthIn >= 36 ? 42 : bay.widthIn) / 2 + 8) * S
              const sconceH = 16 * S
              const sconceW = 2.8 * S
              return [-1, 1].map((side) => {
                const sx = cx + side * sconceOffset
                return (
                  <g key={side}>
                    {/* Brass/Black Wall Backplate @ 66" CL */}
                    <circle
                      cx={sx}
                      cy={sconceCenterY}
                      r="5"
                      fill={palette.steelFill}
                      stroke={palette.cutStroke}
                      strokeWidth="1.1"
                    />
                    {/* Vertical Opal Diffuser Tube */}
                    <rect
                      x={sx - sconceW / 2}
                      y={sconceCenterY - sconceH / 2}
                      width={sconceW}
                      height={sconceH}
                      rx="3"
                      fill={palette.bg}
                      stroke={palette.primaryStroke}
                      strokeWidth="1.15"
                    />
                  </g>
                )
              })
            })()}
        </g>
      )}

      {/* 4. FLOATING OAK SHELVES (3 actual 2" thick timber planks + optional lower cabinet!) */}
      {bay.kind === 'floating_shelves' && (
        <g>
          {bay.withLowerBase &&
            renderLowerCabinetCarcase(bay.lowerBaseHeightIn ?? 30, 'doors')}
          {(() => {
            const count = bay.shelfCount ?? 3
            const plankThicknessIn = 2
            const baseTop = bay.withLowerBase ? (bay.lowerBaseHeightIn ?? 30) : 36
            const topShelfAff = Math.min(bay.affIn + bay.heightIn - 4, 86)
            const firstShelfAff = Math.max(baseTop + 22, 54)
            const step = count > 1 ? (topShelfAff - firstShelfAff) / (count - 1) : 0

            return Array.from({ length: count }, (_, idx) => {
              const shelfAff = firstShelfAff + idx * step
              const sy = ey(shelfAff + plankThicknessIn)
              const sh = plankThicknessIn * S // Exact 2" = 8px crisp timber slab!
              const inset = 6
              const sw = Math.max(16, w - inset * 2)
              const sx = x + inset
              return (
                <g key={idx}>
                  <rect
                    x={sx}
                    y={sy}
                    width={sw}
                    height={sh}
                    fill={palette.oakFill}
                    stroke={palette.cutStroke}
                    strokeWidth="1.35"
                  />
                  {/* Wood grain line */}
                  <line
                    x1={sx + 6}
                    y1={sy + sh * 0.5}
                    x2={sx + sw - 6}
                    y2={sy + sh * 0.5}
                    stroke={palette.oakGrain}
                    strokeWidth="0.7"
                  />
                  {/* Concealed steel bracket dashed pins */}
                  <line
                    x1={sx + sw * 0.22}
                    y1={sy + 1}
                    x2={sx + sw * 0.22}
                    y2={sy + sh - 1}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.9"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1={sx + sw * 0.78}
                    y1={sy + 1}
                    x2={sx + sw * 0.78}
                    y2={sy + sh - 1}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.9"
                    strokeDasharray="2 2"
                  />
                </g>
              )
            })
          })()}
        </g>
      )}

      {/* 5. GREAT ROOM STONE FIREPLACE CHASE + MANTEL + FIREBOX + 75" TV */}
      {bay.kind === 'fireplace_chase' &&
        (() => {
          const leftCeil = ceilingHeightAtX(wall, clearWidthIn, xStartIn)
          const midCeil =
            xStartIn <= clearWidthIn / 2 && xEndIn >= clearWidthIn / 2
              ? ceilingHeightAtX(wall, clearWidthIn, clearWidthIn / 2)
              : ceilingHeightAtX(wall, clearWidthIn, (xStartIn + xEndIn) / 2)
          const rightCeil = ceilingHeightAtX(wall, clearWidthIn, xEndIn)
          const yFloor = ey(0)
          const chasePoly =
            xStartIn <= clearWidthIn / 2 && xEndIn >= clearWidthIn / 2
              ? `${x},${yFloor} ${x},${ey(leftCeil)} ${(clearWidthIn / 2) * S},${ey(midCeil)} ${x + w},${ey(rightCeil)} ${x + w},${yFloor}`
              : `${x},${yFloor} ${x},${ey(leftCeil)} ${x + w},${ey(rightCeil)} ${x + w},${yFloor}`

          const borderW = 2 * S // 2" proud stone border strip
          const hearthHIn = 18
          const capHIn = 3
          const fbW = Math.min(w - 24, 42 * S)
          const fbH = 32 * S
          const surroundW = 4 * S // 4" dark steel surround
          const mantelW = Math.min(w - 16, 72 * S)
          const mantelH = 8 * S // 72"x8"x6" oak mantel @ 62" AFF top!
          const mantelTopAff = 62
          const tvW = Math.min(w - 20, 65.5 * S) // 75" diagonal 16:9 = 65.4" x 36.8"
          const tvH = 37 * S
          const tvBottomAff = 74
          const boxW = 30 * S // 30x14x5 recessed steel AV box
          const boxH = 14 * S

          return (
            <g>
              {/* Full-height stone chase body w/ coursed limestone hatch */}
              <polygon
                points={chasePoly}
                fill="url(#cad-stone-hatch)"
                stroke={palette.cutStroke}
                strokeWidth="1.8"
              />
              <polygon points={chasePoly} fill={palette.stoneFill} />

              {/* 2" Proud vertical stone border strips & top frieze band */}
              <line
                x1={x + borderW}
                y1={ey(hearthHIn)}
                x2={x + borderW}
                y2={ey(leftCeil - 2)}
                stroke={palette.primaryStroke}
                strokeWidth="1.15"
              />
              <line
                x1={x + w - borderW}
                y1={ey(hearthHIn)}
                x2={x + w - borderW}
                y2={ey(rightCeil - 2)}
                stroke={palette.primaryStroke}
                strokeWidth="1.15"
              />

              {/* 18" Raised Stone Hearth + 3" Cast Concrete Overhang Cap */}
              <rect
                x={x}
                y={ey(hearthHIn - capHIn)}
                width={w}
                height={(hearthHIn - capHIn) * S}
                fill={palette.stoneFill}
                stroke={palette.primaryStroke}
                strokeWidth="1.3"
              />
              <rect
                x={x - 4}
                y={ey(hearthHIn)}
                width={w + 8}
                height={capHIn * S}
                fill={palette.slabFill}
                stroke={palette.cutStroke}
                strokeWidth="1.5"
              />

              {/* 4" Blackened Steel Surround + 42"x32" Masonry Firebox */}
              <rect
                x={cx - fbW / 2 - surroundW}
                y={ey(hearthHIn + 32 + 4)}
                width={fbW + surroundW * 2}
                height={fbH + surroundW}
                fill={palette.steelFill}
                stroke={palette.steelStroke}
                strokeWidth="1.4"
              />
              <rect
                x={cx - fbW / 2}
                y={ey(hearthHIn + 32)}
                width={fbW}
                height={fbH}
                fill="url(#cad-firebrick-hatch)"
                stroke={palette.cutStroke}
                strokeWidth="1.4"
              />
              {/* Subtle inner firebox damper & log grate line */}
              <line
                x1={cx - fbW * 0.32}
                y1={ey(hearthHIn + 4)}
                x2={cx + fbW * 0.32}
                y2={ey(hearthHIn + 4)}
                stroke={palette.fineStroke}
                strokeWidth="1.8"
              />

              {/* 72"x8"x6" White Oak Timber Mantel @ 62" AFF */}
              <rect
                x={cx - mantelW / 2}
                y={ey(mantelTopAff)}
                width={mantelW}
                height={mantelH}
                fill={palette.bg}
              />
              <rect
                x={cx - mantelW / 2}
                y={ey(mantelTopAff)}
                width={mantelW}
                height={mantelH}
                fill={palette.oakFill}
                stroke={palette.cutStroke}
                strokeWidth="1.6"
              />
              <line
                x1={cx - mantelW / 2 + 8}
                y1={ey(mantelTopAff - 3)}
                x2={cx + mantelW / 2 - 8}
                y2={ey(mantelTopAff - 3)}
                stroke={palette.oakGrain}
                strokeWidth="0.8"
              />
              <line
                x1={cx - mantelW / 2 + 14}
                y1={ey(mantelTopAff - 5.5)}
                x2={cx + mantelW / 2 - 14}
                y2={ey(mantelTopAff - 5.5)}
                stroke={palette.oakGrain}
                strokeWidth="0.7"
              />

              {/* 75" Frame TV + Dashed 30"x14"x5" Recessed Steel AV Backbox */}
              <rect
                x={cx - tvW / 2}
                y={ey(tvBottomAff + 37)}
                width={tvW}
                height={tvH}
                fill={palette.bg}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              <rect
                x={cx - tvW / 2 + 3}
                y={ey(tvBottomAff + 37) + 3}
                width={tvW - 6}
                height={tvH - 6}
                fill={palette.glassFill}
                stroke={palette.fineStroke}
                strokeWidth="0.75"
              />
              <GlassGlint
                x={cx - tvW / 2}
                y={ey(tvBottomAff + 37)}
                w={tvW}
                h={tvH}
                color={palette.glassGlint}
              />
              {/* Dashed 30x14x5 Recessed Steel Box */}
              <rect
                x={cx - boxW / 2}
                y={ey(tvBottomAff + 25)}
                width={boxW}
                height={boxH}
                fill="none"
                stroke={palette.dashedStroke}
                strokeWidth="1.05"
                strokeDasharray="5 3"
              />
              <text
                x={cx}
                y={ey(tvBottomAff + 17)}
                textAnchor="middle"
                fill={palette.subText}
                fontSize="8.5"
                fontFamily="ui-monospace, monospace"
              >
                75&quot; TV · 30×14×5 RECESSED BOX
              </text>
            </g>
          )
        })()}

      {/* 6. PRO RANGE + CUSTOM PLASTER/OAK CHIMNEY HOOD */}
      {bay.kind === 'range_hood' &&
        (() => {
          const rangeHIn = 36
          const hoodW = (bay.hoodWidthIn ?? bay.widthIn + 6) * S
          const hoodBottomAff = 66
          const hoodTopAff = bay.heightIn
          return (
            <g>
              {/* Pro Range Lower Body */}
              <rect
                x={x}
                y={ey(rangeHIn)}
                width={w}
                height={(rangeHIn - 3) * S}
                fill={palette.applianceFill}
                stroke={palette.cutStroke}
                strokeWidth="1.5"
              />
              {/* Range Feet */}
              <rect x={x + 8} y={ey(3)} width={10} height={12} fill={palette.steelFill} />
              <rect x={x + w - 18} y={ey(3)} width={10} height={12} fill={palette.steelFill} />
              {/* Cast Iron Burner Grates on Top */}
              <line
                x1={x + 4}
                y1={ey(rangeHIn + 1.5)}
                x2={x + w - 4}
                y2={ey(rangeHIn + 1.5)}
                stroke={palette.cutStroke}
                strokeWidth="2.2"
              />
              {/* Bullnose Knob Bezel + Red/Steel Control Knobs */}
              <line
                x1={x}
                y1={ey(rangeHIn - 6)}
                x2={x + w}
                y2={ey(rangeHIn - 6)}
                stroke={palette.primaryStroke}
                strokeWidth="1.1"
              />
              {Array.from({ length: bay.widthIn >= 48 ? 8 : 6 }, (_, i) => {
                const nKnobs = bay.widthIn >= 48 ? 8 : 6
                const kx = x + 14 + (i * (w - 28)) / Math.max(1, nKnobs - 1)
                return (
                  <circle
                    key={i}
                    cx={kx}
                    cy={ey(rangeHIn - 3)}
                    r="3.2"
                    fill={palette.cutStroke}
                  />
                )
              })}
              {/* Double Oven Doors (48") or Single (36") */}
              {bay.widthIn >= 44 ? (
                <g>
                  <rect
                    x={x + 6}
                    y={ey(rangeHIn - 8)}
                    width={w * 0.36 - 8}
                    height={(rangeHIn - 13) * S}
                    fill="none"
                    stroke={palette.primaryStroke}
                    strokeWidth="1.1"
                  />
                  <rect
                    x={x + w * 0.36 + 4}
                    y={ey(rangeHIn - 8)}
                    width={w * 0.64 - 10}
                    height={(rangeHIn - 13) * S}
                    fill="none"
                    stroke={palette.primaryStroke}
                    strokeWidth="1.1"
                  />
                  <rect
                    x={x + w * 0.36 + 14}
                    y={ey(rangeHIn - 14)}
                    width={w * 0.64 - 30}
                    height={12 * S}
                    fill={palette.glassFill}
                    stroke={palette.fineStroke}
                    strokeWidth="0.9"
                  />
                </g>
              ) : (
                <rect
                  x={x + 8}
                  y={ey(rangeHIn - 8)}
                  width={w - 16}
                  height={(rangeHIn - 13) * S}
                  fill="none"
                  stroke={palette.primaryStroke}
                  strokeWidth="1.1"
                />
              )}

              {/* Slab Backsplash w/ Subtle Vein */}
              <rect
                x={x}
                y={ey(hoodBottomAff)}
                width={w}
                height={ey(rangeHIn) - ey(hoodBottomAff)}
                fill={palette.slabFill}
                opacity="0.35"
              />

              {/* Custom Architectural Tapered Plaster & White Oak Collar Hood */}
              <polygon
                points={`${cx - hoodW / 2},${ey(hoodBottomAff)} ${cx - hoodW * 0.43},${ey(hoodTopAff)} ${cx + hoodW * 0.43},${ey(hoodTopAff)} ${cx + hoodW / 2},${ey(hoodBottomAff)}`}
                fill={palette.bg}
                stroke={palette.cutStroke}
                strokeWidth="1.6"
              />
              {/* 3" White Oak Trim Apron Band at Bottom of Hood */}
              <rect
                x={cx - hoodW / 2}
                y={ey(hoodBottomAff + 3.5)}
                width={hoodW}
                height={3.5 * S}
                fill={palette.oakFill}
                stroke={palette.primaryStroke}
                strokeWidth="1.1"
              />
            </g>
          )
        })()}

      {/* 7. TALL TOWERS: TALL OVEN, FRIDGE, TALL PANTRY */}
      {(bay.kind === 'tall_oven' || bay.kind === 'fridge' || bay.kind === 'tall_tower') && (
        <g>
          {/* Full-Height Carcase */}
          <rect
            x={x}
            y={yTop}
            width={w}
            height={ey(4) - yTop}
            fill={palette.oakFill}
            stroke={palette.primaryStroke}
            strokeWidth="1.4"
          />
          {/* 4" Toe Kick */}
          <rect
            x={x + 2}
            y={ey(4)}
            width={w - 4}
            height={4 * S}
            fill="rgba(15, 23, 42, 0.16)"
            stroke={palette.fineStroke}
            strokeWidth="0.9"
          />

          {bay.kind === 'tall_oven' && (
            <g>
              {/* Lower pot drawer (4" to 28") */}
              <rect
                x={x + 4}
                y={ey(28)}
                width={w - 8}
                height={24 * S - 4}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.95"
              />
              {/* Wall Oven + Speed Oven Cutouts (28" to 82" AFF) */}
              <rect
                x={x + 5}
                y={ey(58)}
                width={w - 10}
                height={29 * S}
                fill={palette.applianceFill}
                stroke={palette.cutStroke}
                strokeWidth="1.3"
              />
              <rect
                x={x + 12}
                y={ey(52)}
                width={w - 24}
                height={18 * S}
                fill={palette.steelFill}
              />
              <line
                x1={x + 10}
                y1={ey(55)}
                x2={x + w - 10}
                y2={ey(55)}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              {/* Upper Speed/Micro Oven */}
              <rect
                x={x + 5}
                y={ey(78)}
                width={w - 10}
                height={19 * S}
                fill={palette.applianceFill}
                stroke={palette.cutStroke}
                strokeWidth="1.3"
              />
              <rect
                x={x + 12}
                y={ey(74)}
                width={w - 24}
                height={11 * S}
                fill={palette.steelFill}
              />
              {/* Top 2-Door Tray Cabinet (78" to top datum) */}
              <rect
                x={x + 4}
                y={yTop + 4}
                width={(w - 11) / 2}
                height={Math.max(12, ey(79) - yTop - 4)}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.9"
              />
              <rect
                x={cx + 1.5}
                y={yTop + 4}
                width={(w - 11) / 2}
                height={Math.max(12, ey(79) - yTop - 4)}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.9"
              />
            </g>
          )}

          {bay.kind === 'fridge' && (
            <g>
              {/* Lower Freezer Drawer Panel (4" to 34") */}
              <rect
                x={x + 4}
                y={ey(34)}
                width={w - 8}
                height={30 * S - 4}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="1"
              />
              <line
                x1={cx - 18}
                y1={ey(30)}
                x2={cx + 18}
                y2={ey(30)}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              {/* Main Column Fridge Door Panel (34" to 84") */}
              <rect
                x={x + 4}
                y={ey(84)}
                width={w - 8}
                height={50 * S - 4}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="1"
              />
              <line
                x1={x + w - 12}
                y1={ey(72)}
                x2={x + w - 12}
                y2={ey(44)}
                stroke={palette.cutStroke}
                strokeWidth="2.2"
              />
              {/* Upper Flush Transom Cabinet to 108" Datum */}
              {bay.heightIn > 86 && (
                <rect
                  x={x + 4}
                  y={yTop + 4}
                  width={w - 8}
                  height={ey(85) - yTop - 4}
                  fill="none"
                  stroke={palette.fineStroke}
                  strokeWidth="0.9"
                />
              )}
            </g>
          )}

          {bay.kind === 'tall_tower' && (
            <g>
              <rect
                x={x + 4}
                y={ey(84)}
                width={(w - 11) / 2}
                height={80 * S - 4}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.95"
              />
              <rect
                x={cx + 1.5}
                y={ey(84)}
                width={(w - 11) / 2}
                height={80 * S - 4}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.95"
              />
              {bay.heightIn > 86 && (
                <>
                  <rect
                    x={x + 4}
                    y={yTop + 4}
                    width={(w - 11) / 2}
                    height={ey(85) - yTop - 4}
                    fill="none"
                    stroke={palette.fineStroke}
                    strokeWidth="0.9"
                  />
                  <rect
                    x={cx + 1.5}
                    y={yTop + 4}
                    width={(w - 11) / 2}
                    height={ey(85) - yTop - 4}
                    fill="none"
                    stroke={palette.fineStroke}
                    strokeWidth="0.9"
                  />
                </>
              )}
            </g>
          )}
        </g>
      )}

      {/* 8. CLOSET SYSTEM BAYS (Double Hang, Long Hang + Shoe, 4-Drawer Bank, Shoe Shelves) */}
      {bay.kind.startsWith('closet_') && (
        <g>
          {/* Left & Right 3/4" Melamine/Oak Vertical Partition Gables + Top 96" Shelf */}
          <rect
            x={x}
            y={yTop}
            width={w}
            height={ey(4) - yTop}
            fill="rgba(148, 163, 184, 0.04)"
            stroke={palette.primaryStroke}
            strokeWidth="1.3"
          />
          <rect x={x} y={yTop} width={3} height={ey(0) - yTop} fill={palette.oakFill} />
          <rect x={x + w - 3} y={yTop} width={3} height={ey(0) - yTop} fill={palette.oakFill} />
          <rect
            x={x + 2}
            y={ey(4)}
            width={w - 4}
            height={4 * S}
            fill="rgba(15,23,42,0.14)"
            stroke={palette.fineStroke}
            strokeWidth="0.8"
          />
          {/* Top 96" Storage Shelf */}
          <rect
            x={x}
            y={yTop}
            width={w}
            height={4}
            fill={palette.oakFill}
            stroke={palette.primaryStroke}
            strokeWidth="1.1"
          />

          {bay.kind === 'closet_double_hang' && (
            <g>
              {/* Shelves at 84" and 42" */}
              {[84, 42].map((sAff) => (
                <rect
                  key={sAff}
                  x={x + 3}
                  y={ey(sAff)}
                  width={w - 6}
                  height={3.5}
                  fill={palette.oakFill}
                  stroke={palette.primaryStroke}
                  strokeWidth="1"
                />
              ))}
              {/* Hanging Rods at 81.5" and 39.5" + Garment Hanger Ticks */}
              {[81.5, 39.5].map((rAff) => (
                <g key={rAff}>
                  <line
                    x1={x + 4}
                    y1={ey(rAff)}
                    x2={x + w - 4}
                    y2={ey(rAff)}
                    stroke={palette.cutStroke}
                    strokeWidth="2"
                  />
                  {Array.from({ length: Math.max(4, Math.floor(bay.widthIn / 4)) }, (_, idx) => {
                    const gx = x + 12 + idx * 14
                    if (gx > x + w - 12) return null
                    return (
                      <line
                        key={idx}
                        x1={gx}
                        y1={ey(rAff + 1)}
                        x2={gx}
                        y2={ey(rAff - 24)}
                        stroke={palette.dashedStroke}
                        strokeWidth="0.85"
                        opacity="0.65"
                      />
                    )
                  })}
                </g>
              ))}
            </g>
          )}

          {bay.kind === 'closet_long_hang' && (
            <g>
              {/* 84" Shelf + 81.5" Rod w/ 66" Clear Long-Hang Drop + 15.5" Lower Shoe Shelf */}
              <rect
                x={x + 3}
                y={ey(84)}
                width={w - 6}
                height={3.5}
                fill={palette.oakFill}
                stroke={palette.primaryStroke}
                strokeWidth="1"
              />
              <line
                x1={x + 4}
                y1={ey(81.5)}
                x2={x + w - 4}
                y2={ey(81.5)}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              {Array.from({ length: Math.max(4, Math.floor(bay.widthIn / 4.5)) }, (_, idx) => {
                const gx = x + 14 + idx * 16
                if (gx > x + w - 12) return null
                return (
                  <line
                    key={idx}
                    x1={gx}
                    y1={ey(82)}
                    x2={gx}
                    y2={ey(28)}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.9"
                    opacity="0.65"
                  />
                )
              })}
              {/* Lower Shoe Shelf @ 15.5" AFF */}
              <rect
                x={x + 3}
                y={ey(15.5)}
                width={w - 6}
                height={3.5}
                fill={palette.oakFill}
                stroke={palette.primaryStroke}
                strokeWidth="1"
              />
            </g>
          )}

          {bay.kind === 'closet_drawers' && (
            <g>
              {/* 4 Drawers up to 32" Datum + Adjustable Open Shelves Above */}
              {[11, 18, 25, 32].map((dTop, idx) => {
                const dBot = idx === 0 ? 4 : [4, 11, 18, 25][idx]
                const dy = ey(dTop)
                const dh = ey(dBot) - dy - 2
                return (
                  <g key={dTop}>
                    <rect
                      x={x + 4}
                      y={dy}
                      width={w - 8}
                      height={dh}
                      fill={palette.oakFill}
                      stroke={palette.fineStroke}
                      strokeWidth="0.95"
                    />
                    <line
                      x1={cx - 10}
                      y1={dy + dh / 2}
                      x2={cx + 10}
                      y2={dy + dh / 2}
                      stroke={palette.cutStroke}
                      strokeWidth="1.5"
                    />
                  </g>
                )
              })}
              {[48, 64, 84].map((sAff) => (
                <rect
                  key={sAff}
                  x={x + 3}
                  y={ey(sAff)}
                  width={w - 6}
                  height={3.5}
                  fill={palette.oakFill}
                  stroke={palette.primaryStroke}
                  strokeWidth="1"
                />
              ))}
            </g>
          )}

          {bay.kind === 'closet_shelves' &&
            [18, 30, 42, 54, 69, 84].map((sAff) => (
              <rect
                key={sAff}
                x={x + 3}
                y={ey(sAff)}
                width={w - 6}
                height={3.5}
                fill={palette.oakFill}
                stroke={palette.primaryStroke}
                strokeWidth="1"
              />
            ))}
        </g>
      )}

      {/* 9. FULL-HEIGHT 1/8" GLASS STEAM / WET ROOM */}
      {bay.kind === 'wet_room_glass' &&
        (() => {
          const doorW = Math.min(w * 0.46, 28 * S)
          const benchW = 18 * S
          const benchH = 18 * S
          const nicheW = Math.min(w * 0.25, 14 * S)
          const nicheH = Math.min(h * 0.42, 50 * S)
          return (
            <g>
              {/* Subtle large-format porcelain tile background lines */}
              <rect
                x={x}
                y={yTop}
                width={w}
                height={h}
                fill={palette.glassFill}
                stroke={palette.cutStroke}
                strokeWidth="1.6"
              />
              {/* 4" Curb */}
              <rect
                x={x}
                y={ey(4)}
                width={w}
                height={4 * S}
                fill={palette.slabFill}
                stroke={palette.primaryStroke}
                strokeWidth="1.2"
              />
              {/* 14"x50" Recessed Shower Niche */}
              <rect
                x={x + w * 0.22}
                y={ey(86)}
                width={nicheW}
                height={nicheH}
                fill={palette.bg}
                stroke={palette.primaryStroke}
                strokeWidth="1.15"
              />
              <line
                x1={x + w * 0.22}
                y1={ey(62)}
                x2={x + w * 0.22 + nicheW}
                y2={ey(62)}
                stroke={palette.fineStroke}
                strokeWidth="1"
              />
              {/* 18" Floating Stone Steam Bench */}
              {bay.widthIn >= 48 && (
                <rect
                  x={x + w - benchW - 2}
                  y={ey(18)}
                  width={benchW}
                  height={3 * S}
                  fill={palette.slabFill}
                  stroke={palette.cutStroke}
                  strokeWidth="1.3"
                />
              )}
              {bay.widthIn >= 48 && (
                <line
                  x1={x + w - benchW}
                  y1={ey(15)}
                  x2={x + w - benchW}
                  y2={ey(4)}
                  stroke={palette.dashedStroke}
                  strokeWidth="0.9"
                  strokeDasharray="3 3"
                />
              )}
              {/* Ceiling Rain Head + Thermostatic Valve */}
              <line x1={x + 28} y1={yTop} x2={x + 28} y2={yTop + 14} stroke={palette.cutStroke} strokeWidth="1.4" />
              <line x1={x + 16} y1={yTop + 14} x2={x + 40} y2={yTop + 14} stroke={palette.cutStroke} strokeWidth="2.2" />
              {/* Hinged 28" Frameless 1/8" Steam Glass Door + D-Pull */}
              <line
                x1={x + doorW}
                y1={yTop}
                x2={x + doorW}
                y2={ey(4)}
                stroke={palette.cutStroke}
                strokeWidth="1.35"
              />
              <line
                x1={x + doorW - 10}
                y1={ey(46)}
                x2={x + doorW - 10}
                y2={ey(34)}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              <GlassGlint x={x} y={yTop} w={w} h={benchH * 4} color={palette.glassGlint} />
            </g>
          )
        })()}

      {/* 10. OPENINGS: 4-PANEL ACCORDION GLASS DOOR, WINDOW, DOOR */}
      {bay.kind === 'accordion_door' &&
        (() => {
          const panels = 4
          const casing = 3.5 * S
          const pw = w / panels
          return (
            <g>
              {/* Exterior Casing */}
              <rect
                x={x - casing}
                y={yTop - casing}
                width={w + casing * 2}
                height={h + casing}
                fill="none"
                stroke={palette.primaryStroke}
                strokeWidth="1.1"
              />
              <rect
                x={x}
                y={yTop}
                width={w}
                height={h}
                fill={palette.glassFill}
                stroke={palette.cutStroke}
                strokeWidth="1.8"
              />
              {Array.from({ length: panels }, (_, i) => {
                const px = x + i * pw
                return (
                  <g key={i}>
                    <rect
                      x={px + 4}
                      y={yTop + 5}
                      width={pw - 8}
                      height={h - 10}
                      fill="none"
                      stroke={palette.primaryStroke}
                      strokeWidth="1.2"
                    />
                    <GlassGlint x={px} y={yTop} w={pw} h={h} color={palette.glassGlint} />
                  </g>
                )
              })}
            </g>
          )
        })()}

      {bay.kind === 'window' &&
        (() => {
          const mullions = bay.widthIn >= 84 ? 3 : bay.widthIn >= 48 ? 2 : 1
          const pw = w / mullions
          return (
            <g>
              <rect
                x={x - 10}
                y={yTop - 10}
                width={w + 20}
                height={h + 20}
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.95"
              />
              <rect
                x={x}
                y={yTop}
                width={w}
                height={h}
                fill={palette.glassFill}
                stroke={palette.cutStroke}
                strokeWidth="1.6"
              />
              {Array.from({ length: mullions }, (_, i) => (
                <g key={i}>
                  <rect
                    x={x + i * pw + 4}
                    y={yTop + 4}
                    width={pw - 8}
                    height={h - 8}
                    fill="none"
                    stroke={palette.primaryStroke}
                    strokeWidth="1"
                  />
                  <GlassGlint x={x + i * pw} y={yTop} w={pw} h={h} color={palette.glassGlint} />
                </g>
              ))}
            </g>
          )
        })()}

      {bay.kind === 'door' && (
        <g>
          <rect
            x={x - 10}
            y={yTop - 10}
            width={w + 20}
            height={h + 10}
            fill="none"
            stroke={palette.fineStroke}
            strokeWidth="0.95"
          />
          <rect
            x={x}
            y={yTop}
            width={w}
            height={h}
            fill={bay.widthIn >= 96 ? 'none' : palette.oakFill}
            stroke={palette.cutStroke}
            strokeWidth="1.6"
          />
          {bay.widthIn < 96 && (
            <>
              <line
                x1={x + w - 14}
                y1={ey(36)}
                x2={x + w - 6}
                y2={ey(36)}
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              <path
                d={`M ${x} ${yTop} L ${x + w} ${yTop + h / 2} L ${x} ${yBottom}`}
                fill="none"
                stroke={palette.dashedStroke}
                strokeWidth="0.75"
                strokeDasharray="5 4"
              />
            </>
          )}
        </g>
      )}

      {/* 11. WATER CLOSET BAY */}
      {bay.kind === 'toilet_bay' && (
        <g>
          {/* Skirted WC Tank + Comfort Bowl */}
          <rect
            x={cx - 18}
            y={ey(29)}
            width={36}
            height={13 * S}
            rx="3"
            fill={palette.bg}
            stroke={palette.cutStroke}
            strokeWidth="1.35"
          />
          <path
            d={`M ${cx - 21} ${ey(16.5)} L ${cx + 21} ${ey(16.5)} L ${cx + 15} ${ey(0)} L ${cx - 15} ${ey(0)} Z`}
            fill={palette.bg}
            stroke={palette.cutStroke}
            strokeWidth="1.35"
          />
        </g>
      )}

      {/* Selection & Hover Hit Box + Resize Handle Badges */}
      <rect
        x={x}
        y={Math.min(yTop, bay.hasMirror ? ey(90) : yTop)}
        width={w}
        height={ey(0) - Math.min(yTop, bay.hasMirror ? ey(90) : yTop)}
        fill={isSelected ? palette.selectFill : 'transparent'}
        stroke={
          isSelected
            ? palette.selectStroke
            : isHovered
              ? palette.hoverStroke
              : 'transparent'
        }
        strokeWidth={isSelected ? '2.2' : '1.4'}
        strokeDasharray={isHovered && !isSelected ? '5 3' : undefined}
      />

      {isSelected && (
        <g className="pointer-events-none">
          <rect
            x={x - 3.5}
            y={(yTop + yBottom) / 2 - 12}
            width={7}
            height={24}
            rx="2"
            fill={palette.selectStroke}
          />
          <rect
            x={x + w - 3.5}
            y={(yTop + yBottom) / 2 - 12}
            width={7}
            height={24}
            rx="2"
            fill={palette.selectStroke}
          />
        </g>
      )}
    </g>
  )
}

export function ArchitecturalStageSvg({
  matrix,
  room,
  wall,
  theme,
  layoutMode,
  showDatums,
  showDimensions,
  selectedBayId,
  onSelectBay,
  onChangeWall,
  onChangeLayoutMode,
  svgRef,
}: ArchitecturalStageSvgProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null)
  const scopeKey = `${room.id}:${layoutMode}`
  const [viewState, setViewState] = useState<{
    scopeKey: string
    zoom: number
    panX: number
    panY: number
  }>({ scopeKey, zoom: 1, panX: 0, panY: 0 })

  const zoom = viewState.scopeKey === scopeKey ? viewState.zoom : 1
  const pan =
    viewState.scopeKey === scopeKey
      ? { x: viewState.panX, y: viewState.panY }
      : { x: 0, y: 0 }

  const dragStateRef = useRef<{
    active: boolean
    startX: number
    startY: number
    origPanX: number
    origPanY: number
    moved: boolean
  } | null>(null)

  const palette = PALETTES[theme]
  const layout = useMemo(() => computeWallLayout(matrix, wall), [matrix, wall])
  const roomRect = useMemo(() => getEffectiveRoomRect(matrix, room), [matrix, room])

  const clearWidthIn = layout.clearWidthIn
  const maxCeilingIn = wall.vaulted ? wall.vaulted.highIn : wall.ceilingHeightIn
  const wallThkPx = room.wallThicknessIn * S

  const elevW = clearWidthIn * S
  const elevH = maxCeilingIn * S

  // Synced Room Plan geometry in SVG pixels
  const planW = roomRect.widthIn * S
  const planD = roomRect.depthIn * S
  // Align Plan X with Elevation X when viewing N / S / Island walls
  const planOffsetX =
    wall.id === 'N' || wall.id === 'S'
      ? 0
      : (elevW - planW) / 2
  const splitGapY = 148
  const planOriginY = layoutMode === 'plan' ? 0 : elevH + splitGapY

  // Compute intrinsic logical scene bounds for clean auto-fit viewBox
  const sceneBounds = useMemo(() => {
    const marginL = 115
    const marginR = 165
    const marginT = 76
    const marginB = 96

    if (layoutMode === 'elevation') {
      return {
        x: -marginL,
        y: -marginT,
        w: elevW + marginL + marginR,
        h: elevH + marginT + marginB + 32,
      }
    }
    if (layoutMode === 'plan') {
      return {
        x: planOffsetX - marginL,
        y: -marginT,
        w: planW + marginL + marginR,
        h: planD + marginT + marginB,
      }
    }
    const minX = Math.min(0, planOffsetX) - marginL
    const maxX = Math.max(elevW, planOffsetX + planW) + marginR
    return {
      x: minX,
      y: -marginT,
      w: maxX - minX,
      h: planOriginY + planD + marginT + marginB,
    }
  }, [elevH, elevW, layoutMode, planD, planOffsetX, planOriginY, planW])

  const resetView = useCallback(() => {
    setViewState({ scopeKey, zoom: 1, panX: 0, panY: 0 })
  }, [scopeKey])

  const adjustZoom = useCallback(
    (factor: number) => {
      setViewState((prev) => {
        const baseZ = prev.scopeKey === scopeKey ? prev.zoom : 1
        const px = prev.scopeKey === scopeKey ? prev.panX : 0
        const py = prev.scopeKey === scopeKey ? prev.panY : 0
        return {
          scopeKey,
          zoom: Math.max(0.35, Math.min(6, Number((baseZ * factor).toFixed(3)))),
          panX: px,
          panY: py,
        }
      })
    },
    [scopeKey]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      adjustZoom(e.deltaY < 0 ? 1.12 : 0.89)
    },
    [adjustZoom]
  )

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
      moved: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const st = dragStateRef.current
    if (!st || !st.active) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      st.moved = true
      const rect = containerRef.current?.getBoundingClientRect()
      const svgRatio = rect ? sceneBounds.w / Math.max(1, rect.width) / zoom : 1
      setViewState({
        scopeKey,
        zoom,
        panX: st.origPanX - dx * svgRatio,
        panY: st.origPanY - dy * svgRatio,
      })
    }
  }

  const handlePointerUp = () => {
    const st = dragStateRef.current
    dragStateRef.current = null
    if (st && !st.moved) {
      // Background click clears selection if not stopped by a bay click
    }
  }

  // Dynamic zoomed/panned viewBox
  const vbW = sceneBounds.w / zoom
  const vbH = sceneBounds.h / zoom
  const vbX = sceneBounds.x + (sceneBounds.w - vbW) / 2 + pan.x
  const vbY = sceneBounds.y + (sceneBounds.h - vbH) / 2 + pan.y

  const ey = (affIn: number) => (maxCeilingIn - affIn) * S

  // Resolve North, South, and Island walls for synced Room Plan rendering
  const northWall = room.walls.find((w) => w.id === 'N')
  const southWall = room.walls.find((w) => w.id === 'S')
  const islandWall = room.walls.find((w) => w.id === 'Island')
  const northLayout = useMemo(
    () => (northWall ? computeWallLayout(matrix, northWall) : null),
    [matrix, northWall]
  )
  const southLayout = useMemo(
    () => (southWall ? computeWallLayout(matrix, southWall) : null),
    [matrix, southWall]
  )
  const islandLayout = useMemo(
    () => (islandWall ? computeWallLayout(matrix, islandWall) : null),
    [matrix, islandWall]
  )

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-w-0 min-h-0 bg-bh-black relative overflow-hidden"
    >
      {/* Center Stage Sub-Toolbar: Wall Tabs + View Layout + Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bh-border bg-bh-panel px-3 py-2 shrink-0">
        {/* Wall Selector Tabs + Back to Whole-House Plan Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="Room Walls">
          <button
            type="button"
            data-testid="btn-back-whole-house"
            onClick={() => onChangeLayoutMode('house')}
            className="rounded-md border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-light hover:bg-gold/20 transition-colors whitespace-nowrap"
          >
            ← Whole House
          </button>
          {room.walls.map((w) => {
            const active = w.id === wall.id
            const effW = getEffectiveWallWidth(matrix, w)
            return (
              <button
                key={w.id}
                type="button"
                data-testid={`wall-tab-${w.id}`}
                onClick={() => onChangeWall(w.id)}
                className={
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ' +
                  (active
                    ? 'bg-gold text-slate-950 font-semibold shadow-sm'
                    : 'bg-bh-card text-slate-300 hover:text-white border border-bh-border')
                }
              >
                {w.shortLabel}
                <span className={active ? 'ml-1.5 text-slate-900/80 font-mono text-[10px]' : 'ml-1.5 text-slate-500 font-mono text-[10px]'}>
                  {formatArchInches(effW)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Layout Mode + Zoom Controls */}
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
                  'rounded-md px-2 py-0.5 transition-colors ' +
                  (layoutMode === m.id
                    ? 'bg-bh-card text-white font-medium'
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
              onClick={() => adjustZoom(0.85)}
              className="px-2 py-1 hover:text-white"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              className="px-2 py-1 font-mono text-[11px] border-x border-bh-border hover:text-white"
              title="Fit drawing to stage"
            >
              {zoom === 1 && pan.x === 0 && pan.y === 0 ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(1.18)}
              className="px-2 py-1 hover:text-white"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Hardware-Accelerated Interactive Vector Stage */}
      <div className="flex-1 min-h-0 relative">
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => {
            if (!dragStateRef.current?.moved) onSelectBay(null)
          }}
          className="w-full h-full block select-none cursor-grab active:cursor-grabbing"
          style={{ background: palette.bg }}
          role="img"
          aria-label={`${room.number} ${room.name} — ${wall.title}`}
        >
          <defs>
            {/* 12" & 48" Architectural CAD Grid */}
            <pattern
              id="cad-grid-minor"
              width={12 * S}
              height={12 * S}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${12 * S} 0 L 0 0 0 ${12 * S}`}
                fill="none"
                stroke={palette.gridMinor}
                strokeWidth="0.8"
              />
            </pattern>
            <pattern
              id="cad-grid-major"
              width={48 * S}
              height={48 * S}
              patternUnits="userSpaceOnUse"
            >
              <rect width={48 * S} height={48 * S} fill="url(#cad-grid-minor)" />
              <path
                d={`M ${48 * S} 0 L 0 0 0 ${48 * S}`}
                fill="none"
                stroke={palette.gridMajor}
                strokeWidth="1"
              />
            </pattern>

            {/* 45° Architectural Cut-Wall Poche Hatch */}
            <pattern
              id="cad-wall-poche"
              width="10"
              height="10"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="10" height="10" fill={palette.pocheBg} />
              <line x1="0" y1="0" x2="0" y2="10" stroke={palette.pocheLine} strokeWidth="1.2" />
            </pattern>

            {/* Coursed Limestone / Ashlar Fireplace Stone Pattern */}
            <pattern
              id="cad-stone-hatch"
              width="64"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="16" x2="64" y2="16" stroke={palette.stoneJoint} strokeWidth="0.7" opacity="0.55" />
              <line x1="0" y1="32" x2="64" y2="32" stroke={palette.stoneJoint} strokeWidth="0.7" opacity="0.55" />
              <line x1="22" y1="0" x2="22" y2="16" stroke={palette.stoneJoint} strokeWidth="0.65" opacity="0.45" />
              <line x1="54" y1="0" x2="54" y2="16" stroke={palette.stoneJoint} strokeWidth="0.65" opacity="0.45" />
              <line x1="38" y1="16" x2="38" y2="32" stroke={palette.stoneJoint} strokeWidth="0.65" opacity="0.45" />
            </pattern>

            {/* Firebox Herringbone Brick Pattern */}
            <pattern
              id="cad-firebrick-hatch"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="12" height="12" fill={palette.bg} />
              <path
                d="M 0 6 L 6 0 L 12 6 M 0 12 L 6 6 L 12 12"
                fill="none"
                stroke={palette.fineStroke}
                strokeWidth="0.75"
                opacity="0.55"
              />
            </pattern>
          </defs>

          {/* CAD Sheet Background Grid */}
          <rect
            x={vbX - 2000}
            y={vbY - 2000}
            width={vbW + 4000}
            height={vbH + 4000}
            fill="url(#cad-grid-major)"
          />

          {/* ============================================================== */}
          {/* TOP VIEW: ARCHITECTURAL INTERIOR ELEVATION                     */}
          {/* ============================================================== */}
          {layoutMode !== 'plan' && (
            <g id="elevation-view">
              {/* CAD Sheet Drawing Title Callout */}
              <g transform="translate(0, -34)" className="pointer-events-none">
                <circle
                  cx="-16"
                  cy="-4"
                  r="11"
                  fill="none"
                  stroke={palette.cutStroke}
                  strokeWidth="1.4"
                />
                <text
                  x="-16"
                  y="0"
                  textAnchor="middle"
                  fill={palette.titleText}
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  A1
                </text>
                <text
                  x="2"
                  y="-6"
                  fill={palette.titleText}
                  fontSize="13"
                  fontWeight="700"
                  letterSpacing="0.8"
                  fontFamily="var(--font-sans), sans-serif"
                >
                  {room.number} {room.name.toUpperCase()} — {wall.title.toUpperCase()}
                </text>
                <text
                  x="2"
                  y="9"
                  fill={palette.subText}
                  fontSize="9.5"
                  fontFamily="ui-monospace, monospace"
                >
                  SCALE: 1/2&quot; = 1&apos;-0&quot; · CLEAR SPAN: {formatArchInches(clearWidthIn)} ·{' '}
                  {room.ceilingLabel.toUpperCase()}
                </text>
              </g>

              {/* Cut Wall Left & Right Poche Jambs + Ceiling/Slab Poche */}
              {wall.id !== 'Island' && (
                <g className="pointer-events-none">
                  <rect
                    x={-wallThkPx}
                    y={wall.vaulted ? ey(wall.vaulted.lowIn) : 0}
                    width={wallThkPx}
                    height={elevH - (wall.vaulted ? ey(wall.vaulted.lowIn) : 0) + 14}
                    fill="url(#cad-wall-poche)"
                    stroke={palette.cutStroke}
                    strokeWidth="1.6"
                  />
                  <rect
                    x={elevW}
                    y={wall.vaulted ? ey(wall.vaulted.lowIn) : 0}
                    width={wallThkPx}
                    height={elevH - (wall.vaulted ? ey(wall.vaulted.lowIn) : 0) + 14}
                    fill="url(#cad-wall-poche)"
                    stroke={palette.cutStroke}
                    strokeWidth="1.6"
                  />
                </g>
              )}

              {/* Room Clear Boundary Polygon (Supports Flat or 1:12 Vaulted T&G Ceiling w/ W12X16 Beam!) */}
              {wall.vaulted ? (
                <g className="pointer-events-none">
                  {/* White Oak T&G Rafter/Ceiling Band */}
                  <polygon
                    points={`${-wallThkPx},${ey(wall.vaulted.lowIn + 10)} ${elevW / 2},${ey(wall.vaulted.highIn + 10)} ${elevW + wallThkPx},${ey(wall.vaulted.lowIn + 10)} ${elevW + wallThkPx},${ey(wall.vaulted.lowIn)} ${elevW / 2},${ey(wall.vaulted.highIn)} ${-wallThkPx},${ey(wall.vaulted.lowIn)}`}
                    fill={palette.oakFill}
                    stroke={palette.cutStroke}
                    strokeWidth="1.6"
                  />
                  {/* Room Wall Surface */}
                  <polygon
                    points={`0,${elevH} 0,${ey(wall.vaulted.lowIn)} ${elevW / 2},0 ${elevW},${ey(wall.vaulted.lowIn)} ${elevW},${elevH}`}
                    fill={palette.bg}
                    stroke={palette.cutStroke}
                    strokeWidth="2.4"
                  />
                  {/* Authentic W12X16 Steel Wide-Flange Ridge I-Beam Section at Apex */}
                  {(() => {
                    const bx = elevW / 2
                    const bw = 5 * S
                    const bh = 12 * S
                    const by = 2
                    return (
                      <g>
                        <rect
                          x={bx - bw / 2 - 3}
                          y={by}
                          width={bw + 6}
                          height={bh + 4}
                          fill={palette.bg}
                        />
                        {/* Top Flange, Web, Bottom Flange */}
                        <rect x={bx - bw / 2} y={by} width={bw} height={4} fill={palette.steelFill} stroke={palette.cutStroke} strokeWidth="1" />
                        <rect x={bx - 2} y={by + 4} width={4} height={bh - 8} fill={palette.steelFill} stroke={palette.cutStroke} strokeWidth="1" />
                        <rect x={bx - bw / 2} y={by + bh - 4} width={bw} height={4} fill={palette.steelFill} stroke={palette.cutStroke} strokeWidth="1" />
                        <text
                          x={bx + bw / 2 + 8}
                          y={by + bh / 2 + 3}
                          fill={palette.subText}
                          fontSize="9"
                          fontWeight="600"
                          fontFamily="ui-monospace, monospace"
                        >
                          {wall.vaulted.beamLabel} · {wall.vaulted.slopeLabel}
                        </text>
                      </g>
                    )
                  })()}
                </g>
              ) : (
                <rect
                  x={0}
                  y={0}
                  width={elevW}
                  height={elevH}
                  fill={palette.bg}
                  stroke={palette.cutStroke}
                  strokeWidth="2.4"
                  className="pointer-events-none"
                />
              )}

              {/* Heavy Floor Slab Cut Line */}
              <line
                x1={-wallThkPx - 14}
                y1={elevH}
                x2={elevW + wallThkPx + 14}
                y2={elevH}
                stroke={palette.cutStroke}
                strokeWidth="2.8"
              />

              {/* Horizontal Architectural Datum Reference Lines */}
              {showDatums &&
                room.datums.map((d) => {
                  if (d.affIn > maxCeilingIn) return null
                  const dy = ey(d.affIn)
                  return (
                    <g key={d.id} className="pointer-events-none">
                      <line
                        x1={0}
                        y1={dy}
                        x2={elevW + wallThkPx + 22}
                        y2={dy}
                        stroke={palette.datumStroke}
                        strokeWidth="0.85"
                        strokeDasharray="6 4"
                        opacity="0.78"
                      />
                      {/* CAD Datum Target Symbol on Right Margin */}
                      <circle
                        cx={elevW + wallThkPx + 30}
                        cy={dy}
                        r="5.5"
                        fill={palette.bg}
                        stroke={palette.datumStroke}
                        strokeWidth="1"
                      />
                      <path
                        d={`M ${elevW + wallThkPx + 24.5} ${dy} L ${elevW + wallThkPx + 35.5} ${dy} M ${elevW + wallThkPx + 30} ${dy - 5.5} L ${elevW + wallThkPx + 30} ${dy + 5.5}`}
                        stroke={palette.datumStroke}
                        strokeWidth="0.8"
                      />
                      <text
                        x={elevW + wallThkPx + 40}
                        y={dy + 3}
                        fill={palette.datumText}
                        fontSize="9"
                        fontWeight="600"
                        fontFamily="ui-monospace, monospace"
                      >
                        {d.label}
                      </text>
                    </g>
                  )
                })}

              {/* Left & Right Wall Scribe Hatch Fillers when Casework Wall */}
              {wall.isCaseworkWall !== false && layout.leftScribeIn > 0 && (
                <g className="pointer-events-none">
                  <rect
                    x={0}
                    y={ey(36)}
                    width={layout.leftScribeIn * S}
                    height={36 * S}
                    fill={palette.oakFill}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.8"
                  />
                  <rect
                    x={(clearWidthIn - layout.rightScribeIn) * S}
                    y={ey(36)}
                    width={layout.rightScribeIn * S}
                    height={36 * S}
                    fill={palette.oakFill}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.8"
                  />
                </g>
              )}

              {/* Render Every Parametric Casework / Opening Bay */}
              {layout.placements.map((placement) => (
                <ElevationBayGraphic
                  key={placement.bay.id}
                  placement={placement}
                  wall={wall}
                  clearWidthIn={clearWidthIn}
                  maxCeilingIn={maxCeilingIn}
                  palette={palette}
                  isSelected={selectedBayId === placement.bay.id}
                  isHovered={hoveredBayId === placement.bay.id}
                  onSelect={(id) => onSelectBay(id)}
                  onHover={setHoveredBayId}
                />
              ))}

              {/* Architectural Dimension Chains (1/2"-snapped Bay Chain + Overall Clear Span + Height Chain) */}
              {showDimensions && (
                <g>
                  {/* Tier 1: Left Scribe + Individual Bays + Right Scribe */}
                  {layout.leftScribeIn > 0 && (
                    <DimHorizontal
                      x1={0}
                      x2={layout.leftScribeIn * S}
                      y={elevH + 30}
                      refY={elevH}
                      label={formatInchesOnly(layout.leftScribeIn)}
                      palette={palette}
                    />
                  )}
                  {layout.placements.map((p) => (
                    <DimHorizontal
                      key={`dim-${p.bay.id}`}
                      x1={p.xStartIn * S}
                      x2={p.xEndIn * S}
                      y={elevH + 30}
                      refY={elevH}
                      label={formatArchInches(p.bay.widthIn)}
                      palette={palette}
                    />
                  ))}
                  {layout.rightScribeIn > 0 && (
                    <DimHorizontal
                      x1={(clearWidthIn - layout.rightScribeIn) * S}
                      x2={elevW}
                      y={elevH + 30}
                      refY={elevH}
                      label={formatInchesOnly(layout.rightScribeIn)}
                      palette={palette}
                    />
                  )}

                  {/* Tier 2: Overall Clear Wall Width */}
                  <DimHorizontal
                    x1={0}
                    x2={elevW}
                    y={elevH + 58}
                    refY={elevH + 30}
                    label={`${formatArchInches(clearWidthIn)} CLEAR`}
                    palette={palette}
                    bold
                  />

                  {/* Left Margin Vertical Ceiling Dimension */}
                  <DimVertical
                    x={-wallThkPx - 36}
                    y1={wall.vaulted ? ey(wall.vaulted.lowIn) : 0}
                    y2={elevH}
                    refX={-wallThkPx}
                    label={
                      wall.vaulted
                        ? `${formatArchInches(wall.vaulted.lowIn)} EAVE`
                        : `${formatArchInches(wall.ceilingHeightIn)} CLG`
                    }
                    palette={palette}
                  />
                  {wall.vaulted && (
                    <DimVertical
                      x={-wallThkPx - 66}
                      y1={0}
                      y2={elevH}
                      refX={0}
                      label={`${formatArchInches(wall.vaulted.highIn)} RIDGE`}
                      palette={palette}
                    />
                  )}
                </g>
              )}
            </g>
          )}

          {/* ============================================================== */}
          {/* BOTTOM VIEW: SYNCED ARCHITECTURAL D2 ROOM PLAN                 */}
          {/* ============================================================== */}
          {layoutMode !== 'elevation' && (
            <g id="room-plan-view" transform={`translate(${planOffsetX}, ${planOriginY})`}>
              {/* Plan Section Title */}
              <g transform="translate(0, -26)" className="pointer-events-none">
                <circle
                  cx="-16"
                  cy="-4"
                  r="11"
                  fill="none"
                  stroke={palette.cutStroke}
                  strokeWidth="1.4"
                />
                <text
                  x="-16"
                  y="0"
                  textAnchor="middle"
                  fill={palette.titleText}
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  P1
                </text>
                <text
                  x="2"
                  y="-4"
                  fill={palette.titleText}
                  fontSize="12"
                  fontWeight="700"
                  letterSpacing="0.8"
                >
                  {room.number} {room.name.toUpperCase()} — ENLARGED ARCHITECTURAL PLAN (BAY DIVIDERS SHOWN)
                </text>
              </g>

              {/* Vertical Projection Witness Lines linking Selected Bay from Elevation down to Plan! */}
              {layoutMode === 'split' &&
                (wall.id === 'N' || wall.id === 'S') &&
                selectedBayId &&
                (() => {
                  const sel = layout.placements.find((p) => p.bay.id === selectedBayId)
                  if (!sel) return null
                  return (
                    <g stroke={palette.selectStroke} strokeWidth="0.9" strokeDasharray="5 5" opacity="0.55">
                      <line x1={sel.xStartIn * S} y1={-splitGapY + 62} x2={sel.xStartIn * S} y2={0} />
                      <line x1={sel.xEndIn * S} y1={-splitGapY + 62} x2={sel.xEndIn * S} y2={0} />
                    </g>
                  )
                })()}

              {/* Double-Line Perimeter Cut Walls w/ 45° Poche */}
              <rect
                x={-wallThkPx}
                y={-wallThkPx}
                width={planW + wallThkPx * 2}
                height={planD + wallThkPx * 2}
                fill="url(#cad-wall-poche)"
                stroke={palette.cutStroke}
                strokeWidth="2"
              />
              <rect
                x={0}
                y={0}
                width={planW}
                height={planD}
                fill={palette.bg}
                stroke={palette.cutStroke}
                strokeWidth="2.2"
              />

              {/* Highlight Shared Flex Partition when viewing Bath 2 (East wall) or Bed 4 (West wall) */}
              {room.flexPlanBinding && (
                <g className="pointer-events-none">
                  <rect
                    x={room.flexPlanBinding.role === 'expand_east' ? planW : -wallThkPx}
                    y={-wallThkPx}
                    width={wallThkPx}
                    height={planD + wallThkPx * 2}
                    fill="rgba(245, 158, 11, 0.28)"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* North Wall Casework Plan Footprints + Crisp Bay Divider Lines */}
              {northLayout &&
                northLayout.placements.map((p) => {
                  const bx = p.xStartIn * S
                  const bw = p.bay.widthIn * S
                  const bd = p.bay.depthIn * S
                  const isSel = selectedBayId === p.bay.id
                  const isHov = hoveredBayId === p.bay.id

                  if (p.bay.kind === 'fireplace_chase') {
                    const studDepth = 6 * S // 6" steel-stud framed stone chase
                    const hearthD = 20 * S // 18"–20" hearth projection
                    const fbW = Math.min(bw - 24, 42 * S)
                    return (
                      <g
                        key={`plan-n-${p.bay.id}`}
                        data-testid={`plan-bay-${p.bay.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectBay(p.bay.id)
                        }}
                        onMouseEnter={() => setHoveredBayId(p.bay.id)}
                        onMouseLeave={() => setHoveredBayId(null)}
                        className="cursor-pointer"
                      >
                        {/* 18" Raised Hearth Footprint */}
                        <rect
                          x={bx}
                          y={0}
                          width={bw}
                          height={hearthD}
                          fill={palette.stoneFill}
                          stroke={palette.primaryStroke}
                          strokeWidth="1.2"
                        />
                        {/* 6" Steel-Stud Framed Chase w/ 16" O.C. Stud Ticks */}
                        <rect
                          x={bx}
                          y={0}
                          width={bw}
                          height={studDepth}
                          fill="url(#cad-wall-poche)"
                          stroke={palette.cutStroke}
                          strokeWidth="1.6"
                        />
                        {Array.from({ length: Math.floor(p.bay.widthIn / 16) }, (_, idx) => {
                          const sx = bx + (idx + 1) * 16 * S
                          if (sx >= bx + bw - 8) return null
                          return (
                            <rect
                              key={idx}
                              x={sx - 2}
                              y={2}
                              width={4}
                              height={studDepth - 4}
                              fill={palette.bg}
                              stroke={palette.fineStroke}
                              strokeWidth="0.8"
                            />
                          )
                        })}
                        {/* Firebox Recess in Plan */}
                        <rect
                          x={bx + bw / 2 - fbW / 2}
                          y={-wallThkPx * 0.5}
                          width={fbW}
                          height={studDepth + wallThkPx * 0.5}
                          fill={palette.bg}
                          stroke={palette.cutStroke}
                          strokeWidth="1.4"
                        />
                        {/* Dashed 72"x8" Mantel Projection */}
                        <line
                          x1={bx + bw / 2 - Math.min(bw / 2 - 4, 36 * S)}
                          y1={studDepth + 8 * S}
                          x2={bx + bw / 2 + Math.min(bw / 2 - 4, 36 * S)}
                          y2={studDepth + 8 * S}
                          stroke={palette.dashedStroke}
                          strokeWidth="0.9"
                          strokeDasharray="5 3"
                        />
                        {(isSel || isHov) && (
                          <rect
                            x={bx}
                            y={0}
                            width={bw}
                            height={hearthD}
                            fill={isSel ? palette.selectFill : 'transparent'}
                            stroke={isSel ? palette.selectStroke : palette.hoverStroke}
                            strokeWidth="2"
                          />
                        )}
                      </g>
                    )
                  }

                  if (p.bay.kind === 'window') {
                    return (
                      <g key={`plan-n-${p.bay.id}`}>
                        <rect
                          x={bx}
                          y={-wallThkPx}
                          width={bw}
                          height={wallThkPx}
                          fill={palette.bg}
                          stroke={palette.cutStroke}
                          strokeWidth="1.3"
                        />
                        <line
                          x1={bx}
                          y1={-wallThkPx / 2}
                          x2={bx + bw}
                          y2={-wallThkPx / 2}
                          stroke={palette.glassGlint}
                          strokeWidth="1.4"
                        />
                      </g>
                    )
                  }

                  if (p.bay.kind === 'wet_room_glass') {
                    const doorW = Math.min(bw * 0.45, 28 * S)
                    return (
                      <g
                        key={`plan-n-${p.bay.id}`}
                        data-testid={`plan-bay-${p.bay.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectBay(p.bay.id)
                        }}
                        className="cursor-pointer"
                      >
                        <rect
                          x={bx}
                          y={0}
                          width={bw}
                          height={bd}
                          fill={palette.glassFill}
                          stroke={palette.fineStroke}
                          strokeWidth="1"
                        />
                        {/* 18" Steam Bench along East Wall */}
                        <rect
                          x={bx + bw - 18 * S}
                          y={0}
                          width={18 * S}
                          height={bd}
                          fill={palette.slabFill}
                          stroke={palette.primaryStroke}
                          strokeWidth="1.1"
                        />
                        {/* 14" Recessed Wall Niche in North Wall Poche */}
                        <rect
                          x={bx + bw * 0.22}
                          y={-12}
                          width={14 * S}
                          height={12}
                          fill={palette.bg}
                          stroke={palette.primaryStroke}
                          strokeWidth="1.1"
                        />
                        {/* 1/8" Glass Enclosure Line + Hinged 28" Steam Door Swing Arc */}
                        <line
                          x1={bx + doorW}
                          y1={bd}
                          x2={bx + bw}
                          y2={bd}
                          stroke={palette.cutStroke}
                          strokeWidth="2.2"
                        />
                        <line
                          x1={bx}
                          y1={bd}
                          x2={bx}
                          y2={bd + doorW}
                          stroke={palette.cutStroke}
                          strokeWidth="1.6"
                        />
                        <path
                          d={`M ${bx + doorW} ${bd} A ${doorW} ${doorW} 0 0 1 ${bx} ${bd + doorW}`}
                          fill="none"
                          stroke={palette.dashedStroke}
                          strokeWidth="0.9"
                          strokeDasharray="4 3"
                        />
                        {/* Linear Drain */}
                        <circle
                          cx={bx + bw * 0.36}
                          cy={bd * 0.5}
                          r="6"
                          fill="none"
                          stroke={palette.fineStroke}
                          strokeWidth="1"
                        />
                      </g>
                    )
                  }

                  return (
                    <g
                      key={`plan-n-${p.bay.id}`}
                      data-testid={`plan-bay-${p.bay.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectBay(p.bay.id)
                      }}
                      onMouseEnter={() => setHoveredBayId(p.bay.id)}
                      onMouseLeave={() => setHoveredBayId(null)}
                      className="cursor-pointer"
                    >
                      {/* Casework Bay Footprint WITH Bay Divider Lines! */}
                      <rect
                        x={bx}
                        y={0}
                        width={bw}
                        height={bd}
                        fill={isSel ? palette.selectFill : palette.oakFill}
                        stroke={isSel ? palette.selectStroke : palette.primaryStroke}
                        strokeWidth={isSel ? '2' : '1.25'}
                      />

                      {/* Dashed 12" Upper / Floating Shelf Line inside Base */}
                      {p.bay.kind === 'floating_shelves' && (
                        <line
                          x1={bx}
                          y1={12 * S}
                          x2={bx + bw}
                          y2={12 * S}
                          stroke={palette.dashedStroke}
                          strokeWidth="0.95"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Undermount Sink Bowl + Drain + Faucet in Plan */}
                      {p.bay.kind === 'sink_base' && (
                        <g>
                          <rect
                            x={bx + bw / 2 - Math.min(bw * 0.34, 38)}
                            y={14}
                            width={Math.min(bw * 0.68, 76)}
                            height={bd - 24}
                            rx="5"
                            fill={palette.bg}
                            stroke={palette.primaryStroke}
                            strokeWidth="1.1"
                          />
                          <circle
                            cx={bx + bw / 2}
                            cy={bd * 0.45}
                            r="3.5"
                            fill="none"
                            stroke={palette.fineStroke}
                            strokeWidth="0.9"
                          />
                          <line
                            x1={bx + bw / 2}
                            y1={5}
                            x2={bx + bw / 2}
                            y2={22}
                            stroke={palette.cutStroke}
                            strokeWidth="1.8"
                          />
                        </g>
                      )}

                      {/* 6-Burner Pro Range Grid in Plan */}
                      {p.bay.kind === 'range_hood' &&
                        [0.2, 0.5, 0.8].map((rx) =>
                          [0.32, 0.7].map((ry) => (
                            <circle
                              key={`${rx}-${ry}`}
                              cx={bx + bw * rx}
                              cy={bd * ry}
                              r="8"
                              fill="none"
                              stroke={palette.primaryStroke}
                              strokeWidth="1.1"
                            />
                          ))
                        )}

                      {/* Closet Hanger Rod Line in Plan */}
                      {(p.bay.kind === 'closet_double_hang' ||
                        p.bay.kind === 'closet_long_hang') && (
                        <line
                          x1={bx + 3}
                          y1={bd * 0.55}
                          x2={bx + bw - 3}
                          y2={bd * 0.55}
                          stroke={palette.dashedStroke}
                          strokeWidth="1"
                          strokeDasharray="4 2"
                        />
                      )}
                    </g>
                  )
                })}

              {/* Left & Right Scribe Blocks in North Wall Plan */}
              {northLayout && northWall?.isCaseworkWall !== false && northLayout.leftScribeIn > 0 && (
                <g className="pointer-events-none">
                  <rect
                    x={0}
                    y={0}
                    width={northLayout.leftScribeIn * S}
                    height={21 * S}
                    fill={palette.oakFill}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.8"
                  />
                  <rect
                    x={(northLayout.clearWidthIn - northLayout.rightScribeIn) * S}
                    y={0}
                    width={northLayout.rightScribeIn * S}
                    height={21 * S}
                    fill={palette.oakFill}
                    stroke={palette.dashedStroke}
                    strokeWidth="0.8"
                  />
                </g>
              )}

              {/* South Wall Openings / Casework in Plan (Accordion Door, WC, Wardrobe, etc.) */}
              {southLayout &&
                southLayout.placements.map((p) => {
                  const bx = p.xStartIn * S
                  const bw = p.bay.widthIn * S
                  const bd = p.bay.depthIn * S
                  if (p.bay.kind === 'accordion_door') {
                    return (
                      <g key={`plan-s-${p.bay.id}`} className="pointer-events-none">
                        <rect
                          x={bx}
                          y={planD - 2}
                          width={bw}
                          height={wallThkPx + 4}
                          fill={palette.bg}
                        />
                        {/* 4-Panel Bi-Fold Accordion Zig-Zag Symbol */}
                        <polyline
                          points={`${bx},${planD + wallThkPx / 2} ${bx + bw * 0.12},${planD + wallThkPx + 24} ${bx + bw * 0.25},${planD + wallThkPx / 2} ${bx + bw * 0.38},${planD + wallThkPx + 24} ${bx + bw * 0.5},${planD + wallThkPx / 2} ${bx + bw},${planD + wallThkPx / 2}`}
                          fill="none"
                          stroke={palette.cutStroke}
                          strokeWidth="1.5"
                        />
                      </g>
                    )
                  }
                  if (p.bay.kind === 'toilet_bay') {
                    const tcx = bx + bw / 2
                    return (
                      <g key={`plan-s-${p.bay.id}`} className="pointer-events-none">
                        <rect
                          x={tcx - 18}
                          y={planD - 9 * S}
                          width={36}
                          height={9 * S}
                          rx="2"
                          fill={palette.bg}
                          stroke={palette.cutStroke}
                          strokeWidth="1.2"
                        />
                        <ellipse
                          cx={tcx}
                          cy={planD - 18 * S}
                          rx="15"
                          ry="22"
                          fill={palette.bg}
                          stroke={palette.cutStroke}
                          strokeWidth="1.2"
                        />
                      </g>
                    )
                  }
                  if (p.bay.kind === 'door') {
                    const leaf = Math.min(bw, 36 * S)
                    return (
                      <g key={`plan-s-${p.bay.id}`} className="pointer-events-none">
                        <rect
                          x={bx}
                          y={planD - 2}
                          width={bw}
                          height={wallThkPx + 4}
                          fill={palette.bg}
                        />
                        {p.bay.widthIn <= 48 && (
                          <>
                            <line
                              x1={bx}
                              y1={planD}
                              x2={bx}
                              y2={planD - leaf}
                              stroke={palette.cutStroke}
                              strokeWidth="1.8"
                            />
                            <path
                              d={`M ${bx + leaf} ${planD} A ${leaf} ${leaf} 0 0 0 ${bx} ${planD - leaf}`}
                              fill="none"
                              stroke={palette.dashedStroke}
                              strokeWidth="0.9"
                              strokeDasharray="4 3"
                            />
                          </>
                        )}
                      </g>
                    )
                  }
                  if (p.bay.kind === 'window') {
                    return (
                      <g key={`plan-s-${p.bay.id}`} className="pointer-events-none">
                        <rect
                          x={bx}
                          y={planD}
                          width={bw}
                          height={wallThkPx}
                          fill={palette.bg}
                          stroke={palette.cutStroke}
                          strokeWidth="1.2"
                        />
                        <line
                          x1={bx}
                          y1={planD + wallThkPx / 2}
                          x2={bx + bw}
                          y2={planD + wallThkPx / 2}
                          stroke={palette.glassGlint}
                          strokeWidth="1.4"
                        />
                      </g>
                    )
                  }
                  return (
                    <rect
                      key={`plan-s-${p.bay.id}`}
                      x={bx}
                      y={planD - bd}
                      width={bw}
                      height={bd}
                      fill={palette.oakFill}
                      stroke={palette.primaryStroke}
                      strokeWidth="1.15"
                    />
                  )
                })}

              {/* Center Island in Plan w/ Bay Dividers, Stools & Real Clear Aisle Dimension! */}
              {room.island &&
                (() => {
                  const iw = room.island.widthIn * S
                  const id = room.island.depthIn * S
                  const ix = (planW - iw) / 2
                  const northCaseworkDepthIn = northWall?.bays[0]?.depthIn ?? 24
                  const iy = (northCaseworkDepthIn + room.island.aisleNorthIn) * S
                  return (
                    <g>
                      {/* Island Slab Perimeter */}
                      <rect
                        x={ix}
                        y={iy}
                        width={iw}
                        height={id}
                        fill={palette.slabFill}
                        stroke={palette.cutStroke}
                        strokeWidth="1.7"
                      />
                      {/* Island Base Bays w/ Divider Lines */}
                      {islandLayout &&
                        islandLayout.placements.map((ip) => {
                          const bx = ix + ip.xStartIn * S
                          const bw = ip.bay.widthIn * S
                          const bd = ip.bay.depthIn * S
                          const isSel = selectedBayId === ip.bay.id
                          return (
                            <g
                              key={ip.bay.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectBay(ip.bay.id)
                              }}
                              className="cursor-pointer"
                            >
                              <rect
                                x={bx}
                                y={iy}
                                width={bw}
                                height={bd}
                                fill={isSel ? palette.selectFill : palette.oakFill}
                                stroke={isSel ? palette.selectStroke : palette.primaryStroke}
                                strokeWidth="1.15"
                              />
                              {ip.bay.kind === 'sink_base' && (
                                <g>
                                  <rect
                                    x={bx + 18}
                                    y={iy + 14}
                                    width={bw - 36}
                                    height={bd - 26}
                                    rx="4"
                                    fill={palette.bg}
                                    stroke={palette.primaryStroke}
                                    strokeWidth="1.1"
                                  />
                                  <circle
                                    cx={bx + bw / 2}
                                    cy={iy + bd / 2}
                                    r="4"
                                    fill="none"
                                    stroke={palette.fineStroke}
                                    strokeWidth="0.9"
                                  />
                                </g>
                              )}
                            </g>
                          )
                        })}

                      {/* Dashed Overhang Line + Counter Stools */}
                      {room.island.overhangSouthIn > 0 && (
                        <line
                          x1={ix}
                          y1={iy + id - room.island.overhangSouthIn * S}
                          x2={ix + iw}
                          y2={iy + id - room.island.overhangSouthIn * S}
                          stroke={palette.dashedStroke}
                          strokeWidth="0.95"
                          strokeDasharray="5 3"
                        />
                      )}
                      {Array.from({ length: room.island.stoolsCount }, (_, sIdx) => {
                        const sx =
                          ix +
                          ((sIdx + 0.5) * iw) / Math.max(1, room.island!.stoolsCount)
                        return (
                          <circle
                            key={sIdx}
                            cx={sx}
                            cy={iy + id + 10}
                            r="18"
                            fill={palette.bg}
                            stroke={palette.fineStroke}
                            strokeWidth="1.05"
                          />
                        )
                      })}

                      {/* Clear Work Aisle Dimension Callout (e.g. 48" CLEAR) */}
                      {showDimensions && (
                        <DimVertical
                          x={ix + iw + 36}
                          y1={northCaseworkDepthIn * S}
                          y2={iy}
                          refX={ix + iw}
                          label={`${formatInchesOnly(room.island.aisleNorthIn)} CLEAR`}
                          palette={palette}
                        />
                      )}
                    </g>
                  )
                })()}

              {/* Room Plan Clear Span Dimensions */}
              {showDimensions && (
                <g>
                  <DimHorizontal
                    x1={0}
                    x2={planW}
                    y={planD + wallThkPx + 32}
                    refY={planD + wallThkPx}
                    label={`${formatArchInches(roomRect.widthIn)} ROOM CLEAR`}
                    palette={palette}
                    bold
                  />
                  <DimVertical
                    x={-wallThkPx - 36}
                    y1={0}
                    y2={planD}
                    refX={-wallThkPx}
                    label={`${formatArchInches(roomRect.depthIn)} DEPTH`}
                    palette={palette}
                  />
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Bottom-Left Subtle Canvas Hint Pill */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-2 rounded-md border border-bh-border/80 bg-bh-black/85 px-2.5 py-1 text-[10px] text-slate-400 backdrop-blur">
          <span>Scroll to zoom · Drag to pan · Click any bay in Elevation or Plan to inspect</span>
        </div>
      </div>
    </div>
  )
}
