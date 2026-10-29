# Design handoff

## Approved design references

- **Approved design = the current local build.** dede confirmed on 2026-10-29: "Use the current site". There is no separate Claude Design prototype.
- Claude Design prototype: not found (B-005, now resolved). Searched on 2026-10-29: dede's artifacts list (7 items, none an
  HCSO design), `/mnt/project-files/` and the project uploads, and the project threads. Asked dede for the link or an export.
- **Approved by dede in this thread:** the local build dede called "Better" on 2026-10-29, then widened at dede's
  request ("not full enough" meant screen width) and tightened for phones. Client screenshots:
  `/mnt/project-files/district5/hcso/client-preview/`.
- Layout reference: carolinaleo.website (structure only, see RESEARCH.md).
- Photography: dede's three in-game screenshots (Explorer, night stop, day patrol). Clean scene captures with no phone UI.

Nothing in this file claims fidelity to a Claude Design that has not been seen.

## Tokens (app/globals.css)

| Token | Value | Use |
|---|---|---|
| bg | #07090e | Page background (deep navy-black) |
| surface / raised | #0d1118 / #131823 | Cards |
| brand / brand-strong | #2f8f5b / #3fae72 | Sheriff green accents |
| brand-button | #22784a | Primary buttons (5.4:1 with white) |
| gold | #cfae5a | Controlled accent: stats, callsigns, numbering |
| ink / muted / faint | #eef1f6 / #8b93a5 / #767e91 | Text |

Container: `.container-page`, max 1600px, gutters 16 / 24 / 40 / 64px at 0 / 640 / 1024 / 1440px.
Sections: `.section`, 48px on phones and 88px from 768px.

## Component map

| Component | File | Used on |
|---|---|---|
| SiteHeader, MobileMenu | components/site/ | All public pages |
| SiteFooter | components/site/SiteFooter.tsx | All public pages |
| Photo, PhotoIntro, JoinBanner | components/site/Photo.tsx | Home, Team, Divisions |
| SectionHeading | components/site/Section.tsx | Home |
| Hub shell | app/hub/layout.tsx | Member hub |

## Page specs (current)

- **Home:** photo hero (Explorer), stats strip counted from data, three action cards, Divisions row with the
  night photo, SOP row with the day photo, five-level chain of command, mass-shift rewards, and the join banner.
- **Team:** photo header (day patrol), five color-coded levels with ranks and callsigns, and the join banner.
- **Divisions:** photo header (Explorer), division cards from `department_options`, and the join banner for non-members.
- **Sign in:** badge, Discord button, dev personas only when `NEXT_PUBLIC_D5_DEV_LOGIN=1`.

## Responsive rules

- Phones: the hero photo sits in the top band, rows of cards drop to compact two-column grids, and buttons go full width.
- md (768px) and up: hero text sits over the photo with a left fade, and feature rows sit side by side.
- No horizontal overflow from 320 to 1920px (QA_REPORT.md).

## Known compromises

- The Team page shows ranks only. Names wait on dede (B-002).
