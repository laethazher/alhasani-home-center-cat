import { getSession } from "@/lib/auth";
import { PlatformShell } from "@/components/layout/platform-shell";

// منصّة التعلّم عامّة — متاحة للزوّار وأصحاب حسابات المنصّة على حدٍّ سواء.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  return <PlatformShell user={user}>{children}</PlatformShell>;
}
