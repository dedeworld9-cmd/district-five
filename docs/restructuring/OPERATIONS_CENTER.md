# HCSO Operations Center: local implementation

Status 2026-10-30: all five workspaces built and tested locally. Nothing committed, pushed, deployed or migrated.

## Milestones
| Milestone | State | Notes |
|---|---|---|
| M1 Audit | Done | Existing hub pages mapped to workspaces; Discord channel IDs read from the HCSO server (`lib/discord.ts`). |
| M2 Shell | Done | `components/ops/Frame.tsx` (252/72px sidebar, 68px header, drawer under 1024px, breadcrumbs, section tabs); navy palette scoped to `.ops` in `globals.css`. |
| M3 Department Hub | Done | `app/hub/_ops/department.tsx` |
| M4 Patrol | Done | `app/hub/patrol/page.tsx` (replaced the unused DPS panel) |
| M5 Logging | Done | `_ops/logging.tsx`; Activity Logger redesigned in `components/ShiftForm.tsx` |
| M6 Training & Range | Done | `_ops/training.tsx` |
| M7 High Ranking | Done | `_ops/high-ranking.tsx`, gated on the server |
| M8 Responsive QA | Done | No horizontal overflow at 320/375/390/768/1024/1440/1920 on all workspaces |
| M9 Tests | Done | typecheck clean, `npm run build` passes, `test:db` ALL OK, `func.js` 32 PASS / 0 FAIL |
| M10 Refinement | Done | Discord link wrapping, empty-state heights |
| M11 Report | Done | This file |

## Architecture
- `lib/workspaces.ts` is the registry: workspaces, pages, gates (`member`, `supervisor`, `command`, `admin`) and `can(session, gate)`.
- Routes: `/hub/[ws]` (overview), `/hub/[ws]/[page]` (Discord gateway or redirect to a native page), `/hub/patrol` (own page). Existing routes (`/hub/shifts`, `/hub/reports`, `/hub/approvals`, `/hub/roster`, `/hub/admin`, ...) are unchanged and appear in the sidebar and breadcrumbs.
- Gates are checked in each page on the server. The sidebar only lists permitted pages, but that is not the access control. Verified by `qa/perm.js`: a member and a non-member get the restricted view on High Ranking pages, and command-only channel IDs do not appear in a supervisor's HTML.
- Discord links: only channel IDs read from the server; each is labeled and opens in a new tab.

## Backend preservation (from `git diff`)
Zero changed lines in `supabase/`, `app/hub/actions.ts`, `lib/supabase/`, `lib/session.ts`, `lib/queue.ts`, `middleware.ts`, `app/auth/`. No migrations added. The Activity Logger still posts the same fields to `saveShift` (`save_shift_log`), Start/End patrol still call `setDuty` (`set_duty_status`). No new dependencies.

## Known limitations
- No Pause/Resume on patrol: the backend has only on/off duty, so the control is not shown. Breaks are entered as minutes in the log.
- Draft recovery reads this browser's storage only; a different device has no draft.
- Denied pages return a restricted view with status 200, not 403.
- Mass shifts, results, infractions, warrants, backup logs, chats, suggestions, BLS exam, trainings, availability and the command/supervisor channels are Discord gateways because the backend has no tables for them.
- Whether each Discord channel is visible to a given member is decided by Discord.
- Inter/Geist are named in the font stack but not bundled (no new dependency); systems without them use the system font.
- The dashboard at `/hub` keeps its earlier layout inside the new shell.

## Apple-inspired redesign pass (2026-10-30, local, not deployed)
- Tokens: near-black `#090b10` background, `#0e1117` secondary, `#141820` surfaces, `#1a2029` raised, `#232932` dividers. Scoped to `.ops`; the public site uses the same base colors.
- Materials: `.glass` (blur 20px, 72% surface) only on the sidebar, toolbar, drawer, account menu, mobile menu and command palette. Cards, forms, tables and the patrol panel are solid.
- Accents: green for primary actions, active patrol and selected icon tiles; gold for callsigns, rank text and the hero's second line. Links are neutral.
- Shell: pill back/forward and search, command palette (Ctrl or Cmd+K, `/`), `g` then `d/p/l/t/h/o` jumps, `[` folds the sidebar. Palette and shortcuts list only pages the member may open; each page still checks its own gate.
- Components: Settings-style grouped lists, sliding segmented section control, 150–200ms transitions, dialog and popover pop animation, all disabled under reduced motion.
- Public site: removed rainbow gradients, colored card tops and green tints; hero line and stats are calmer.
- Not built: side-panel detail views (the backend has no detail endpoints beyond the existing detail pages).
