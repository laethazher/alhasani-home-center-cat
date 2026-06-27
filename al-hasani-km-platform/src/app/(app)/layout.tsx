import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  // فصل صارم: حساب المتعلّم لا يدخل النظام الإداري إطلاقاً.
  if (user.role === "LEARNER") redirect("/academy");
  return <AppShell user={user}>{children}</AppShell>;
}
