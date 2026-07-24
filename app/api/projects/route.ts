import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const withGroupAndCounts = {
  group: true,
  _count: { select: { calendarBlocks: true, templateBlocks: true } },
} as const;

/** GET /api/projects — list this user's projects, with group + usage counts. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const projects = await prisma.project.findMany({
    where: { userId },
    include: withGroupAndCounts,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ projects });
}

/** POST /api/projects  Body: { name, groupId } */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { name, groupId } = (await req.json()) as { name: string; groupId: string };

  if (typeof name !== "string" || !name.trim() || typeof groupId !== "string") {
    return NextResponse.json(
      { error: "name and groupId are required" },
      { status: 400 }
    );
  }

  const group = await prisma.projectGroup.findFirst({ where: { id: groupId, userId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const project = await prisma.project
    .create({
      data: { userId, groupId, name: name.trim() },
      include: withGroupAndCounts,
    })
    .catch(() => null);

  if (!project) {
    return NextResponse.json(
      { error: "A project with that name already exists" },
      { status: 409 }
    );
  }

  return NextResponse.json({ project });
}

/** PATCH /api/projects  Body: { projectId, name?, groupId? } */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { projectId, name, groupId } = (await req.json()) as {
    projectId: string;
    name?: string;
    groupId?: string;
  };

  if (groupId !== undefined) {
    const group = await prisma.projectGroup.findFirst({ where: { id: groupId, userId } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
  }

  const result = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: withGroupAndCounts,
  });

  return NextResponse.json({ project });
}

/**
 * DELETE /api/projects  Body: { projectId }
 * Cascades to CalendarBlocks and TemplateBlocks (schema onDelete: Cascade).
 * The client shows _count.calendarBlocks/_count.templateBlocks from GET and
 * should confirm with the user before calling this if either is nonzero.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { projectId } = (await req.json()) as { projectId: string };

  await prisma.project.deleteMany({ where: { id: projectId, userId } });

  return NextResponse.json({ ok: true });
}
