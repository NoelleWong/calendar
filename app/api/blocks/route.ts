import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const projectInclude = { project: { include: { group: true } } } as const;

/**
 * GET /api/blocks?weekId=2026-W29[&weekId=2026-W30...]
 *
 * Returns blocks for one or more weeks (multiple weekId params supported
 * for the comparison view, so the client can request everything it needs
 * in one call rather than one request per week).
 *
 * If a requested week has no blocks yet, it is instantiated from the
 * user's default Template first — copied into real CalendarBlock rows
 * tagged createdFrom: TEMPLATE. See CLAUDE.md, "Templates are read-only
 * at instantiation time."
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

  for (const weekId of weekIds) {
    await instantiateWeekFromTemplateIfEmpty(userId, weekId);
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
 * Body: { weekId, dayOfWeek, slotIndex, projectId }
 *
 * Upserts a single 30-min slot. Uses the (userId, weekId, dayOfWeek,
 * slotIndex) unique constraint so this doubles as "set/overwrite this slot."
 * A slot set here is always createdFrom: MANUAL, even if it happens to
 * match the template's assignment — see CLAUDE.md: editing is per-slot,
 * bubbles/merging are recomputed client-side and never mutate the template.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { weekId, dayOfWeek, slotIndex, projectId } = body as {
    weekId: string;
    dayOfWeek: number;
    slotIndex: number;
    projectId: string;
  };

  if (
    typeof weekId !== "string" ||
    typeof dayOfWeek !== "number" ||
    typeof slotIndex !== "number" ||
    typeof projectId !== "string"
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const block = await prisma.calendarBlock.upsert({
    where: {
      userId_weekId_dayOfWeek_slotIndex: { userId, weekId, dayOfWeek, slotIndex },
    },
    create: { userId, weekId, dayOfWeek, slotIndex, projectId, createdFrom: "MANUAL" },
    update: { projectId, createdFrom: "MANUAL" },
    include: projectInclude,
  });

  return NextResponse.json({ block });
}

/**
 * DELETE /api/blocks
 * Body: { weekId, dayOfWeek, slotIndex }
 * Clears a single slot (removes the block entirely, leaving it empty).
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { weekId, dayOfWeek, slotIndex } = body as {
    weekId: string;
    dayOfWeek: number;
    slotIndex: number;
  };

  await prisma.calendarBlock
    .delete({
      where: {
        userId_weekId_dayOfWeek_slotIndex: { userId, weekId, dayOfWeek, slotIndex },
      },
    })
    .catch(() => null); // already empty — deleting a non-existent slot is a no-op

  return NextResponse.json({ ok: true });
}

async function instantiateWeekFromTemplateIfEmpty(userId: string, weekId: string) {
  const existingCount = await prisma.calendarBlock.count({ where: { userId, weekId } });
  if (existingCount > 0) return;

  const defaultTemplate = await prisma.template.findFirst({
    where: { userId, isDefault: true },
    include: { blocks: true },
  });
  if (!defaultTemplate || defaultTemplate.blocks.length === 0) return;

  await prisma.calendarBlock.createMany({
    data: defaultTemplate.blocks.map((tb) => ({
      userId,
      weekId,
      dayOfWeek: tb.dayOfWeek,
      slotIndex: tb.slotIndex,
      projectId: tb.projectId,
      createdFrom: "TEMPLATE" as const,
    })),
    skipDuplicates: true,
  });
}
