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
  engine's error status/code (HTTP 423 `room_frozen` per contract v2)
- `POST /api/canvas/redraw-pattern` — pattern re-render (`{ patternId, overrides }`)
- `POST /api/canvas/rooms/:id/lock` — engine-authoritative freeze/unfreeze
  (`{ status: frozen|updated|approved|draft }`); the UI unlock/re-freeze buttons call this
- `GET  /api/canvas/vectors/:roomId` — CAD overlay geometry (SVG paths, 1:1 with the
  3200x2240 sheet; elements with `specKey` are click-to-focus)
- `GET  /api/canvas/sheets/<file>` — binary PNG passthrough (rooms + `library_patterns/`),
  traversal-guarded; versioned filenames cache immutable, others 60s

All routes require an authenticated Supabase session (401 otherwise).

## Routing the engine (open item — Tony)

Verified 2026-11-28: `127.0.0.1:8787`, `<host-ip>:8787`, and the docker bridge are all
unreachable from the app container. Options: publish 8787 on the DO host + firewall to
the app container, tunnel from the engine's host, or move the engine to the DO box.
Whichever lands, set `CANVAS_ENGINE_URL` and the tab goes live on next deploy — no code
changes needed.

## Contract status

**Contract v2 shipped by Blueprint 2026-11-28** — all 8 asks live on the engine (`contractVersion: "v2"`):
status/roomVersion on all rooms, HTTP 423 freeze guard + `POST /api/rooms/:id/lock`, room-scoped
fetch, immutable versioned sheet filenames, `x-canvas-secret` enforcement, `GET /api/vectors/:roomId`,
snapshot bundle exported, engine running on the DO host (container `885588b884f3`, needs routing).
This branch is wired for all of it. Snapshot fallback is pending a fetchable URL for the JSON bundle
(engine `/snapshot.json` or the public docs bucket) — then it needs one small code addition here.
Full ask history: portal channel `barnhaus-codie-intent-app` / `INTENT-CANVAS-TAB-SCOPE.md` (Codie workspace).
