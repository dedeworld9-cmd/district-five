# HCSO release readiness report

Audit date: 2026-10-30. Code audited: commit 7ab2378 (live on `main`) plus the uncommitted fixes listed in section D.
Environment: local production build (`next build` + `next start`) against a local Postgres 16 that runs the real migrations and a PostgREST-compatible dev backend. The live Supabase project and live Discord sign-in were **not** exercised (see section H).

## A. Executive summary

**Decision: CONDITIONAL GO** (section J).

The member portal is in good shape. Every automated check passes: 239 database permission checks, 7 unit tests, and five browser suites (route gating, patrol edge cases, form edge cases, 33 workflow checks, command palette). A crawl of 128 page loads across six widths (375 to 1920 px) and five personas found no horizontal overflow, no missing page headings, no unlabeled controls, no console errors and no server errors. Lighthouse scores 100 for accessibility, best practices and SEO on all three public pages tested.

Eight defects were found and fixed in code (section D). One of them mattered: pressing Start patrol twice, or Start from a second open tab, restarted the patrol timer and lost the elapsed time.

Three things keep this from a plain GO, and none is a code defect:

1. **Migrations 015, 016 and 017 are not run on the live database.** The code that is already live is written to fall back safely, but the Discord rank hint and the Sheriff-appoints rule do nothing until the SQL runs.
2. **Live sign-in with the new Discord scope has not been tested.** It needs a real Discord login by someone in the HCSO server.
3. **Backups and monitoring are unverified.** Nothing in the repository sets them up, and the free Supabase plan does not include scheduled backups.

The fixes in section D are uncommitted, so they are not live. They need your approval to push.

## B. Feature verification matrix

Gate = who may open it. "Native" pages run inside the hub. "Discord" pages are gateways that open the verified HCSO channel; the hub does not store their data, so there is nothing to test beyond the access gate and the link.

| Workspace | Operation | Test performed | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|
| Public | Home, Team, Divisions, Login | Loaded at six widths, anonymous | Renders, one h1, no overflow | As expected | PASS | crawl, `audit/issues.txt` |
| Public | Lighthouse | Mobile and desktop, 3 pages | High scores | a11y/BP/SEO 100; perf 94 to 100 desktop and mobile, except mobile home 79 | PASS with note | section F |
| Auth | Sign-out, protected routes | Anonymous and garbage-cookie requests to `/hub/admin` | Redirect to login | 307 to `/login?next=` for all three | PASS | curl output |
| Auth | Open-redirect probe | `next=//evil.com` | Stays on site | Redirects to `/login` | PASS | curl output |
| Auth | Reflected XSS probe | `?error=<script>` on login | Escaped | 0 raw script tags | PASS | curl output |
| Auth | Backend unreachable | Stopped the backend while signed in | Clear message, no crash | Was a misleading "Sign in" screen; fixed to "cannot reach its database" | PASS after fix | `down.js` |
| Auth | Discord sign-in with new scope, rank sync | Needs live Discord | n/a | Not possible here | BLOCKED | section H |
| Auth | Session expiry mid-patrol | Expired tokens are rejected by the same middleware path as garbage cookies; a true time-based expiry was not run | n/a | Partly covered | NOT TESTED (time-based) | |
| Department Hub | Overview, Announcements, Resources | Crawl as 5 personas | Renders per gate | As expected | PASS | crawl |
| Department Hub | Mass Shifts, Command Information | Discord gateways | Link only, gated | Gate and link verified, no leaked IDs | PASS | `perm.js` |
| Patrol | Start, End | `patrol.js` | Status changes, prefilled logger opens | As expected | PASS | 8 of 8 |
| Patrol | Start twice from a stale second tab | Second Start submitted | Timer unchanged | Timer unchanged after fix (was reset before) | PASS after fix | `patrol.js` |
| Patrol | End twice | Second End from a stale tab | No second log | No second log, record unchanged | PASS | `patrol.js` |
| Patrol | Refresh during patrol | Reload | Timer continues from stored start | 3 s elapsed, matches stored start | PASS | `patrol.js` |
| Patrol | Simultaneous sessions in two departments | Database turns the other department off | One active session | Covered by existing database test | PASS | `test:db` |
| Patrol | Network interruption mid-request | Backend stopped | Error, no false success | Error shown, no success message | PASS | `down.js` |
| Logging | Activity Logger | `func.js`: summary, short-duration flag, draft restore, double-submit lock, submit | Works | 33 of 33 | PASS | `func.js` |
| Logging | Incident report: empty, 60,000-character field, triple click | `forms.js` | Rejected cleanly, one record at most | All held; long input gave a vague message, now specific | PASS after fix | `forms.js` |
| Logging | Shift Logs, Reports history, detail views | Crawl | Renders | As expected | PASS | crawl |
| Logging | Results, Infractions, Logs, Warrants, Backup Logs | Discord gateways | Link only | Gate verified | PASS (gateway only) | `perm.js` |
| Training and Range | BLS Exam, Qualification Trainings, Availability | Discord gateways | Link only | Gate verified | PASS (gateway only) | |
| Training and Range | Completion records, progress, qualification results | The hub has no native training records | n/a | Not built | NOT TESTED (does not exist) | section I |
| High Ranking | Gate by tier | Member, supervisor, head, new member | Only the right tier sees each page | 13 correct denials, no channel ID leaked in denied pages | PASS | `perm.js` |
| High Ranking | Staff panel, roster, approvals, admin | Crawl plus 239 database checks | Server enforces authority | All pass | PASS | `test:db` |
| High Ranking | Sheriff appoints below own rank; cannot appoint a peer or change a superior | 4 new database checks | Enforced in the database | All pass | PASS (local only) | `80_hcso.sql` |
| High Ranking | Discord rank hint on join requests | Stored and rejected-unknown checks | Hint only, no automatic promotion | Pass; live sign-in not tried | PASS locally, BLOCKED live | `80_hcso.sql` |
| Navigation | Command palette, shortcuts, mobile drawer | `palette.js`, `func.js` | Works, Escape closes | 8 of 8 | PASS | |

