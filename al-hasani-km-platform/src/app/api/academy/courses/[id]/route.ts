import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCourse } from "@/lib/data/academyRepo";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const course = await getCourse(user, params.id);
  if (!course) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ course });
}
