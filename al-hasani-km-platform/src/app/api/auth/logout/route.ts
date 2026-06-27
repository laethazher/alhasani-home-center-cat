import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  if (env.authProvider === "supabase") {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
