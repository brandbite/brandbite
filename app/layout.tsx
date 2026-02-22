// -----------------------------------------------------------------------------
// @file: app/layout.tsx
// @purpose: Root layout with global demo persona banner and toast provider
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import "./globals.css";

import { Josefin_Sans, Inter } from "next/font/google";
import DemoPersonaBanner from "../components/demo-persona-banner";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ThemeProvider } from "@/components/theme-provider";

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-josefin",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Brandbite",
  description: "Creative Subscription Portal",
};

// Inline script to prevent FOUC — reads localStorage before paint
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem("bb-theme");
    var dark = t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${josefin.variable} min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)] antialiased`}
      >
        <ThemeProvider>
          <ToastProvider>
            {isDemoMode && <DemoPersonaBanner />}
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
