# /api/canvas/* — engine proxy notes (for deploy)

The Designer Canvas tab (`/canvas`, `/projects/[id]/canvas`) is live-data UI only —
all real data comes from Blueprint's Python canvas engine (`canvas_live_server.py`,
port 8787) through these session-gated proxy routes. The app never talks to the
engine from the browser.

## Env vars (deploy)

| Var | Required | Purpose |
|---|---|---|
| `CANVAS_ENGINE_URL` | yes, for live data | Base URL of the canvas engine, e.g. `http://<host>:8787`. Defaults to `http://127.0.0.1:8787` (engine currently NOT reachable from the app host — the tab renders an offline panel until this points somewhere reachable). |
| `CANVAS_ENGINE_SECRET` | recommended | Sent as `x-canvas-secret` on every engine call. The engine should enforce the same secret once it is routed anywhere beyond localhost. |

## Routes

- `GET  /api/canvas/health` — liveness probe (powers the "engine live/offline" badge)
- `GET  /api/canvas/state` — full `StudioStateV16` (rooms, library, constraints)
- `POST /api/canvas/redraw` — room re-render (`{ roomId, specUpdates }`); forwards the
  engine's error status/code (e.g. `room_frozen`) so freeze-locking is enforced engine-side
- `POST /api/canvas/redraw-pattern` — pattern re-render (`{ patternId, overrides }`)
- `GET  /api/canvas/sheets/<file>` — binary PNG passthrough (rooms + `library_patterns/`),
  traversal-guarded, `max-age=60` until immutable-versioned filenames are confirmed

All routes require an authenticated Supabase session (401 otherwise).

## Routing the engine (open item — Tony)

Verified 2026-11-28: `127.0.0.1:8787`, `<host-ip>:8787`, and the docker bridge are all
unreachable from the app container. Options: publish 8787 on the DO host + firewall to
the app container, tunnel from the engine's host, or move the engine to the DO box.
Whichever lands, set `CANVAS_ENGINE_URL` and the tab goes live on next deploy — no code
changes needed.

## Contract status

Schema is typed in `src/lib/canvas/types.ts` exactly per Blueprint's StudioStateV16
handoff (2026-11-28). `RoomCanvasEntry.status` / `roomVersion` are optional pending
Blueprint populating them — the UI (lock badges, write-gating) lights up automatically
once the engine sends them. Full ask list: `INTENT-CANVAS-TAB-SCOPE.md` (Codie workspace)
or the portal channel `barnhaus-codie-intent-app`.
