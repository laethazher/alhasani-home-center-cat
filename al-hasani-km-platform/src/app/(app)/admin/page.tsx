import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { AdminTabs, type AdminUserRow } from "@/components/shared/admin-tabs";
import { DEMO_USERS } from "@/lib/data/users";

export const metadata = { title: "إدارة النظام" };

export default async function AdminPage() {
  const user = (await getSession())!;
  if (!can(user, "user:manage")) redirect("/dashboard");

  // Safe projection — never expose credentials to the client.
  const users: AdminUserRow[] = DEMO_USERS.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    employeeNo: u.employeeNo,
    role: u.role,
    title: u.title,
    departmentName: u.departmentName,
    avatarColor: u.avatarColor,
  }));

  return (
    <>
      <PageHeader
        eyebrow="لوحة التحكّم"
        title="إدارة النظام"
        description="إدارة حسابات الموظفين وأدوارهم، ورفع الوثائق الجديدة إلى قاعدة المعرفة."
      />
      <AdminTabs users={users} />
    </>
  );
}
