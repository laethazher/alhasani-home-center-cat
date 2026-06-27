import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCourses } from "@/lib/data/academyRepo";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const courses = await listCourses(user, {
    q: searchParams.get("q") ?? undefined,
    level: searchParams.get("level") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
    mine: searchParams.get("mine") === "1",
  });
  return NextResponse.json({ count: courses.length, courses });
}