## C. Security findings

| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | No Content-Security-Policy or Permissions-Policy on the live site | Medium | Fixed in code (not yet live) |
| S2 | `npm audit`: PostCSS, 1 high and 1 moderate, via Next's bundled copy. Build-time only; the site processes no user CSS | Low in practice | Fixed (override to 8.5.32); audit now reports 0 |
| S3 | A person can call `report_discord_rank` directly and claim any rank | Low | Accepted by design: it is a hint, and staff must still approve any rank. Direct table writes to profiles are blocked and tested |
| S4 | No application-level rate limiting on sign-in or form submissions | Low to medium | Open. Vercel and Supabase apply platform limits; nothing is set in the app |
| S5 | Restricted pages return HTTP 200 with a "Restricted" screen instead of 403 | Low | Open, cosmetic. No data is exposed |
| S6 | CSP keeps `'unsafe-inline'` for scripts and styles because Next.js needs it without nonces | Low | Accepted |

Checked and clean: no `dangerouslySetInnerHTML` anywhere; every write goes through a database function that re-checks the caller's authority; row-level security is select-only; `/dev-login` is a 404 on the live site and is code-gated to a localhost backend; the live site sends HSTS (2 years, preload), X-Frame-Options DENY and nosniff; the service key is never in the repository or the client bundle.

No authorization defect was found. There are no open release blockers in this category.

## D. Bug fix summary

All uncommitted. Regression coverage is in `tests/unit.test.mjs`, `supabase/tests/80_hcso.sql` and `tests/e2e/`.

| # | Problem | Root cause | Files | Solution | Regression test | Result |
|---|---|---|---|---|---|---|
| 1 (P1) | Start patrol twice, or Start from another open tab, restarted the timer | `set_duty_status` stamps the start time on every call, and the app called it every time | `app/hub/actions.ts` | The server action reads the stored status first and only calls the database when the status really changes. The prefilled end time also comes from the stored start, not from a hidden browser field | `patrol.js` | PASS |
| 2 (P2) | Backend outage showed "Sign in to the member hub", as if the person were signed out | Middleware treated a failed session check as no session | `middleware.ts`, new `app/error.tsx` | Network failures now redirect to a message saying the database is unreachable; a last-resort error screen with retry | `down.js` | PASS |
| 3 (P2) | A field over the length limit showed "Something went wrong" | Check-constraint errors were not mapped | `lib/errors.ts` | Maps to "One of the fields is too long or has an invalid value." | `unit.test.mjs` | PASS |
| 4 (P2) | No CSP or Permissions-Policy | Never configured | `next.config.ts` | Added both | header check | PASS |
| 5 (P2) | npm audit: 1 high, 1 moderate | Next's bundled PostCSS | `package.json`, lockfile | Override to PostCSS 8.5.32 | `npm audit`, rebuild | 0 vulnerabilities |
| 6 (P3) | Small uppercase eyebrow labels throughout the hub, against the approved design direction | Global `.label` and table-header styles | `app/globals.css`, `app/hub/roster/page.tsx`, `app/hub/resources/page.tsx` | Sentence case, 12 to 13 px | screenshots | PASS |
| 7 | Discord role link (earlier this session) | New feature | see commit 7ab2378 | n/a | `80_hcso.sql`, `unit.test.mjs` | PASS |
| 8 | Sheriff-led appointments and outranking rules (earlier this session) | New rule | migration 017, `lib/tiers.ts` | n/a | `80_hcso.sql`, `unit.test.mjs` | PASS |

