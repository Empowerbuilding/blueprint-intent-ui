// Designer Canvas — server-side engine client.
// Talks to Blueprint's canvas_live_server.py (default 127.0.0.1:8787).
// Engine is NOT reachable from the app host until Tony routes it
// (INTENT-CANVAS-TAB-SCOPE.md §1) — every caller must handle the
// offline case gracefully. Never import from client components.

const ENGINE_URL = (process.env.CANVAS_ENGINE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '')
const ENGINE_SECRET = process.env.CANVAS_ENGINE_SECRET || ''

function engineHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  if (ENGINE_SECRET) headers['x-canvas-secret'] = ENGINE_SECRET
  return headers
}

export type EngineResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string }

async function engineFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number },
): Promise<EngineResult<T>> {
  const { method = 'GET', body, timeoutMs = 8000 } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      method,
      headers: engineHeaders(body !== undefined ? { 'content-type': 'application/json' } : undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) {
      let code: string | undefined
      let message = `engine ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: string; code?: string; message?: string }
        message = parsed.error || parsed.message || message
        code = parsed.code
      } catch {
        if (text) message = text.slice(0, 200)
      }
      return { ok: false, status: res.status, error: message, code }
    }
    return { ok: true, data: JSON.parse(text) as T }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return {
      ok: false,
      status: 504,
      error: aborted ? 'engine timeout' : 'engine unreachable',
    }
  } finally {
    clearTimeout(timer)
  }
}

/** GET /api/health — cheap liveness probe for the "engine live/offline" badge. */
export function engineHealth(): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>('/api/health', { timeoutMs: 3000 })
}

/** GET /api/state — full StudioStateV16. */
export function engineState(): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>('/api/state', { timeoutMs: 10000 })
}

/**
 * POST /api/redraw — re-render one room from spec updates.
 * Contract ask #2: frozen rooms must answer { ok:false, code:"room_frozen" }.
 */
export function engineRedraw(body: {
  roomId: string
  specUpdates: Record<string, number | string>
  updateComposite?: boolean
}): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>('/api/redraw', { method: 'POST', body, timeoutMs: 20000 })
}

/** POST /api/redraw-pattern — sub-second pattern re-render. */
export function engineRedrawPattern(body: {
  patternId: string
  overrides: { wallWidthIn?: number; ceilingIn?: number; settings?: Record<string, number | string> }
}): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>('/api/redraw-pattern', {
    method: 'POST',
    body,
    timeoutMs: 15000,
  })
}

/** Contract v2: POST /api/rooms/:id/lock — engine-authoritative freeze/unlock. */
export function engineRoomLock(
  roomId: string,
  status: 'frozen' | 'updated' | 'approved' | 'draft',
  by?: string,
  reason?: string,
): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>(`/api/rooms/${encodeURIComponent(roomId)}/lock`, {
    method: 'POST',
    body: { status, by, reason },
    timeoutMs: 8000,
  })
}

/** Contract v2: GET /api/vectors/:roomId — CAD overlay geometry. */
export function engineVectors(roomId: string): Promise<EngineResult<Record<string, unknown>>> {
  return engineFetch<Record<string, unknown>>(`/api/vectors/${encodeURIComponent(roomId)}`, {
    timeoutMs: 10000,
  })
}

/** GET /sheets/<file> — room PNGs + library_patterns/*.png (binary passthrough). */
export async function engineSheet(
  file: string,
): Promise<
  | { ok: true; body: ArrayBuffer; contentType: string; cacheControl?: string }
  | { ok: false; status: number; error: string }
> {
  const guarded = file.replace(/^\/+/, '')
  if (!guarded || guarded.includes('..') || guarded.includes('\\')) {
    return { ok: false, status: 400, error: 'bad sheet path' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`${ENGINE_URL}/sheets/${guarded}`, {
      headers: engineHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, status: res.status, error: `sheet fetch failed (${res.status})` }
    const contentType = res.headers.get('content-type') || 'image/png'
    // Contract v2: engine sends immutable on versioned filenames (_v<N>/_r<N>);
    // forward it so redraws at a NEW filename cache forever and old ones never go stale.
    const rawCache = res.headers.get('cache-control') || ''
    const cacheControl = /immutable/i.test(rawCache)
      ? 'public, max-age=31536000, immutable'
      : rawCache || undefined
    const body = await res.arrayBuffer()
    return { ok: true, body, contentType, cacheControl }
  } catch {
    return { ok: false, status: 504, error: 'engine unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
