"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <h1 className="text-xl font-semibold">خطأ في التطبيق</h1>
        <p className="max-w-md text-sm text-gray-600">{error.message || "حدث خطأ غير متوقّع."}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm text-white"
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
