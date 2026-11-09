// -----------------------------------------------------------------------------
// @file: app/sizes/page.tsx
// @purpose: Size guide hub: the most used sizes across platforms, and a card
//           per platform linking to its full page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/colors/studio/icons";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { FormatPreview } from "@/components/sizes/format-card";
import {
  formatCheckedOn,
  SIZE_GUIDE_CTA,
  SIZE_GUIDE_LABEL,
  SizeNav,
  SizeTable,
} from "@/components/sizes/size-guide-parts";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { popularFormats, SIZE_PLATFORMS } from "@/lib/sizes";
import type { SizePlatform } from "@/lib/sizes/types";

export const metadata: Metadata = pageMetadata({
  title: "Social Media Image Sizes 2026: Every Platform",
  description:
    "Every image and video size for Instagram, Facebook, LinkedIn, TikTok, YouTube, X, Pinterest, Threads and display ads, with safe zones and free templates.",
  path: "/sizes",
  image: "/sizes/opengraph-image",
});

function PlatformCard({ platform }: { platform: SizePlatform }) {
  const preview = platform.formats.find((format) => format.popular) ?? platform.formats[0];
  return (
    <li>
      <Link
        href={`/sizes/${platform.slug}`}
        className="group flex h-full flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 hover:border-[var(--cs-text)]"
      >
        <FormatPreview format={preview} />
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg leading-7 font-semibold">{platform.name}</h3>
          <span className="text-[var(--cs-brand-strong)]">
            <ArrowRightIcon />
          </span>
        </div>
        <p className="text-sm leading-5 text-[var(--cs-muted)]">
          {platform.formats.length} formats
        </p>
      </Link>
    </li>
  );
}

export default function SizesHubPage() {
  const social = SIZE_PLATFORMS.filter((platform) => platform.group === "social");
  const ads = SIZE_PLATFORMS.filter((platform) => platform.group === "ads");
  const checkedOn = SIZE_PLATFORMS.map((platform) => platform.checkedOn).sort()[0];

  return (
    <StudioShell
      label={SIZE_GUIDE_LABEL}
      nav={<SizeNav />}
      title="Social media image"
      accent="sizes."
      blurb="Every size for every platform, with safe zones and free blank templates."
      {...SIZE_GUIDE_CTA}
    >
      <JsonLd data={breadcrumbJsonLd([{ name: "Size guide", path: "/sizes" }])} />

      <SizeTable caption="The most used sizes" rows={popularFormats()} showPlatform />

      <section aria-labelledby="social-heading" className="flex flex-col gap-4">
        <h2 id="social-heading" className="text-2xl leading-8 font-semibold">
          Social media
        </h2>
        <ul className="grid grid-cols-4 gap-6 max-[1023px]:grid-cols-2 max-[479px]:grid-cols-1">
          {social.map((platform) => (
            <PlatformCard key={platform.slug} platform={platform} />
          ))}
        </ul>
      </section>

      {ads.length > 0 ? (
        <section aria-labelledby="ads-heading" className="flex flex-col gap-4">
          <h2 id="ads-heading" className="text-2xl leading-8 font-semibold">
            Ads
          </h2>
          <ul className="grid grid-cols-4 gap-6 max-[1023px]:grid-cols-2 max-[479px]:grid-cols-1">
            {ads.map((platform) => (
              <PlatformCard key={platform.slug} platform={platform} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm leading-5 text-[var(--cs-muted)]">
        Checked against each platform&apos;s official specs in {formatCheckedOn(checkedOn)}.
      </p>
    </StudioShell>
  );
}
