import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchVideos } from "@/lib/data/videoRepo";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchVideos(user, q);
  return NextResponse.json({ query: q, count: results.length, results });
}
