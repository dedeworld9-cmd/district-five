# Research (public-safe conclusions only)

Detailed notes from Discord and the Master SOP are kept in `.private/research/` (git-ignored).

## CLE design reference (M6), read 2026-10-29 via WebFetch (text, no styles)

Source: https://www.carolinaleo.website/ (home, /team, /divisions).
- Nav: logo, Home, Team, Divisions, Employee, Discord.
- Home: small label line ("<name> · Open applications"), H1 department name, one welcome paragraph,
  buttons "Join Discord" and "About us"; "Quick Actions" with three cards (Join the Discord, Apply today,
  Appeal infraction), each a short paragraph and one text link.
- Team: intro heading, "Administrators" group of person cards (initial avatar, name, role, Active tag),
  closing "Join the department today" block with Apply and Discord buttons.
- Divisions: H1, intro line, cards with image, status (Active, Handpicked, applications closed),
  name, description, "View information" and "Apply".
- Footer: name, one-line tagline, the same links, short "Name · ABBR" line.
- Not verified: colors, fonts, spacing, responsive behavior (WebFetch returns text only).

## FSRP (M1)

Read in dede's Discord on 2026-10-29. Public-safe conclusions:
- Florida State Roleplay (FSRP) is a Roblox ER:LC community. Tagline "Experience Real Roleplay".
- It has a public Roblox group (link in `lib/site.ts`). No public Discord invite link was found.
- The palm "F" server icon is used as `public/logos/fsrp.webp`.

## HCSO (M2)

Read in the HCSO Discord on 2026-10-29. Public-safe conclusions (used on the site):
- Welcome line from the HCSO dashboard (spelling of "Hillsborough" corrected).
- 12 ranks in five groups, with 1S/2S/3S callsign prefixes (from #command-info).
- Divisions: Patrol (led by the Patrol Captain) and Traffic Enforcement Unit (led by the TEU Commander).
- Mass-shift rewards list.
- The server icon (star badge) is used as `public/logos/hcso.webp`, with a "not a real agency" disclaimer.

Kept off the public site: command staff names (awaiting dede, B-002), the roster sheet, the CAD code,
ticket and internal channel content. Details are in `.private/research/` (git-ignored).

## Master SOP (M3)

Seven policy documents, read through the Google Drive connector: Use of Force, Traffic Stops,
Vehicular Pursuits, Spike Strips, Grappler, Air-1 Support, Vehicle Boxing. Titles are public on the
homepage. Short summaries and links to the Google Docs live in the hub's policies table, which is
members-only by RLS. Full SOP text is not in the repo because the repo is public.

## Leadership roster (2026-10-30)

dede supplied a screenshot of the HCSO roster sheet (Office of the Sheriff, Command staff, Senior supervisors,
Sergeants; the Patrol Deputy section was cut off). Published on /team and the home page: name, rank, callsign, duty,
active or vacant. Not published: Discord IDs, strikes, vehicle and certification checkboxes. Data lives in `LEADERSHIP`
in `lib/site.ts`. Sheet quirk: 2S-18 lists "J.Parker" with status Vacant; it is shown as vacant until command confirms.
