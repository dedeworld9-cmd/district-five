# Decisions

D-001 (2026-10-29) Keep Next.js, Tailwind 4 and Supabase. The brief asks for a refactor, not a rebuild.

D-002 (2026-10-29) Scope to one department inside `getSession` instead of deleting multi-department
code. Pages that list departments then show one without rewrites, and the DB contract is unchanged.
Obsolete routes (oversight, patrol) leave navigation but stay in the code until deletion is approved.

D-003 (2026-10-29) Nonpublic research (Discord channel detail, Master SOP passages) goes in
`.private/research/`, which is git-ignored. RESEARCH.md holds only public-safe conclusions and source names.

D-004 (2026-10-29) No commits or pushes until dede authorizes. Work stays in the working tree on
branch `claude/project-thread-tl03s1`; a git bundle copy goes to the project files folder as a backup
because the cloud container is temporary.

D-005 (2026-10-29) The master prompt asks for SESSION_STATE.md. It was added next to SESSION_STATE.json and both
are kept, so earlier recovery instructions still work.

D-006 (2026-10-29) No ESLint is installed and there is no lint script. Adding one would be a new dev dependency
and config, so it was not added. Lint is reported as unavailable, not as passed.

D-007 (2026-10-29) Legacy department names stay where they are backend identifiers: the `dps` tier, old migrations,
`content/bcso` and `content/sahp` JSON, and personas in dev-login. Only user-visible copy was changed.
