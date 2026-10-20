import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rotationEntryForWeek } from "@/lib/rotation";

/**
 * Server-side: deciding which template fills a week, and copying it in.
 * Templates are only ever *copied* into CalendarBlock rows — see CLAUDE.md
 * "Templates are read-only at instantiation time."
 */

export interface ScheduledTemplate {
  template: { id: string; name: string };
  /** The rotation that picked it; null when it's the default-template fallback. */
  rotation: { id: string; name: string } | null;
}

/**
 * The template a week is scheduled to be filled from: the in-effect
 * rotation's entry for that week, else the user's default template.
 */
export async function scheduledTemplateForWeek(
  userId: string,
  weekId: string
): Promise<ScheduledTemplate | null> {
  const rotations = await prisma.templateRotation.findMany({
    where: { userId, startWeekId: { lte: weekId } },
    include: {
      entries: { orderBy: { position: "asc" }, include: { template: { select: { id: true, name: true } } } },
    },
  });
  const picked = rotationEntryForWeek(rotations, weekId);
  if (picked) {
    return {
      template: picked.entry.template,
      rotation: { id: picked.rotation.id, name: picked.rotation.name },
    };
  }

  const fallback = await prisma.template.findFirst({
    where: { userId, isDefault: true },
    select: { id: true, name: true },
  });
  return fallback ? { template: fallback, rotation: null } : null;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Fills a week from its scheduled template the first time it's opened.
 * A CalendarWeek row marks the week as filled, so this runs at most once
 * per week — a week the user later empties stays empty.
 *
 * Weeks that already have blocks but no CalendarWeek row (created before
 * weeks were tracked, or filled by hand while no template applied) are just
 * marked, never re-filled. Weeks with nothing to fill them from are left
 * unmarked, so they still pick up a rotation/default set up later.
 */
export async function ensureWeekFilled(userId: string, weekId: string): Promise<void> {
  const marker = await prisma.calendarWeek.findUnique({
    where: { userId_weekId: { userId, weekId } },
  });
  if (marker) return;

  const existingBlocks = await prisma.calendarBlock.count({ where: { userId, weekId } });
  if (existingBlocks > 0) {
    await prisma.calendarWeek.upsert({
      where: { userId_weekId: { userId, weekId } },
      create: { userId, weekId },
      update: {},
    });
    return;
  }

  const scheduled = await scheduledTemplateForWeek(userId, weekId);
  if (!scheduled) return;

  const templateBlocks = await prisma.templateBlock.findMany({
    where: { templateId: scheduled.template.id },
    select: { dayOfWeek: true, slotIndex: true, projectId: true },
  });

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Marker first: if a concurrent request (e.g. the calendar page's
      // parallel fetches) already filled this week, the unique constraint
      // fails here and this whole copy rolls back instead of doubling up.
      await tx.calendarWeek.create({
        data: { userId, weekId, templateId: scheduled.template.id },
      });
      await tx.calendarBlock.createMany({
        data: templateBlocks.map((tb) => ({
          userId,
          weekId,
          dayOfWeek: tb.dayOfWeek,
          slotIndex: tb.slotIndex,
          projectId: tb.projectId,
          createdFrom: "TEMPLATE" as const,
        })),
        skipDuplicates: true,
      });
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

/**
 * Replaces a week's blocks with a fresh copy of the given template — used
 * for both "apply a different template to this week" and "reset this week
 * to its template". Returns false if the template isn't the user's.
 */
export async function applyTemplateToWeek(
  userId: string,
  weekId: string,
  templateId: string
): Promise<boolean> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const template = await tx.template.findFirst({
      where: { id: templateId, userId },
      include: { blocks: true },
    });
    if (!template) return false;

    await tx.calendarBlock.deleteMany({ where: { userId, weekId } });
    await tx.calendarBlock.createMany({
      data: template.blocks.map((tb) => ({
        userId,
        weekId,
        dayOfWeek: tb.dayOfWeek,
        slotIndex: tb.slotIndex,
        projectId: tb.projectId,
        createdFrom: "TEMPLATE" as const,
      })),
    });
    await tx.calendarWeek.upsert({
      where: { userId_weekId: { userId, weekId } },
      create: { userId, weekId, templateId },
      update: { templateId },
    });
    return true;
  });
}
