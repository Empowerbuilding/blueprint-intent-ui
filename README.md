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
