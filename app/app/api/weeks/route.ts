import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyTemplateToWeek, ensureWeekFilled, scheduledTemplateForWeek } from "@/lib/weekTemplates";
import { isValidWeekId } from "@/lib/weeks";

/**
 * GET /api/weeks?weekId=2026-W44
 *
 * Which template a week was filled from (`appliedTemplate`, null if none)
 * and which one its rotation / the default template schedules for it
 * (`scheduled`) — the two differ once a different template has been
 * applied by hand, or the rotation changed after the week was filled.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const weekId = req.nextUrl.searchParams.get("weekId") ?? "";
  if (!isValidWeekId(weekId)) {
    return NextResponse.json({ error: "Invalid weekId" }, { status: 400 });
  }

  // Same first-open fill as GET /api/blocks, so this reports the template
  // even when it's fetched in parallel with (or before) the week's blocks.
  await ensureWeekFilled(userId, weekId);

  const [week, scheduled] = await Promise.all([
    prisma.calendarWeek.findUnique({
      where: { userId_weekId: { userId, weekId } },
      include: { template: { select: { id: true, name: true } } },
    }),
    scheduledTemplateForWeek(userId, weekId),
  ]);

  return NextResponse.json({
    weekId,
    appliedTemplate: week?.template ?? null,
    scheduled,
  });
}

/**
 * POST /api/weeks
 * Body: { weekId, templateId }
 *
 * Replaces this week's blocks with a fresh copy of the template. Only this
 * week changes; the template itself is never touched.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { weekId, templateId } = (await req.json()) as { weekId: string; templateId: string };
  if (typeof weekId !== "string" || !isValidWeekId(weekId) || typeof templateId !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const applied = await applyTemplateToWeek(userId, weekId, templateId);
  if (!applied) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
