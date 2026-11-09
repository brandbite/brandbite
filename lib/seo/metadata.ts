// -----------------------------------------------------------------------------
// @file: lib/seo/metadata.ts
// @purpose: One helper for public page metadata, so the search title, the
//           canonical URL and the social share card always agree.
//
//           Next.js replaces `openGraph` and `twitter` as whole objects per
//           segment and never derives them from `title`, so a page that only
//           set `title` used to share as plain "brandbite".
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

const SITE_NAME = "brandbite";

// app/opengraph-image.tsx. Named here because a page's own `openGraph` object
// drops the image inherited from the root, and it also hides an
// opengraph-image file in the page's own folder: pages with one pass `image`.
const DEFAULT_SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "brandbite: creative that hits different",
};

type PageMetadataInput = {
  /** Page title; the layout template adds " | brandbite" in search results. */
  title: string;
  description: string;
  /** Site path of the canonical URL, e.g. "/colors/contrast-checker". */
  path: string;
  /** Use the title as written, without the " | brandbite" suffix. */
  absoluteTitle?: boolean;
  /** Keep the page out of search results but let crawlers follow its links. */
  noindex?: boolean;
  type?: "website" | "article";
  /** Share image path, e.g. the page's own `${path}/opengraph-image`. */
  image?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
  type = "website",
  image,
}: PageMetadataInput): Metadata {
  const shareImage = image
    ? { ...DEFAULT_SHARE_IMAGE, url: image, alt: title }
    : DEFAULT_SHARE_IMAGE;
  const shareTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type,
      locale: "en_US",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [shareImage.url],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
