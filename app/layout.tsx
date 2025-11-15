// -----------------------------------------------------------------------------
// @file: app/layout.tsx
// @purpose: Root layout with global demo persona banner
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import "./globals.css";

import { Josefin_Sans } from "next/font/google";
import DemoPersonaBanner from "../components/demo-persona-banner";

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
        <DemoPersonaBanner />
        {children}
      </body>
    </html>
  );
}
