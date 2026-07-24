import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/groups — list this user's project groups. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const groups = await prisma.projectGroup.findMany({
    where: { userId },
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ groups });
}

/** POST /api/groups  Body: { name, color } */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { name, color } = (await req.json()) as { name: string; color: string };

  if (typeof name !== "string" || !name.trim() || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json(
      { error: "name is required and color must be a hex like #RRGGBB" },
      { status: 400 }
    );
  }

  const group = await prisma.projectGroup
    .create({ data: { userId, name: name.trim(), color } })
    .catch(() => null);

  if (!group) {
    return NextResponse.json(
      { error: "A group with that name already exists" },
      { status: 409 }
    );
  }

  return NextResponse.json({ group });
}

/** PATCH /api/groups  Body: { groupId, name?, color? } */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { groupId, name, color } = (await req.json()) as {
    groupId: string;
    name?: string;
    color?: string;
  };

  if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "color must be a hex like #RRGGBB" }, { status: 400 });
  }

  const result = await prisma.projectGroup.updateMany({
    where: { id: groupId, userId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const group = await prisma.projectGroup.findUnique({ where: { id: groupId } });
  return NextResponse.json({ group });
}

/**
 * DELETE /api/groups  Body: { groupId }
 * Cascades to Projects and their CalendarBlocks/TemplateBlocks (see schema
 * onDelete: Cascade) — the client should confirm with the user before
 * calling this, since it can silently remove historical time data.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { groupId } = (await req.json()) as { groupId: string };

  await prisma.projectGroup.deleteMany({ where: { id: groupId, userId } });

  return NextResponse.json({ ok: true });
}
