import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureWeekFilled } from "@/lib/weekTemplates";
import { isValidWeekId } from "@/lib/weeks";

const projectInclude = { project: { include: { group: true } } } as const;

/**
 * GET /api/blocks?weekId=2026-W29[&weekId=2026-W30...]
 *
 * Returns blocks for one or more weeks (multiple weekId params supported
 * for the comparison view, so the client can request everything it needs
 * in one call rather than one request per week).
 *
 * A requested week opened for the first time is filled first, from the
 * template its rotation (or the default template) schedules for it —
 * copied into real CalendarBlock rows tagged createdFrom: TEMPLATE. See
 * lib/weekTemplates.ts and CLAUDE.md, "Templates are read-only at
 * instantiation time."
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const weekIds = req.nextUrl.searchParams.getAll("weekId");
  if (weekIds.length === 0) {
    return NextResponse.json(
      { error: "At least one weekId query param is required" },
      { status: 400 }
    );
  }
  const invalid = weekIds.find((w) => !isValidWeekId(w));
  if (invalid) {
    return NextResponse.json({ error: `Invalid weekId: ${invalid}` }, { status: 400 });
  }

  for (const weekId of weekIds) {
    await ensureWeekFilled(userId, weekId);
  }

  const blocks = await prisma.calendarBlock.findMany({
    where: { userId, weekId: { in: weekIds } },
    include: projectInclude,
    orderBy: [{ weekId: "asc" }, { dayOfWeek: "asc" }, { slotIndex: "asc" }],
  });

  return NextResponse.json({ blocks });
}

/**
 * POST /api/blocks
 * Body: { weekId, dayOfWeek, slotIndex, slotCount?, projectId }
 *
 * Upserts a contiguous run of slots starting at slotIndex (slotCount slots,
 * default 1) to projectId. Used for: assigning an empty slot (slotCount=1),
 * reassigning a whole bubble (slotCount = bubble.slotCount), and completing
 * a split (slotCount = the portion being reassigned). Uses the (userId,
 * weekId, dayOfWeek, slotIndex) unique constraint per slot, so this doubles
 * as "set/overwrite these slots." All slots written here are always
 * createdFrom: MANUAL — see CLAUDE.md: editing is per-slot, bubbles/merging
 * are recomputed client-side and never mutate the template.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const {
    weekId,
    dayOfWeek,
    slotIndex,
    slotCount = 1,
    projectId,
  } = body as {
    weekId: string;
    dayOfWeek: number;
    slotIndex: number;
    slotCount?: number;
    projectId: string;
  };

  if (
    typeof weekId !== "string" ||
    typeof dayOfWeek !== "number" ||
    typeof slotIndex !== "number" ||
    typeof projectId !== "string" ||
    !Number.isInteger(slotCount) ||
    slotCount < 1 ||
    slotIndex < 0 ||
    slotIndex + slotCount > 48
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const blocks = await prisma.$transaction(
    Array.from({ length: slotCount }, (_, i) =>
      prisma.calendarBlock.upsert({
        where: {
          userId_weekId_dayOfWeek_slotIndex: {
            userId,
            weekId,
            dayOfWeek,
            slotIndex: slotIndex + i,
          },
        },
        create: {
          userId,
          weekId,
          dayOfWeek,
          slotIndex: slotIndex + i,
          projectId,
          createdFrom: "MANUAL",
        },
        update: { projectId, createdFrom: "MANUAL" },
        include: projectInclude,
      })
    )
  );

  return NextResponse.json({ blocks });
}

/**
 * DELETE /api/blocks
 * Body: { weekId, dayOfWeek, slotIndex, slotCount? }
 * Clears a contiguous run of slots (slotCount slots, default 1) starting at
 * slotIndex, leaving them empty. Used for both single-slot clear and
 * whole-bubble delete (slotCount = bubble.slotCount).
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { weekId, dayOfWeek, slotIndex, slotCount = 1 } = body as {
    weekId: string;
    dayOfWeek: number;
    slotIndex: number;
    slotCount?: number;
  };

  if (
    typeof weekId !== "string" ||
    typeof dayOfWeek !== "number" ||
    typeof slotIndex !== "number" ||
    !Number.isInteger(slotCount) ||
    slotCount < 1
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.calendarBlock.deleteMany({
    where: {
      userId,
      weekId,
      dayOfWeek,
      slotIndex: { gte: slotIndex, lt: slotIndex + slotCount },
    },
  });

  return NextResponse.json({ ok: true });
}
