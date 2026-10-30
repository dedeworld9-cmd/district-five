# Blockers

| ID | Category | Blocks | Evidence | Resolution | Parallel work |
|---|---|---|---|---|---|
| B-001 | MISSING_INFORMATION | Discord buttons on the public site | No public HCSO or FSRP invite link found in either server | dede supplies an invite; set `NEXT_PUBLIC_DISCORD_INVITE` in Vercel. Buttons stay hidden until then. | Site works without it |
| B-002 (RESOLVED 2026-10-30) | AUTHORIZATION | Command staff names on /team | Names are in #command-info but publishing members is dede's call | dede sent the roster sheet on 2026-10-30 and asked for it to be applied: /team now lists names, ranks, callsigns and duties. Discord IDs and strikes in the sheet are NOT published. | None needed |
| B-003 | AUTHORIZATION (hard) | HCSO data on the live site | Migration 014 only applied to the local d5dev database | dede approves running `supabase/migrations/20261029000014_hcso.sql` on live Supabase (insert-only, re-runnable). Without it the live site has no HCSO department. | Local QA done |
| B-004 | AUTHORIZATION (hard) | Commit, push, Vercel deploy | Brief forbids commit/push without approval | dede approves. Work is backed up as a patch in project files. | None |
| B-005 (RESOLVED 2026-10-29) | MISSING_INFORMATION | Matching the "approved Claude Design" (master prompt) | Not in dede's artifacts, project files, uploads or threads | dede sends the link or an export, or confirms the current approved build is the design. **dede chose "Use the current site" on 2026-10-29 23:26Z.** | Cleanup, QA and docs done meanwhile |

## Notes

- 2026-10-29: clicking the HCSO "Contact Support" bot button during research opened a ticket in dede's
  name. dede was told; no further bot buttons were clicked.
- Tech debt, not blocking: some admin pages still mention DPS in copy; the unused /hub/oversight and
  /hub/patrol routes are kept (not deleted, per brief). Other departments' rows remain in the database
  and are hidden by `SITE.department` scoping.
