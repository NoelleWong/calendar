# Calendar App

See `CLAUDE.md` for architecture, data model, and conventions.

## Local setup

```bash
cd app
npm install
cp .env.example .env       # fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, Google OAuth keys
npx prisma migrate dev --name init # if this fails, paste this in powershell to test: Test-NetConnection ep-bitter-grass-ayljvou6-pooler.c-5.us-east-2.aws.neon.tech -port 5432 (make sure not on any office or school wifi networks that block port 5432)
npm run dev
```

Visit `http://localhost:3000/calendar/2026-W29` for a single week, or
`http://localhost:3000/compare?weeks=2026-W29,2026-W30` to compare two weeks.

## Regarding the .env
**DATABASE_URL** one option is Neon (neon.tech): create a free project, go to the dashboard, copy the connection string shown (looks like postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require)
**NEXTAUTH_URL** leave as http://localhost:3000 for local dev. Once deployed, set this to your actual production URL in Vercel's env vars (e.g. https://your-app.vercel.app).

**NEXTAUTH_SECRET** generate by pasting in bash shell:
```
openssl rand -base64 32
```

**GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET** from Google Cloud Console.
1. Go to console.cloud.google.com → create a project (or pick an existing one)
2. APIs & Services → OAuth consent screen → set it up (External user type is fine for personal use; fill in app name, your email)
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
4. Application type: Web application
5. Under Authorized redirect URIs, add:
- http://localhost:3000/api/auth/callback/google (for local dev)
- https://your-app.vercel.app/api/auth/callback/google (once deployed)
6. Click Create — it'll show you the Client ID and Client Secret right there. Copy both into your .env.

## Regarding the database
Run the following and choose your options
```
npx neonctl init
```
I got to this
```
To finish setting up Neon using Neon's agent-guided onboarding experience,
have your agent run this shell command: neon init --agent --data
'{"step":"getting-started","hasConnectionString":true,"framework":"next","orm":"prisma","migrationTool":"prisma","features":["database","auth"]}'
```
Run the following
```
npx neon-init --agent --data '{"step":"getting-started","hasConnectionString":true,"framework":"next","orm":"prisma","migrationTool":"prisma","features":["database","auth"]}'
```

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add env vars from `.env.example` in the Vercel project settings
   (`DATABASE_URL` from your managed Postgres — Neon/Supabase/Railway all work).
   `DIRECT_URL` is required for the **Production** environment: in Neon it's
   the connection string with connection pooling turned off (same as
   `DATABASE_URL` minus `-pooler` in the host).
4. Vercel runs `npm run vercel-build` (`scripts/vercel-build.sh`): `prisma
   generate`, then on production deploys only `prisma migrate deploy`, then
   `next build`. Preview deploys skip migrations so an unmerged branch never
   changes the production database. If the Vercel project overrides the
   Build Command in its settings, clear that override, or this script won't
   run.

## What's scaffolded vs. still to build

Done:
- Prisma schema (`prisma/schema.prisma`)
- Bubble-merge, color, and counts logic (`lib/bubbles.ts`, `lib/colors.ts`, `lib/counts.ts`)
- `/api/blocks`, `/api/templates`, `/api/groups`, `/api/projects` (full CRUD)
- `CalendarGrid` + `Bubble` + `WeekCountsSummary` + `ProjectPicker` + `BubbleActionSheet` components (reused across live weeks and the template editor)
- `/calendar/[weekId]` (empty-slot assignment, bubble click → change project / split / delete), `/compare`, `/projects`, and `/templates` (create/rename/delete templates, set default, edit a template's blocks with the same picker/action-sheet flow, save wholesale) pages
- NextAuth (Google) wiring
- Top nav linking all four pages

Everything from the original feature list is now wired end to end. Natural next steps, not yet built:
- Drag-to-select a multi-slot range in one gesture (currently: click empty slot → assign one 30-min slot at a time, or use Split on an existing bubble to carve out a sub-range)
- Auth: Google OAuth client ID/secret still need to be created in Google Cloud Console and added to `.env`
- Any polish pass on mobile/narrow-viewport layout — grid assumes a desktop-width viewport
