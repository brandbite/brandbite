// -----------------------------------------------------------------------------
// @file: app/layout.tsx
// @purpose: Root layout with global demo persona banner and toast provider
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import "./globals.css";

import { Josefin_Sans } from "next/font/google";
import DemoPersonaBanner from "../components/demo-persona-banner";
import { ToastProvider } from "@/components/ui/toast-provider";

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brandbite",
  description: "Design Subscription Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${josefin.className} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
        <ToastProvider>
          <DemoPersonaBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
