import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** بعد signIn من المتصفح — مزامنة المستخدم في km.User */
export async function POST() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }
  try {
    const { ensureKmUser } = await import("@/lib/kmUser");
    await ensureKmUser(user);
  } catch (e) {
    console.warn("[auth/sync] ensureKmUser:", e);
  }
  return NextResponse.json({ user });
}
