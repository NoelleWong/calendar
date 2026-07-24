# Calendar App

See `CLAUDE.md` for architecture, data model, and conventions.

## Local setup

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, NEXTAUTH_SECRET, Google OAuth keys
npx prisma migrate dev --name init
npm run dev
```

Visit `http://localhost:3000/calendar/2026-W29` for a single week, or
`http://localhost:3000/compare?weeks=2026-W29,2026-W30` to compare two weeks.

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add env vars from `.env.example` in the Vercel project settings
   (`DATABASE_URL` from your managed Postgres — Neon/Supabase/Railway all work).
4. Vercel runs `npm run build`, which runs `prisma generate` then
   `next build`. Run `npx prisma migrate deploy` once against the production
   DB (locally, pointed at the prod `DATABASE_URL`, or as a one-off Vercel
   deploy hook) before first use.

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
