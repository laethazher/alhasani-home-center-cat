import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
      <div>
        <p className="font-display text-6xl font-extrabold text-teal">٤٠٤</p>
        <h1 className="mt-3 font-display text-xl font-bold text-ink">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted">قد تكون الوثيقة قد نُقلت أو أُرشفت.</p>
        <Link href="/dashboard" className="mt-6 inline-block">
          <Button>العودة إلى لوحة المعلومات</Button>
        </Link>
      </div>
    </div>
  );
}
