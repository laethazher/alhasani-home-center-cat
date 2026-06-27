import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";

const schema = z.object({
  documentId: z.string(),
  action: z.enum(["VIEWED", "READ", "ACKNOWLEDGED"]),
});

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { documentId, action } = parsed.data;

  const now = new Date();
  if (!env.demoMode) {
    // Production: upsert the acknowledgement + write an audit record.
    const { prisma } = await import("@/lib/prisma");
    await prisma.acknowledgement.upsert({
      where: { documentId_userId: { documentId, userId: user.id } },
      create: {
        documentId,
        userId: user.id,
        status: action,
        viewedAt: now,
        readAt: action === "READ" || action === "ACKNOWLEDGED" ? now : null,
        acknowledgedAt: action === "ACKNOWLEDGED" ? now : null,
      },
      update: {
        status: action,
        ...(action === "READ" ? { readAt: now } : {}),
        ...(action === "ACKNOWLEDGED" ? { readAt: now, acknowledgedAt: now } : {}),
      },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: `ACK_${action}`, entityType: "Document", entityId: documentId },
    });
  }

  return NextResponse.json({ ok: true, status: action, at: now.toISOString() });
}
