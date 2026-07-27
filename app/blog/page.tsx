// -----------------------------------------------------------------------------
// @file: app/blog/page.tsx
// @purpose: Blog index — 2026 redesign ("Fresh thoughts. No stale takes.",
//           Figma nodes 51:1950 desktop / 56:142 mobile). Server component:
//           posts come from the BlogPost table (edited at /admin/blog);
//           BlogList handles the client-side tag filter + reveal.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { BlogList, type BlogCard } from "@/components/marketing/blog-list";
import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { SubscribeBand } from "@/components/marketing/subscribe-band";
import { formatPostDate, readMinutes } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Ideas, inspiration, and practical tips on branding, design, and creative workflows. Straight from the Brandbite team.",
};

// Render per-request: posts come from the database, which isn't reachable
// during CI's static prerender pass — and admin publishes show up instantly.
export const dynamic = "force-dynamic";

const displayFont = "font-[family-name:var(--font-inter)]";

export default async function BlogIndexPage() {
  const rows = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      category: true,
      thumbnailUrl: true,
      publishedAt: true,
      body: true,
    },
  });

  const posts: BlogCard[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    authorName: row.authorName,
    category: row.category,
    thumbnailUrl: row.thumbnailUrl,
    date: formatPostDate(row.publishedAt),
    readMinutes: readMinutes(row.body),
  }));

  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader active="Blog" />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[620px] max-[1179px]:scale-80 max-[929px]:h-[520px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:px-5 max-[767px]:pt-5">
          <div className="absolute top-[54px] left-[-9.5px] h-[143px] w-[203px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/blog-doodle-head.png"
              alt=""
              width={203}
              height={143}
              className="h-[143px] w-[203px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:w-full max-[767px]:items-center">
            <h1
              className={`flex flex-col gap-1 ${displayFont} text-[64px] leading-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px] max-[767px]:leading-[56px]`}
            >
              <span className="whitespace-nowrap text-[#2B2D33] max-[767px]:whitespace-normal">
                Fresh thoughts.
              </span>
              <span className="whitespace-nowrap text-[#2B2D33] max-[767px]:whitespace-normal">
                <span className="text-[#FF6426]">No stale</span> takes.
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-[#2B2D33] max-[767px]:text-center max-[767px]:whitespace-normal">
              {
                "Ideas, inspiration, and practical tips on branding, design,\nand creative workflows. Straight from the Brandbite team."
              }
            </p>
          </div>
          {/* BB reading BB Notes */}
          <div className="absolute top-[67px] left-[371.5px] h-[610px] w-[685px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:h-auto max-[767px]:w-full max-[767px]:max-w-[426px]">
            <Image
              src="/home/blog-bb.webp"
              alt="BB the unicorn reading BB Notes with a coffee"
              width={685}
              height={640}
              priority
              className="h-full w-full object-cover object-top max-[767px]:h-auto"
            />
          </div>
        </section>

        {/* Posts */}
        <section className="flex w-full flex-col items-center bg-white p-10 max-[767px]:px-5">
          <BlogList posts={posts} />
        </section>

        <SubscribeBand />
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
