'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as RPointerEvent, ReactNode } from 'react'

// Full-screen drawing viewer for outline review (2026-11-15, mobile-first).
// Tap a drawing -> it fills the screen: pinch to zoom, one finger to pan,
// double-tap toggles zoom, wheel zooms on desktop, Esc / X / tap closes.
// The action forms (approve / reject / undo) are passed in from the server page
// and rendered in a bottom bar, so a reviewer never leaves the zoomed drawing.
// Presentation only — no judgment, no data writes in here.

const MAX_SCALE = 10
const DBL_TAP_MS = 320

type Transform = { s: number; x: number; y: number }
type P = { x0: number; y0: number; x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function OutlineLightbox({
  src,
  alt,
  typeLabel,
  label,
  statusLabel,
  approved,
  actions,
}: {
  src: string
  alt: string
  typeLabel: string
  label?: string | null
  statusLabel: string
  approved: boolean
  actions?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [t, setT] = useState<Transform>({ s: 1, x: 0, y: 0 })
  const [interacting, setInteracting] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const pointers = useRef<Map<number, P>>(new Map())
  const pinch = useRef<{ dist: number; s: number; qx: number; qy: number } | null>(null)
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const moved = useRef(false)
  const lastTap = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = () => {
    setOpen(false)
    setT({ s: 1, x: 0, y: 0 })
  }

  const center = () => {
    const r = stageRef.current?.getBoundingClientRect()
    return { cx: (r?.width ?? 1) / 2, cy: (r?.height ?? 1) / 2 }
  }

  // zoom about a screen point: the image point under (mx,my) stays under it
  const zoomAt = (mx: number, my: number, s2: number, cur: Transform): Transform => {
    const { cx, cy } = center()
    const qx = (mx - cx - cur.x) / cur.s
    const qy = (my - cy - cur.y) / cur.s
    const s = clamp(s2, 1, MAX_SCALE)
    return { s, x: mx - cx - qx * s, y: my - cy - qy * s }
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    pointers.current.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const a = pts[0]
      const b = pts[1]
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const { cx, cy } = center()
      pinch.current = {
        dist,
        s: t.s,
        qx: (midX - cx - t.x) / t.s,
        qy: (midY - cy - t.y) / t.s,
      }
      pan.current = null
    } else if (pointers.current.size === 1 && t.s > 1.001) {
      pan.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y }
    }
    setInteracting(true)
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) moved.current = true
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()]
      const a = pts[0]
      const b = pts[1]
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const { cx, cy } = center()
      const s = clamp(pinch.current.s * (dist / pinch.current.dist), 1, MAX_SCALE)
      setT({ s, x: midX - cx - pinch.current.qx * s, y: midY - cy - pinch.current.qy * s })
    } else if (pointers.current.size === 1 && pan.current) {
      const pb = pan.current
      setT((cur) => ({ s: cur.s, x: pb.tx + (e.clientX - pb.x), y: pb.ty + (e.clientY - pb.y) }))
    }
  }

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 1) {
      // two fingers -> one: continue as pan from here
      const only = [...pointers.current.values()][0]
      pinch.current = null
      pan.current = only && t.s > 1.001 ? { x: only.x, y: only.y, tx: t.x, ty: t.y } : null
    } else if (pointers.current.size === 0) {
      pinch.current = null
      pan.current = null
      setInteracting(false)
      if (t.s <= 1.001) setT({ s: 1, x: 0, y: 0 })
      if (!moved.current) {
        const now = Date.now()
        const isDouble = now - lastTap.current < DBL_TAP_MS
        lastTap.current = now
        if (isDouble) {
          if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
          }
          setT((cur) => (cur.s > 1.001 ? { s: 1, x: 0, y: 0 } : zoomAt(e.clientX, e.clientY, 2.5, cur)))
        } else if (t.s <= 1.001) {
          // single tap at 1x closes — but wait a beat so a double-tap can cancel
          if (e.pointerType === 'mouse') {
            close()
          } else {
            if (closeTimer.current) clearTimeout(closeTimer.current)
            closeTimer.current = setTimeout(close, DBL_TAP_MS + 10)
          }
        }
      }
    }
  }

  // wheel zoom (desktop) — native listener so preventDefault actually applies
  useEffect(() => {
    if (!open) return
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setT((cur) => zoomAt(e.clientX, e.clientY, cur.s * factor, cur))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Esc to close + body scroll lock while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pillTone = approved
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    : 'border-amber-500/30 bg-amber-500/15 text-amber-300'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in"
        title="Open full screen — pinch or scroll to zoom"
        aria-label={'Open ' + alt + ' full screen'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full max-h-[70vh] object-contain" />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] font-medium text-amber-300/90">
          tap to zoom
        </span>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label={typeLabel + ' viewer'}
          >
            {/* top bar */}
            <div
              className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 rounded border border-violet-400/30 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                    {typeLabel}
                  </span>
                  {label ? <span className="text-sm font-medium text-slate-100">{label}</span> : null}
                  <span className={'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + pillTone}>
                    {statusLabel}
                  </span>
                </div>
              </div>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-white/10 px-3.5 py-2.5 text-xs text-slate-300 hover:text-white"
                title="Open the raw PNG in a new tab"
              >
                raw ↗
              </a>
              <button
                type="button"
                onClick={close}
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
                aria-label="Close viewer"
              >
                ✕ Close
              </button>
            </div>

            {/* zoomable stage */}
            <div
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative flex flex-1 touch-none items-center justify-center overflow-hidden overscroll-contain"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`,
                  transition: interacting ? 'none' : 'transform 0.18s ease-out',
                }}
              />
            </div>

            {/* actions — same server forms as the card, thumb-sized placement */}
            {actions ? (
              <div
                className="max-h-[42dvh] overflow-y-auto overscroll-contain border-t border-white/10 bg-bh-black px-3 py-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
              >
                <div className="mx-auto max-w-xl space-y-3">{actions}</div>
              </div>
            ) : null}
          </div>,
          document.body
        )}
    </>
  )
}
