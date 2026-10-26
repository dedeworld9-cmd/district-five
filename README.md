# District Five Law Enforcement Hub

Website for the District Five PS5 law enforcement roleplay community: the Blaine County Sheriff's Office and the San Andreas Highway Patrol, under the Department of Public Safety. All departments, people and records are fictional.

To put it online, follow [docs/SETUP.md](docs/SETUP.md).

## What is in Stage 1

- Discord sign-in, with one account per member and memberships in one or both departments.
- Dashboard with duty status, clock in and out, weekly quota progress, and announcements.
- Shift logs with drafts, browser autosave, bodycam fields, overlap protection across departments, and a review timeline.
- An approval queue routed by tier: approve, return for correction, deny, claim, or escalate to DPS.
- A roster with join requests, rank changes, leave of absence, suspension, and confidential personnel records.
- Announcements by department or district, with separate approval before anything reaches the public site.
- Notifications, admin settings for ranks, quotas, week start, time zones, bodycam rules, review routing, roster import, and labeled demo data.
- A public front page that identifies the site as a roleplay community.

## How permissions work

Browsers can read only what row-level security allows, and they cannot write to any table. Every change goes through a database function in `supabase/migrations/` that checks the caller's authority, records the approval timeline, sends notifications and writes the audit log in one transaction. The rules hold even if someone calls the API directly.

## Stack

Next.js 15 (App Router) and Tailwind CSS 4 on Vercel. Supabase for Postgres, Discord OAuth and the REST API.

## Working on it locally

Requirements: Node 20 or newer and PostgreSQL 16.

```bash
npm install
npm run test:db          # rebuilds a throwaway database and runs the persona tests
npm run dev:db           # builds the local dev database with test personas
npm run dev:backend      # local stand-in for the Supabase API on :54321
cp .env.example .env.local   # then uncomment NEXT_PUBLIC_D5_DEV_LOGIN=1 and set the URL to http://localhost:54321
npm run dev
```

With the dev backend running, `/dev-login` lets you sign in as any test persona. That page exists only when `NEXT_PUBLIC_D5_DEV_LOGIN=1` and the Supabase URL is a localhost address.

`scripts/test-db.sh` covers the eight personas from the spec (BCSO member, SAHP member, dual member, supervisor, department head, DPS, suspended member, public visitor) plus a technical administrator. It checks direct-write refusal, department boundaries, self-approval, duplicate and simultaneous decisions, overlap across departments, quota and leave math, suspension, and what the public can see.

After changing a migration, run `bash scripts/build-setup-sql.sh` to regenerate `supabase/setup.sql`.

## Later stages

- Stage 2: reports, registrations, evidence, warrants, BOLOs, record linking.
- Stage 3: training, certifications, subdivisions, applications, appeals.
- Stage 4: grounded AI assistant, Discord integration, analytics.
