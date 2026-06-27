import type { Metadata } from "next";
import { Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { APP_NAME, ORG_NAME } from "@/lib/constants";

// خطوط مُستضافة ذاتياً عبر next/font (تحميل مسبق، بلا طلبات خارجية حاجبة للعرض،
// وبلا انزياح تخطيطي) — أسرع بوضوح من @import في CSS.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${ORG_NAME}`, template: `%s — ${APP_NAME}` },
  description: "بوابة موحّدة للمعرفة والامتثال والتعلّم في مجموعة الحسني.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${cairo.variable} ${plex.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
