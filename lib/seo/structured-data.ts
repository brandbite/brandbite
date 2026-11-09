// -----------------------------------------------------------------------------
// @file: lib/seo/structured-data.ts
// @purpose: schema.org JSON-LD builders for public pages. Search engines read
//           these to understand who runs the site (Organization), what the
//           site is (WebSite), which pages are free tools (WebApplication),
//           where a page sits (BreadcrumbList) and blog posts (BlogPosting).
//
//           FAQPage is left out on purpose: Google only shows FAQ rich results
//           for government and health sites since 2023, so it would add
//           nothing for us.
// -----------------------------------------------------------------------------

import {
  COMPANY_ADDRESS_LINES,
  COMPANY_BRAND_NAME,
  COMPANY_LEGAL_NAME,
  CONTACT_EMAIL,
} from "@/lib/brand";

/** Public site origin without a trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/** Turns a site path ("/colors") into an absolute URL. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

type JsonLdObject = Record<string, unknown>;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: COMPANY_BRAND_NAME,
    legalName: COMPANY_LEGAL_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.png"),
    email: CONTACT_EMAIL,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY_ADDRESS_LINES[0],
      addressLocality: "Sharjah",
      addressCountry: "AE",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      availableLanguage: ["English"],
    },
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: COMPANY_BRAND_NAME,
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** A free, browser-based tool such as the contrast checker. */
export function webApplicationJsonLd(tool: {
  name: string;
  path: string;
  description: string;
  category?: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: absoluteUrl(tool.path),
    description: tool.description,
    applicationCategory: tool.category ?? "DesignApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Breadcrumb trail; the last item is the current page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  path: string;
  description?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url: absoluteUrl(post.path),
    mainEntityOfPage: absoluteUrl(post.path),
    ...(post.description ? { description: post.description } : {}),
    ...(post.imageUrl ? { image: [absoluteUrl(post.imageUrl)] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    ...(post.updatedAt ? { dateModified: post.updatedAt.toISOString() } : {}),
    author: post.authorName
      ? { "@type": "Person", name: post.authorName }
      : { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * Serialises JSON-LD for a <script> tag. "<" is escaped so text from the CMS
 * can never close the script element early.
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
