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
- `/api/blocks` (GET/POST/DELETE) and `/api/templates` (GET/POST/PATCH/DELETE)
- `CalendarGrid` + `Bubble` + `WeekCountsSummary` components
- `/calendar/[weekId]` and `/compare` pages, NextAuth (Google) wiring

Not yet wired (marked with TODOs in the pages):
- Project/group management UI (create/edit/delete projects & groups)
- Slot-click → project picker (assigning a project to an empty slot)
- Bubble-click → edit/split/delete affordance
- Template editor UI (currently only reachable via the API)
