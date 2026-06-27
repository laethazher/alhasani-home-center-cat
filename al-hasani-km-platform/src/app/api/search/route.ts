import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchDocuments } from "@/lib/search/searchService";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const semantic = searchParams.get("semantic") === "1";
  const type = searchParams.get("type") ?? undefined;
  const departmentId =
    user.role === "ADMIN" ? searchParams.get("departmentId") ?? undefined : user.departmentId ?? undefined;

  const results = await searchDocuments(q, { semantic, type: type ?? undefined, departmentId, limit: 25 });
  return NextResponse.json({ query: q, semantic, count: results.length, results });
}
