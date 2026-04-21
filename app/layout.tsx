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
import { AuthGuard } from "@/components/auth-guard";
import { A11yDevMonitor } from "@/components/a11y-dev-monitor";

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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "Brandbite",
    template: "%s | Brandbite",
  },
  description:
    "Creative-as-a-service platform. Submit requests, track progress, and manage your creative pipeline.",
  metadataBase: new URL(appUrl),
  openGraph: {
    title: "Brandbite",
    description:
      "Creative-as-a-service platform. Submit requests, track progress, and manage your creative pipeline.",
    url: appUrl,
    siteName: "Brandbite",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Brandbite",
    description:
      "Creative-as-a-service platform. Submit requests, track progress, and manage your creative pipeline.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Inline script to prevent FOUC — reads localStorage before paint
// Default to light mode when no preference is stored (marketing pages use light backgrounds)
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem("bb-theme");
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Gate demo persona banner on NODE_ENV so it never renders in a
  // production build, even if the public env var leaks through. Intentional
  // demo deploys opt back in with NEXT_PUBLIC_ALLOW_DEMO_IN_PROD=true.
  const demoRequested = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const allowedInProd = process.env.NEXT_PUBLIC_ALLOW_DEMO_IN_PROD === "true";
  const isDemoMode = demoRequested && (process.env.NODE_ENV !== "production" || allowedInProd);

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
            <AuthGuard />
            {/* Dev-only: logs axe-core WCAG violations to the browser
                console as pages render. Dead-code-eliminated in prod. */}
            <A11yDevMonitor />
            {/*
              Skip link — first tabbable element on every page. Hidden
              off-screen until focused, at which point it moves into view.
              Anchors to #main-content which each dashboard layout sets
              on its <main>. Pages without a #main-content target simply
              don't jump anywhere; the link still works as "first focus"
              without breaking the page visually.
            */}
            <a
              href="#main-content"
              className="sr-only fixed top-2 left-2 z-[100] rounded-md bg-[var(--bb-primary)] px-3 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bb-primary)]"
            >
              Skip to main content
            </a>
            {isDemoMode && <DemoPersonaBanner />}
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
