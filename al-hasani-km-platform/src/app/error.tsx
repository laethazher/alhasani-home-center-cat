"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">حدث خطأ</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "تعذّر تحميل الصفحة."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
