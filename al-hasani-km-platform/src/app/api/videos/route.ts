import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listVideos } from "@/lib/data/videoRepo";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const videos = await listVideos(user, {
    q: searchParams.get("q") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
  });
  return NextResponse.json({ count: videos.length, videos });
}
