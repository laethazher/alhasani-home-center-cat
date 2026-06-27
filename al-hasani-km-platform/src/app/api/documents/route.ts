import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDocuments } from "@/lib/data/repository";
import type { DocumentType, DocumentStatus } from "@/lib/types";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const docs = await listDocuments(user, {
    q: searchParams.get("q") ?? undefined,
    type: (searchParams.get("type") as DocumentType) ?? undefined,
    status: (searchParams.get("status") as DocumentStatus) ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
  });
  return NextResponse.json({ count: docs.length, documents: docs });
}
