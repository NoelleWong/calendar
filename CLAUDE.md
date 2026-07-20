# CLAUDE.md — Calendar Comparison App

Context file for Claude Code sessions on this repo. Read this before making changes.

## What this app does

A weekly calendar where each 30-minute slot can hold a block belonging to a
**Project**, which belongs to a **Project Group**. Consecutive same-project
slots render as a single **bubble** whose length is proportional to duration,
colored by the project's group — e.g. a 30-min slot on Project A followed by
a 90-min run on Project B renders as two touching bubbles, the second three
times the length of the first. Storage stays at 30-min granularity underneath;
bubbles are a rendering-layer merge of contiguous same-project slots.
Users maintain a default weekly **Template**; new weeks auto-populate from it
but can be freely edited without changing the template. Users can view
multiple weeks side by side and see aggregate counts of blocks by color
(group) and by project.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + Postgres (Neon/Supabase/Railway)
- NextAuth.js for auth
- Deployed on Vercel

## Data model

```
User
 ├─ id, email, name

ProjectGroup                 // the "color" level
 ├─ id, userId, name, color (hex)

Project                      // the "bubble" level
 ├─ id, userId, groupId → ProjectGroup, name

CalendarBlock
 ├─ id, userId, projectId → Project
 ├─ weekId, dayOfWeek (0–6), slotIndex (0–47, 30-min increments)
 ├─ createdFrom: 'template' | 'manual'

Template
 ├─ id, userId, name

TemplateBlock
 ├─ id, templateId → Template
 ├─ dayOfWeek, slotIndex, projectId → Project
```

**Rule: a block's color is always derived through its Project → ProjectGroup.**
Never store color directly on `CalendarBlock` or `Project`. This keeps color
and project counts a simple `GROUP BY` with no denormalized fields to keep in
sync.

**Rule: bubbles are a display-layer merge, never stored.** A bubble is
computed by scanning a day's `CalendarBlock`s in `slotIndex` order and
merging consecutive slots that share the same `projectId` into one visual
unit. Bubble length = `slotCount * unitSize`. Do not persist bubbles or
bubble boundaries — recompute on every render from the raw slots, so editing
a single 30-min slot (e.g. splitting a bubble) is just an update to that
slot's `CalendarBlock` row, and the bubble merge naturally reflects it.

**Rule: adjacent bubbles must stay visually distinguishable even when they
share a color.** Two touching bubbles from different projects in the same
group will have identical fill color, so the renderer needs a separator
(e.g. a thin border/gap between bubbles, or a rounded-pill shape per bubble)
so the boundary between projects is never ambiguous — merging same-color
neighbors into one shape would corrupt both the visual and the "click to
edit" hit-testing per project.

## Core conventions

- **Templates are read-only at instantiation time.** When a week has no
  blocks yet, populate it by *copying* `TemplateBlock` rows into real
  `CalendarBlock` rows tagged `createdFrom: 'template'`. Never reference the
  template live from the week view — editing a week must never mutate the
  template, and a "reset week to template" action is just "delete this
  week's blocks, re-copy from template."
- **Weeks are identified by `weekId`**, an ISO week string like `2026-W29`
  (Monday-start). Don't use raw dates as the primary key for a week's blocks;
  derive dates from `weekId` + `dayOfWeek` for display only.
- **Slot indexing:** `slotIndex` 0–47 maps to 30-minute blocks starting at
  midnight (`slotIndex * 30` minutes from midnight). If we later support a
  restricted visible range (e.g. 7am–10pm only), that's a display-layer
  filter, not a change to indexing.
- **Color resolution helper:** all group-color lookups go through
  `lib/colors.ts` (e.g. `resolveGroupColor(project)` → hex). Don't inline
  color logic in components.
- **Bubble merge helper:** `lib/bubbles.ts` exports
  `mergeBlocksIntoBubbles(blocks: CalendarBlock[]): Bubble[]`, taking one
  day's blocks (sorted by `slotIndex`) and returning
  `{ projectId, startSlot, slotCount }[]`. Both the single-week view and the
  comparison view call this per day before rendering.
- **Aggregation helper:** count-by-color and count-by-project both go through
  `lib/counts.ts`, parameterized by one or more `weekId`s, and operate on raw
  `CalendarBlock` rows (30-min slots), independent of bubble merging — so
  counts always reflect actual time, not visual bubble count.

## Routes (planned)

```
/calendar/[weekId]              single week grid
/compare?weeks=w1,w2,...         side-by-side weeks, scroll-synced
/templates                       manage default template
/api/blocks                      CRUD for CalendarBlock
/api/templates                   CRUD for Template / TemplateBlock
```

## Environment variables

```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
# OAuth provider (Google/GitHub/etc. — TBD): client ID/secret vars go here
# e.g. GOOGLE_CLIENT_ID=, GOOGLE_CLIENT_SECRET=
```

## Deploy

- Frontend + API routes: Vercel, auto-deploy from `main`.
- DB: managed Postgres (Neon/Supabase/Railway) — connection string in
  `DATABASE_URL`, migrations via `npx prisma migrate deploy` as part of the
  build step.

## Decisions log

- **Bubble shape:** rounded pill per bubble, with a visible gap between
  adjacent bubbles (not just a border) — so touching same-color bubbles from
  different projects are unambiguously separate shapes. Gap eats into each
  bubble's rendered length slightly; keep gap fixed-width (e.g. 2px) rather
  than proportional, so short (30-min) bubbles aren't visually dominated by
  the gap.
- **Auth provider:** OAuth (via NextAuth). Provider(s) — Google/GitHub/etc. —
  still TBD at implementation time; note choice here once added, and update
  the env var list below with the corresponding client ID/secret vars.
- **Visible hour range:** full 24h grid (`slotIndex` 0–47 all shown). No
  business-hours filtering.
- **Sharing model:** confirmed per-user only, no team/multi-user sharing.
  `userId` ownership on `ProjectGroup`/`Project`/`CalendarBlock`/`Template`
  stands as designed — no join tables or shared-visibility flags needed.
