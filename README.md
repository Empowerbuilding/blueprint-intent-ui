# blueprint-intent-ui (Design Intent)

The authoring + review surface for Blueprint D2 intent contracts. Humans confirm what they mean before the AI builds — spec: `plans/work-order-ui/PLAN.md` (in the claw-workspace repo).

**Users:** Mitch + Michael · **Stack:** Next.js 16 + Supabase (Barnhaus Design OS) + Tailwind · **Deploy:** Coolify (pending) → `intent.barnhaussteelbuilders.com`

## What it does
- **Project → room board (B1–B18 + HOUSE)** with a review-state gate: every room must be `confirmed` (or defaults accepted) before Lock & Emit
- **Decisions, one line at a time** — a topic can hold many lines; each is changed, removed or put back on its own, and the earlier wording stays visible
- **Private image stores** — inspo photos and 2D outlines are only reachable through expiring signed links (src/lib/storage.ts)
- **Lessons ledger** — Blueprint proposes what it learned; only an approver (intent_approvers) accepts; Blueprint works from accepted lessons (GET /api/lessons)
- **Editable defaults** — what gets built when nobody decides is data (intent_defaults), changed by an approver, history kept (GET /api/defaults)
- **Capabilities + gap log** — Blueprint reports each machine's bridge build and command list (POST /api/capabilities); gaps are logged and closed by an approver. The app never calls a bridge
- **Rule changes re-check** drawings awaiting review; times show in the viewer's time zone
- **Typed contract (v2)** — written beside the contract at every Lock & Emit, only when nothing is missing: every room has a role and a 2D yes/no, every decision and redline note has a kind of work (`intent_kinds`, a draft list until checked against a live bridge). Gaps are listed on the emit page, never guessed. Contract v1 is unchanged (src/lib/emit-v2.ts, GET /api/contract/[id]?schema=2, GET /api/vocabulary)
- **Model checks** — the checks run on the built model (Rulebook → Model checks). Blueprint proposes; only an approver accepts; only accepted checks are attached to work items (GET /api/model-rules)
- **Open questions** with blocking flag + documented defaults — resolve or accept before lock
- **Typed redline notes** (beam / cabinet_run / delete / move / keep / note) — Michael's D1 markup becomes structured intent
- **Emits** `intent.json` + `BRIEF.md` for Blueprint to compile into a work order (phase 4, pending)

## Env
```
NEXT_PUBLIC_SUPABASE_URL=https://nvsczfrljlovksrdyaix.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```
No service-role key needed — all data flows through authenticated user sessions (RLS: authenticated-only).

## Dev
```
npm i && npm run dev   # http://localhost:3000
```
DB schema: `plans/work-order-ui/schema.sql` in the claw-workspace repo (already applied to Design OS — tables are `intent_*`).

## Checks before pushing
```
npm ci --include=dev
npx tsc --noEmit            # after one `next build` (generates route types)
npx eslint
node scripts/test-libs.mjs  # progress, rule wording/form mapping, diff
sh scripts/smoke/run.sh     # builds, serves every page against a mock backend + fixtures, then drives the server actions
```
The smoke test needs no network and no credentials. It proves pages render and actions send the right changes; it does not prove behaviour against the real database (permissions, cascades, storage policies).

## Layout (2026-11-11 reorganisation)
- **Inbox** `/` — everything waiting on a person, grouped by project
- **Projects** `/projects` — progress is derived from data (`src/lib/progress.ts`), never set by hand; delete lives on the project page
- **Rulebook** `/rulebook/{checks,defaults,standards}` — `/rules` and `/standards` redirect here
- **Blueprint** `/blueprint` — dated feed of what changed

## Model scan → room board (the intake flow)

The room board should be born from the **actual model**, not a template. Before any intent capture, run the intake scan and push it:

```
POST /api/prefill   (header: x-prefill-secret)
{
  "project": {"name": "Whitaker"},
  "rooms": [
    {"section_code": "104", "name": "Kitchen",              // Revit room number + name
     "source": "model_scan", "area_sf": 386.1,
     "model_state": {"windows": 3, "island": true, "casework_runs": 6}}
  ]
}
```

- `section_code` = the Revit **room number**, `name` = the Revit room name — the board mirrors the model 1:1
- `model_state` = whatever the scan knows (counts, existing elements, ceiling state) — rendered per-room and carried into the emitted contract/BRIEF
- Rooms arrive `unreviewed`; transcript decisions + redlines then attach to real rooms
- The standard template (`B1–B18 + HOUSE`) is the fallback for greenfield work with no model yet — don't mix both on one project
- Scanner owner: **Blueprint** — at intake (runbook §0), after the room scan, POST this payload. `scripts/prefill.py` is the reference pusher
