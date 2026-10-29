# Tasks

Statuses: NOT_STARTED, READY, IN_PROGRESS, VERIFYING, PASSED, BLOCKED, FAILED.

| ID | Title | Depends on | Status | Files | Acceptance | Verification | Evidence |
|---|---|---|---|---|---|---|---|
| M0-T01 | Record repo state, create checkpoint files, ignore private research | | PASSED | docs/restructuring/*, .gitignore | Files exist, `.private/` ignored | `git status`, `git check-ignore .private/x` | SESSION_STATE.json |
| M1-T01 | Read FSRP Discord: name, rules, info channels, invite | M0-T01 | PASSED | RESEARCH.md, .private/research/fsrp.md | Community facts recorded with channel sources | Chrome read of guild 1552418272664748052 | RESEARCH.md FSRP |
| M2-T01 | Read HCSO Discord: chain of command, divisions, joining | M0-T01 | PASSED | RESEARCH.md, .private/research/hcso.md | Ranks/divisions only from HCSO channels | Chrome read of guild 1563753563677794417 | RESEARCH.md HCSO |
| M3-T01 | Read Master SOP Google Doc and outline it | M0-T01 | PASSED | .private/research/sop.md | Section list with public/member classification | Chrome read of the open doc | RESEARCH.md SOP |
| M4-T01 | Content authorization list | M1-T01, M2-T01, M3-T01 | PASSED | RESEARCH.md | Each public item has a source and a public/member flag | Review | RESEARCH.md (public vs member split) |
| M5-T01 | Architecture audit | M0-T01 | PASSED | ARCHITECTURE.md | Routes, data, multi-dept dependencies listed | Code read | ARCHITECTURE.md |
| M6-T01 | CLE structure | M0-T01 | PASSED | RESEARCH.md | Nav, home, team, divisions, footer recorded | WebFetch | RESEARCH.md |
| M7-T01 | Site config `lib/site.ts` | M5-T01 | PASSED | lib/site.ts | One place names department, community, Discord | typecheck | lib/site.ts; typecheck |
| M7-T02 | Scope session to the site department | M7-T01 | PASSED | lib/session.ts | Lists show only HCSO; DB untouched | typecheck, persona check | lib/session.ts; hub.js otherDept=no for all personas |
| M7-T03 | HCSO department migration (local only) | M2-T01 | PASSED | supabase/migrations/* | Department row + verified ranks; DB tests pass | `npm run test:db` | 20261029000014_hcso.sql; test:db ALL OK incl 80_hcso |
| M8-T01 | Tokens and shared layout components | M5-T01 | PASSED | app/globals.css, components/site/* | Semantic tokens, container, section heading, button, card | typecheck, screenshots | globals.css tokens; final screenshots |
| M8-T02 | Site header + accessible mobile menu, footer | M8-T01 | PASSED | components/site/* | aria-expanded, Escape closes, focus returns, no overflow | Playwright keyboard check | func.js menu checks |
| M8-T03 | Hub header without switcher or Oversight | M7-T02 | PASSED | app/hub/layout.tsx | One department, mobile menu | screenshots | hub layout; hub mobile menu checks |
| M9-T01 | Homepage | M7-T01, M8-T02, M4-T01 | PASSED | app/(site)/page.tsx | Hero, quick actions, verified sections | screenshots 390/768/1440 | final/home-*.png |
| M10-T01 | Team page | M8-T02, M4-T01 | PASSED | app/(site)/team | Only verified people/ranks | screenshots | final/team-*.png |
| M10-T02 | Divisions page | M8-T02, M4-T01 | PASSED | app/(site)/divisions | Only verified divisions | screenshots | final/divisions-*.png |
| M10-T03 | Join flow for one department | M7-T02 | PASSED | app/hub/join, components/JoinForm.tsx | No picker; request goes to HCSO | persona check | func.js join check |
| M11-T01 | Responsive screenshots | M9-T01, M10-* | PASSED | artifacts/visual-qa | No horizontal overflow at 320–1920 | Playwright | QA_REPORT.md |
| M12-T01 | Keyboard and hub flow checks | M8-T02, M10-T03 | PASSED | | Menu, sign-in, dashboard, join work | Playwright | func.js 24/24 |
| M13-T01 | typecheck, build, DB tests | all impl | PASSED | | All pass or pre-existing failures noted | npm scripts | QA_REPORT.md |
| M14-T01 | Handoff, ask dede to commit/push | M13-T01 | BLOCKED | HANDOFF.md | Current and accurate | dede approves | B-003, B-004 |
