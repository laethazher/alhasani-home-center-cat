import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl } from "./config";

/**
 * عميل Supabase خادمي يقرأ/يكتب كوكيز الجلسة.
 * يعمل في مكوّنات الخادم (RSC) ومسارات الـ API. في RSC قد يفشل ضبط الكوكي
 * فنتجاهله بأمان (تُحدَّث الكوكيز عبر middleware).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any));
        } catch {
          /* RSC — تُضبط عبر middleware */
        }
      },
    },
  });
}
