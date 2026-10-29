# QA report

Run 2026-10-29 against the local stack (Postgres d5dev + `scripts/dev-backend.mjs` + `next dev`).

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | Pass |
| Production build | `npm run build` | Pass, no warnings; 34 routes |
| Database persona tests | `bash scripts/test-db.sh` | ALL OK, including new `80_hcso.sql` (anon sees HCSO and divisions, not policies) |
| Overflow, public pages | Playwright, `/`, `/team`, `/divisions`, `/login` at 320/390/768/1024/1440/1920 | 24/24 no horizontal overflow |
| Hub pages per persona | Playwright, 16 page loads across 5 personas | No overflow; no BCSO/SAHP/District Five text |
| Function and accessibility | Playwright script (menu ARIA and keyboard, skip link, one h1 per page, img alt, aria-current, join request, hub mobile menu, start/end shift) | 24/24 pass |
| Visual review | Screenshots read by eye: home at 390 and 1440 | Layout correct; the round "N" button is the Next.js dev indicator and does not ship |

Screenshots: `artifacts/visual-qa/final/` (git-ignored). Not checked: real Discord OAuth sign-in,
the live Supabase project, and screen readers beyond ARIA attributes. The repo has no lint or unit-test script.

## 2026-10-29 update: photos
dede supplied three in-game HCSO photos. Saved as WebP in `public/photos/` (800px and large, 21 to 125 KB
each, from 1.1 to 2.3 MB PNGs). Used as the home hero and an "On patrol" pair. typecheck pass; no
horizontal overflow on `/` at 320 to 1920; screenshots in `artifacts/visual-qa/iterations/4/`, reviewed at 390 and 1440.

## 2026-10-29 evening: master prompt checks

| Check | Result |
|---|---|
| Public pages (/, /team, /divisions, /login) at 320/375/390/768/1024/1440/1920 | 28/28 no overflow |
| Hub, 15 routes as hcso_head at 320/375/768/1024/1920 | 75/75 no overflow after fixing /hub/announcements at 320 (form column and button row) |
| Legacy text crawl, 21 hub routes as hcso_member, hcso_supervisor, hcso_head, new_member and admin | No BCSO/SAHP/SAFD/SAEMS/DPS/District Five text, no errors, no 4xx/5xx |
| Function and accessibility script | 24/24 |
| ESLint | Not available in the repo (D-006) |
| Compared against an approved Claude Design | NOT DONE: design not found (B-005) |
