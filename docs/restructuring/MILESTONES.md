# Milestones: FSRP / HCSO website

Converting the District Five multi-department hub into a single-department site for the
Hillsborough County Sheriff's Office (HCSO) on Florida State Roleplay (FSRP).
Statuses use the values in TASKS.md. Evidence lives in QA_REPORT.md and artifacts/visual-qa/.

| Milestone | Status | Gate |
|---|---|---|
| M0 Environment & safety | PASSED | Repo state recorded, checkpoint files exist, private research path git-ignored |
| M1 FSRP research | PASSED | Community name, invite, public facts recorded in RESEARCH.md |
| M2 HCSO research | PASSED | Department name, chain of command, divisions, joining process recorded |
| M3 Master SOP | PASSED | SOP structure summarized; public vs member-only sections classified |
| M4 Requirements & authorization | PASSED | Each public content item traced to a source and marked public-safe |
| M5 Architecture audit | PASSED | ARCHITECTURE.md written from the code |
| M6 CLE design reference | PASSED | CLE structure recorded in RESEARCH.md (WebFetch, text only) |
| M7 Single-department foundation | PASSED | Site config drives brand, hub scoped to one department, typecheck passes |
| M8 Frontend design system | PASSED | Tokens, header, mobile menu, footer, shared components |
| M9 Homepage | PASSED | Hero, quick actions, verified sections only |
| M10 Department pages | PASSED | Team, Divisions, SOP/resources per M4 |
| M11 Responsive visual QA | PASSED | Screenshots at 390 / 768 / 1440 with no overflow |
| M12 Functional & accessibility QA | PASSED | Keyboard nav, menu state, focus, sign-in and hub flows |
| M13 Technical validation | PASSED | typecheck, build, DB tests |
| M14 Final handoff | BLOCKED | HANDOFF.md current, commit/push asked of dede |

## Master prompt round (2026-10-29, evening)

dede sent the "HCSO website implementation master prompt". Its milestones map onto the work above:

| Prompt milestone | Status | Notes |
|---|---|---|
| 1 Audit | COMPLETE | ARCHITECTURE.md, DESIGN_HANDOFF.md, SESSION_STATE.md |
| 2 Design system | COMPLETE | dede confirmed the current site is the approved design (B-005 resolved) |
| 3 Photos | COMPLETE | Three photos in public/photos as WebP; no phone UI in the sources |
| 4 Homepage | VERIFIED | Matches the version dede approved; re-check against the Claude Design when it arrives |
| 5 Team / chain of command | VERIFIED | Ranks only; staff names wait on B-002 |
| 6 Divisions / join | VERIFIED | Uses the existing request_membership RPC and subdivision form |
| 7 Resources / SOP / sign-in | VERIFIED | SOP summaries stay members-only (RLS); Discord OAuth unchanged |
| 8 Member hub | VERIFIED | HCSO-scoped, widened, mobile menu |
| 9 Legacy cleanup | COMPLETE | 21 hub routes crawled as 5 personas: no BCSO/SAHP/DPS/District Five text |
| 10-11 Responsive and visual QA | VERIFIED | Public pages at 7 widths, hub pages at 5 widths, no overflow |
| 12 Regression | VERIFIED | typecheck, build, DB tests, 24 Playwright checks. No ESLint in the repo |
| 13 Final delivery | BLOCKED | Approval gate: commit, push, deploy and live migration each need dede (B-003, B-004) |
