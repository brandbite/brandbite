// -----------------------------------------------------------------------------
// @file: components/seo/json-ld.tsx
// @purpose: Renders schema.org structured data into the first HTML.
// -----------------------------------------------------------------------------

import { serializeJsonLd } from "@/lib/seo/structured-data";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Built by lib/seo/structured-data.ts; serializeJsonLd escapes "<".
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
