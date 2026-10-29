# Architecture

## Existing (audited 2026-10-29 at 58816f2)

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 (`app/globals.css` `@theme` tokens
  plus component classes `.card`, `.btn*`, `.input`, `.tag`, `.table`). No component library, no lint or unit-test script.
- Supabase: Postgres with RLS (select-only for clients), every write is a SECURITY DEFINER RPC,
  Discord OAuth. Migrations in `supabase/migrations`, DB tests in `supabase/tests` via `npm run test:db`.
- Local stand-in backend: `scripts/dev-backend.mjs` (REST + auth on :54321) with `npm run dev:db` personas.
- Routes:
  - Public: `/` (single long page: hero, department cards, DPS card, press releases, gallery, quick actions, footer), `/login`, `/dev-login`.
  - Hub (`/hub/*`, signed in, `middleware.ts` redirects): dashboard, join, shifts, reports, board,
    approvals, command panels (`/hub/command`, `/staff`, `/admin`), oversight and patrol (DPS),
    roster, records, announcements, resources, equipment, notifications, profile, admin.
- Multi-department assumptions:
  - `lib/session.ts` loads every department and membership; `current` follows `profiles.active_department`.
  - `app/hub/layout.tsx` department switcher, per-department themes from `lib/brand.ts`, Oversight/Patrol nav for DPS.
  - Pages that take `?dept=` and render department tabs: roster, records, approvals, board, resources, equipment, command panels.
  - `JoinForm` department picker; front page department grid and DPS card.
  - Branding: "District Five Department Hub", The Lounge Roleplay logo, Lounge Discord invite.

## Target

- One site configuration (`lib/site.ts`) naming the department, community, Discord invite and copy.
- `getSession` scopes departments and memberships to the site department (plus any oversight
  department that commands it), so every page that lists departments shows only HCSO without per-page rewrites.
- Public pages share a site shell (header with accessible mobile menu, footer) in an `app/(site)` route group:
  `/` home, `/team`, `/divisions` (CLE pattern), plus SOP/resources only where M4 allows.
- Hub keeps its routes, RPCs and RLS. The department switcher and Oversight nav leave the active UI; the routes stay.
- Database: the HCSO department row and ranks need a new migration. It is written but not run on live without dede.
