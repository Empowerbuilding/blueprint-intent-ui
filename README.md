# blueprint-intent-ui (Design Intent)

The authoring + review surface for Blueprint D2 intent contracts. Humans confirm what they mean before the AI builds — spec: `plans/work-order-ui/PLAN.md` (in the claw-workspace repo).

**Users:** Mitch + Michael · **Stack:** Next.js 16 + Supabase (Barnhaus Design OS) + Tailwind · **Deploy:** Coolify (pending) → `intent.barnhaussteelbuilders.com`

## What it does
- **Project → room board (B1–B18 + HOUSE)** with a review-state gate: every room must be `confirmed` (or defaults accepted) before Lock & Emit
- **Decisions with supersession chains** — adding a decision on the same topic auto-supersedes the old one; full timeline visible
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
