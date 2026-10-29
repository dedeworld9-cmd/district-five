# Handoff

**Building:** the District Five hub (Next.js + Supabase) turned into a single-department site for the
Hillsborough County Sheriff's Office (HCSO) on Florida State Roleplay, styled after carolinaleo.website.

**Done (uncommitted on `claude/project-thread-tl03s1`):** research, HCSO migration 014 (local only),
`lib/site.ts`, public site (header, mobile menu, footer, home, team, divisions, login), hub scoped to HCSO,
single-department join. typecheck, build, DB tests and 24 Playwright checks pass (see QA_REPORT.md).

**Waiting on dede:** B-003 run migration 014 on live, B-004 commit/push/deploy, B-001 Discord invite,
B-002 command staff names on /team.

**Local stack:** `pg_ctlcluster 16 main start`; `npm run dev:db`;
`DATABASE_URL='postgresql://root@/d5dev?host=/var/run/postgresql' node scripts/dev-backend.mjs`;
`npm run dev`. Sign in at /dev-login with hcso_member, hcso_supervisor or hcso_head.

**Next session first:** read SESSION_STATE.json and BLOCKERS.md, run `git status`.

**Constraints:** no commit, push, deploy or live database change without dede. No unverified ranks or
SOP text on public pages. Nonpublic notes stay in `.private/` (git-ignored). Free services only.
