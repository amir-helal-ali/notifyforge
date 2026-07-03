import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "نوتيفاي فورج — منصة البنية التحتية للإشعارات",
  description:
    "منصة إشعارات بمستوى الإنتاج. إرسال معزول حسب القناة عبر Push للهواتف (FCM/APNs/Huawei)، Web Push، البريد الإلكتروني، SMS، الإشعارات داخل التطبيق، Webhooks، وسطح المكتب.",
  keywords: [
    "NotifyForge",
    "نوتيفاي فورج",
    "البنية التحتية للإشعارات",
    "إشعارات الدفع",
    "FCM",
    "APNs",
    "Huawei HMS",
    "البريد الإلكتروني",
    "SMS",
    "webhooks",
  ],
  authors: [{ name: "NotifyForge" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased bg-background text-foreground font-arabic`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
