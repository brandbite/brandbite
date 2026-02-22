// -----------------------------------------------------------------------------
// @file: app/robots.ts
// @purpose: Robots.txt configuration for search engine crawling
// -----------------------------------------------------------------------------

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/debug/", "/customer/", "/creative/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
