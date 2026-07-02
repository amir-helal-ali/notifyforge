import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "NotifyForge — Notification Infrastructure Platform",
  description:
    "Production-grade notification infrastructure. Channel-isolated delivery for Mobile Push (FCM/APNs/Huawei), Web Push, Email, SMS, In-App, Webhooks, and Desktop.",
  keywords: [
    "NotifyForge",
    "notification infrastructure",
    "push notifications",
    "FCM",
    "APNs",
    "Huawei HMS",
    "email",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
