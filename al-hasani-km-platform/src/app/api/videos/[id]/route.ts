import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVideo } from "@/lib/data/videoRepo";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const video = await getVideo(user, params.id);
  if (!video) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ video });
}
