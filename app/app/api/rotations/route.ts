import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidWeekId } from "@/lib/weeks";

const entriesInclude = {
  entries: {
    orderBy: { position: "asc" },
    include: { template: { select: { id: true, name: true } } },
  },
} as const;

/**
 * Template rotations — see the TemplateRotation comment in
 * prisma/schema.prisma. Changing a rotation only affects weeks opened from
 * then on; weeks already filled keep their blocks.
 */

/** GET /api/rotations — this user's rotations, entries in order. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const rotations = await prisma.templateRotation.findMany({
    where: { userId },
    include: entriesInclude,
    orderBy: { startWeekId: "asc" },
  });

  return NextResponse.json({ rotations });
}

/** Rejects template ids that aren't this user's; returns an error message or null. */
async function checkTemplateIds(userId: string, templateIds: unknown): Promise<string | null> {
  if (!Array.isArray(templateIds) || !templateIds.every((id) => typeof id === "string")) {
    return "templateIds must be an array of template ids";
  }
  const owned = await prisma.template.count({
    where: { userId, id: { in: [...new Set(templateIds as string[])] } },
  });
  return owned === new Set(templateIds).size ? null : "Unknown template in templateIds";
}

function conflictMessage(err: unknown): string | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return null;
  const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
  return target.includes("startWeekId")
    ? "Another rotation already starts that week"
    : "A rotation with that name already exists";
}

/**
 * POST /api/rotations
 * Body: { name, startWeekId, templateIds: string[] }  (templateIds in rotation order)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { name, startWeekId, templateIds } = (await req.json()) as {
    name: string;
    startWeekId: string;
    templateIds: string[];
  };
  if (typeof name !== "string" || !name.trim() || typeof startWeekId !== "string" || !isValidWeekId(startWeekId)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const templateError = await checkTemplateIds(userId, templateIds);
  if (templateError) {
    return NextResponse.json({ error: templateError }, { status: 400 });
  }

  try {
    const rotation = await prisma.templateRotation.create({
      data: {
        userId,
        name: name.trim(),
        startWeekId,
        entries: { create: templateIds.map((templateId, position) => ({ templateId, position })) },
      },
      include: entriesInclude,
    });
    return NextResponse.json({ rotation });
  } catch (err) {
    const message = conflictMessage(err);
    if (message) return NextResponse.json({ error: message }, { status: 409 });
    throw err;
  }
}

/**
 * PATCH /api/rotations
 * Body: { rotationId, name?, startWeekId?, templateIds? }
 *
 * templateIds (if provided) REPLACES the rotation's order wholesale, same as
 * PATCH /api/templates does for a template's blocks.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { rotationId, name, startWeekId, templateIds } = (await req.json()) as {
    rotationId: string;
    name?: string;
    startWeekId?: string;
    templateIds?: string[];
  };
  if (
    typeof rotationId !== "string" ||
    (name !== undefined && (typeof name !== "string" || !name.trim())) ||
    (startWeekId !== undefined && (typeof startWeekId !== "string" || !isValidWeekId(startWeekId)))
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (templateIds !== undefined) {
    const templateError = await checkTemplateIds(userId, templateIds);
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 400 });
    }
  }

  try {
    const rotation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.templateRotation.findFirst({ where: { id: rotationId, userId } });
      if (!existing) return null;

      if (templateIds) {
        await tx.templateRotationEntry.deleteMany({ where: { rotationId } });
      }

      return tx.templateRotation.update({
        where: { id: rotationId },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(startWeekId !== undefined ? { startWeekId } : {}),
          ...(templateIds
            ? { entries: { create: templateIds.map((templateId, position) => ({ templateId, position })) } }
            : {}),
        },
        include: entriesInclude,
      });
    });

    if (!rotation) {
      return NextResponse.json({ error: "Rotation not found" }, { status: 404 });
    }
    return NextResponse.json({ rotation });
  } catch (err) {
    const message = conflictMessage(err);
    if (message) return NextResponse.json({ error: message }, { status: 409 });
    throw err;
  }
}

/** DELETE /api/rotations  Body: { rotationId } */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { rotationId } = (await req.json()) as { rotationId: string };

  await prisma.templateRotation.deleteMany({ where: { id: rotationId, userId } });

  return NextResponse.json({ ok: true });
}
