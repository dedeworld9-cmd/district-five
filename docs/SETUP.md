# Putting the District Five hub online

This guide takes the hub from this repository to a live site. It uses three free accounts: GitHub (holds the code), Supabase (database and Discord sign-in), and Vercel (runs the website). Plan on about 30 minutes.

You will copy a few values between sites. Keep a notes file open while you work.

## 1. Supabase: create the database

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Name it `district-five`, pick a strong database password (save it in your notes), and choose the region closest to most members.
3. Wait for the project to finish setting up.
4. Open **SQL Editor** → **New query**.
5. Open `supabase/setup.sql` from this repository, copy the whole file, paste it into the editor, and click **Run**. It should finish with "Success. No rows returned."
6. Open **Project Settings** → **API** (sometimes listed as **Data API** and **API Keys**). Copy these into your notes:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - The **anon** (or **publishable**) key

Run `setup.sql` only once. Later updates come as separate files in `supabase/migrations/`, and you run only the new ones.

## 2. Discord: allow sign-in

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Name it `District Five Hub`.
2. Open **OAuth2**. Copy the **Client ID**, then click **Reset Secret** and copy the **Client Secret**.
3. Under **Redirects**, add `https://YOUR-PROJECT.supabase.co/auth/v1/callback`, using your Project URL from step 1. Save.
4. Back in Supabase, open **Authentication** → **Sign In / Providers** → **Discord**. Turn it on, paste the Client ID and Client Secret, and save.

The hub asks Discord only for the `identify` scope: the member's Discord ID, username and avatar. It never sees email addresses, servers or messages.

## 3. Vercel: put the website online

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New** → **Project** and import the `district-five` repository.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon or publishable key |

   Do not add `NEXT_PUBLIC_D5_DEV_LOGIN`. That switch is for local testing only.
4. Click **Deploy**. When it finishes, copy the site address, for example `https://district-five.vercel.app`.
5. In Supabase, open **Authentication** → **URL Configuration**:
   - Set **Site URL** to your site address.
   - Under **Redirect URLs**, add `https://YOUR-SITE.vercel.app/auth/callback`.

## 4. First sign-in and making yourself administrator

1. Open your site, click **Member sign in**, and sign in with Discord. You will land on a "Request to join" page, which is expected.
2. In Supabase, open **SQL Editor** → **New query** and run the following, with your Discord username in place of `your-discord-username`:

   ```sql
   update public.profiles set is_admin = true where discord_username like 'your-discord-username%';
   ```

   If nothing changes, run `select display_name, discord_username from public.profiles;` to see what name was saved.
3. Reload the site. An **Admin** tab now appears.

Technical administrator is a separate role from command. It lets you change settings, ranks and the roster. It does not show confidential personnel records.

## 5. Set up DPS and the rosters

1. **Confirm the ranks.** Go to **Admin** → **Ranks**. The ladders were copied from the BCSO and SAHP Discord channels and are marked *sample*. Correct any names or tiers and click **Save** on each one. The tier decides what a rank can review and approve:
   - **Probationary** and **Patrol**: regular members.
   - **Supervisor**: reviews shift logs.
   - **High command**: decides roster requests and posts department announcements.
   - **Department head**: reads personnel records and approves posts for the public site.
   - **DPS**: district oversight across both departments.
2. **Add DPS command.** Go to **Admin** → **Roster import** and add one line per DPS member, for example:

   ```
   dps, M. Hathaway, 123456789012345678, Deputy Commissioner, E-02,
   ```

   The long number is the person's Discord ID. In Discord, turn on Developer Mode under Settings → Advanced, then right-click the person and choose **Copy User ID**.
3. **Import the existing rosters** the same way, with one line per member:

   ```
   bcso, J. Doe, 234567890123456789, Sergeant, 1S-10, 1010
   sahp, A. Smith, 345678901234567890, Trooper, 4A-12, 2212
   ```

   Each roster entry links to its member automatically the first time that person signs in with Discord.
4. **Department settings.** Under **Admin** → **Settings**, set each department's weekly quota (4 hours by default), the day the week starts, and the time zone. You can turn on the bodycam requirement and paste your department's own bodycam policy wording. The hub never writes policy text itself.
5. **Dual members.** Choose whether someone in both departments meets one combined quota or each department's quota separately. Combined is the default. Time is never counted twice either way.

## 6. Optional: demo data

**Admin** → **Settings** → **Load demo data** adds six fictional roster entries and a welcome post, each labeled `[DEMO]`. **Remove demo data** deletes all of it.

## Who can do what

The database checks every permission, so a member cannot get around a rule by editing the page or calling the API directly. The automated tests in `supabase/tests/` cover each of these rules.

| | Member | Supervisor | High command | Department head | DPS | Admin |
|---|---|---|---|---|---|---|
| Log and edit own shifts | ✓ | ✓ | ✓ | ✓ | | |
| Review shift logs in own department | | ✓ | ✓ | ✓ | both departments | |
| Approve own shift log | never | never | never | never | never | never |
| Decide roster requests | | | ✓ | ✓ | ✓ | ✓ |
| Appoint department heads | | | | | ✓ | ✓ |
| Department announcements | | | ✓ | ✓ | ✓ | |
| District announcements | | | | | ✓ | |
| Approve posts for the public site | | | | ✓ | ✓ | |
| Read personnel records | | | | ✓ | if granted | |
| Settings, ranks, routing, import | | | | | | ✓ |

The hub flags members who are below quota so supervisors can check in. It never issues strikes.

Supervisors' own shift logs go to high command, high command's go to the department head, and department heads' go to DPS. You can change this under **Admin** → **Review routing**.

## Updating later

When new files appear in `supabase/migrations/`, open each new one in order, paste it into the Supabase SQL editor, and run it. Vercel redeploys the website by itself whenever the code on GitHub changes.
