import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDocument } from "@/lib/data/repository";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const doc = await getDocument(user, params.id);
  if (!doc) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });
  return NextResponse.json({ document: doc });
}
