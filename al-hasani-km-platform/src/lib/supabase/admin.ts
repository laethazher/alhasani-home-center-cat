import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * عميل Supabase بصلاحية الخدمة (service role) — خادمي فقط.
 * يُستخدم في السكربتات والعمليات المميّزة (تجاوز RLS): مزامنة المحتوى،
 * إدراج ملفات المستخدمين، وروابط الرفع الموقّعة للتخزين.
 */
export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
