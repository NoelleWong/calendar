import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const blocksInclude = { blocks: { include: { project: { include: { group: true } } } } } as const;

/** GET /api/templates — list this user's templates (with their blocks). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const templates = await prisma.template.findMany({
    where: { userId },
    include: blocksInclude,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ templates });
}

/**
 * POST /api/templates
 * Body: { name, blocks: { dayOfWeek, slotIndex, projectId }[], isDefault? }
 *
 * Creates a new template. If isDefault is true, unsets any existing default
 * for this user first (only one default per user — see schema comment on
 * Template.isDefault).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { name, blocks, isDefault } = body as {
    name: string;
    blocks: { dayOfWeek: number; slotIndex: number; projectId: string }[];
    isDefault?: boolean;
  };

  if (typeof name !== "string" || !Array.isArray(blocks)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const template = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (isDefault) {
      await tx.template.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.template.create({
      data: {
        userId,
        name,
        isDefault: !!isDefault,
        blocks: { create: blocks },
      },
      include: blocksInclude,
    });
  });

  return NextResponse.json({ template });
}

/**
 * PATCH /api/templates
 * Body: { templateId, name?, isDefault?, blocks? }
 *
 * blocks (if provided) REPLACES the template's block list wholesale —
 * simpler and safer than diffing, since templates are typically edited as
 * a whole week at once via the UI, not slot-by-slot.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { templateId, name, isDefault, blocks } = body as {
    templateId: string;
    name?: string;
    isDefault?: boolean;
    blocks?: { dayOfWeek: number; slotIndex: number; projectId: string }[];
  };

  if (typeof templateId !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const template = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Ownership check
    const existing = await tx.template.findFirst({ where: { id: templateId, userId } });
    if (!existing) throw new Error("NOT_FOUND");

    if (isDefault) {
      await tx.template.updateMany({
        where: { userId, isDefault: true, NOT: { id: templateId } },
        data: { isDefault: false },
      });
    }

    if (blocks) {
      await tx.templateBlock.deleteMany({ where: { templateId } });
    }

    return tx.template.update({
      where: { id: templateId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
        ...(blocks ? { blocks: { create: blocks } } : {}),
      },
      include: blocksInclude,
    });
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "NOT_FOUND") return null;
    throw err;
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

/** DELETE /api/templates  Body: { templateId } */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { templateId } = (await req.json()) as { templateId: string };

  await prisma.template.deleteMany({ where: { id: templateId, userId } });

  return NextResponse.json({ ok: true });
}