Database changes needing your approval: none new beyond the three already awaiting the live Run (015, 016, 017). A stronger fix for #1 would make `set_duty_status` ignore repeat calls inside the database itself. That would be migration 018. It is not needed now that the app guards the call, so I did not write it.

## E. UI and UX findings

Every page was captured at 1920, 1440, 1024, 768, 390 and 375 px for five personas, with screenshots saved for 1440, 768 and 390. Measured: zero horizontal overflow, exactly one h1 per page, no unlabeled buttons, links or inputs, no obstructed controls. Fixed: the uppercase eyebrow labels (D6). Remaining notes:

- The section tab bar on the command panels scrolls sideways at 1440 px and cuts off its last tab. It is a scrolling control, not a clip bug, but a fade at the edge would make that obvious. P3.
- On phones the breadcrumb truncates to "H…". Harmless; the page title is directly below. P3.
- Glass is used only on the sidebar, toolbar, popovers and palette. Content surfaces are solid.

Screenshots: `/mnt/project-files/district5/hcso/audit/`.

## F. Performance results (measured, local production build, Lighthouse 12, simulated throttling)

| Page | Device | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| / | mobile | 79 | 100 | 100 | 100 | 3.0 s | 0 | 600 ms |
| / | desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 10 ms |
| /team | mobile | 96 | 100 | 100 | 100 | 2.4 s | 0 | 170 ms |
| /team | desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| /login | mobile | 94 | 100 | 100 | 100 | 2.0 s | 0 | 280 ms |
| /login | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms |

Bundle: shared JavaScript is 103 kB; every hub page adds 0.2 to 1.4 kB. The home page transfers 264 KiB in total. The slow mobile home score comes from the hero photo (LCP element) and about 360 ms of framework script on the simulated slow CPU, not from application code. Hub pages need a signed-in session and were not run through Lighthouse. Server response times, long-session memory use and table performance with large data were not measured; the roster has three people in the test data.

## G. Automated test results

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | Compiles, 31 routes |
| `npm run test:db` | 239 checks, all pass |
| `npm run test:unit` | 7 of 7 pass |
| `tests/e2e/perm.js` | 13 correct denials, 0 leaks |
| `tests/e2e/patrol.js` | 8 of 8 |
| `tests/e2e/forms.js` | 7 of 7 |
| `tests/e2e/func.js` | 33 of 33 |
| `tests/e2e/palette.js` | 8 of 8 |
| `tests/e2e/audit.js` | 128 page loads at six widths, 0 overflow, 0 heading issues, 0 console errors |

The browser scripts need Playwright installed globally (`NODE_PATH=$(npm root -g) node tests/e2e/<name>.js`), a local database (`npm run dev:db`), the dev backend and `npm run start`. No coverage percentage was measured; there is no coverage tool in the project.

## H. Deployment readiness

- **Environment:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel. Optional `NEXT_PUBLIC_DISCORD_INVITE` is still unset.
- **Migrations:** 015, 016 and 017 are written, tested locally and **not** run on the live database. Run them in order in the Supabase SQL editor. After 015, only the site admin can appoint at the department-head tier until 017 runs; run all three together.
- **Discord:** the provider is enabled. The new `guilds.members.read` scope is requested at sign-in; it has not been tried live. Confirm the first real sign-in after deploy.
- **Backups:** not verified. The free Supabase plan has no scheduled backups; take a manual export before running migrations.
- **Monitoring:** none. There is no error tracker, uptime check or health endpoint. Vercel logs are the only record.
- **Rollback:** Vercel can promote the previous deployment in one click. The migrations are additive (new columns, new functions, a rank-tier update); undoing 015 means setting the Chief Deputy and Major ranks back to `high_command`. Neither rollback has been rehearsed.
- **Outstanding risks:** the live Discord sign-in with the new scope, the unrun migrations, no backups, no monitoring.

## I. Outstanding issues

**Critical / High:** none.

**Medium**
- No monitoring or verified backups (H).
- Live Discord sign-in with the new scope untested.
- Training & Range has no native records: it links to Discord channels only. If you expect the hub to track completion, qualifications or range results, that feature does not exist yet.

**Low**
- No application-level rate limiting (S4).
- Restricted pages return HTTP 200 (S5).
- Mobile home Lighthouse performance 79 (F).
- Tab bar edge fade and breadcrumb truncation (E).
- Discord invite link not set; J. Parker (2S-18) not on the roster; Patrol Deputy roster section.

## J. Release decision

**CONDITIONAL GO.** No critical or high-severity defect remains, no authorization failure was found, and every executed test passes. The conditions that need your explicit acceptance before deployment:

1. Approve pushing the uncommitted fixes in section D.
2. Run migrations 015, 016 and 017 on the live database (after a manual export).
3. Accept that live Discord sign-in, backups, monitoring and rollback are unverified, and check the first real sign-in right after deploy.

Nothing was deployed, pushed or run against production during this audit.
