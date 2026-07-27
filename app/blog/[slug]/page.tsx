// -----------------------------------------------------------------------------
// @file: app/blog/[slug]/page.tsx
// @purpose: Blog post detail — 2026 redesign (Figma nodes 56:341 desktop /
//           56:569 mobile). Server component with per-post generateMetadata
//           (uses the CMS metaTitle/metaDescription fields, previously
//           unused). Body is CMS rich HTML rendered through SafeHtml.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { SubscribeBand } from "@/components/marketing/subscribe-band";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "@/components/ui/safe-html";
import { formatPostDate, readMinutes } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const displayFont = "font-[family-name:var(--font-inter)]";

async function getPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      authorName: true,
      category: true,
      heroUrl: true,
      body: true,
      metaTitle: true,
      metaDescription: true,
      publishedAt: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
  };
}

/** Split the title so the last two words render orange, per the design. */
function splitTitle(title: string): { dark: string; accent: string } {
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { dark: "", accent: words.join(" ") };
  return {
    dark: words.slice(0, -2).join(" "),
    accent: words.slice(-2).join(" "),
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { dark, accent } = splitTitle(post.title);
  const date = formatPostDate(post.publishedAt);
  const minutes = readMinutes(post.body);

  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader active="Blog" />

        {/* Hero */}
        <section className="relative mx-auto min-h-[600px] w-[993px] pb-10 max-[1023px]:w-full max-[1023px]:px-6 max-[767px]:px-5">
          <div className="absolute top-[54px] left-[-9.5px] h-[143px] w-[203px] max-[1023px]:static max-[1023px]:mt-5">
            <Image
              src="/home/blog-doodle-head.png"
              alt=""
              width={203}
              height={143}
              className="h-[143px] w-[203px]"
            />
          </div>
          {/* BB reading BB Notes */}
          <div className="absolute top-[67px] right-[-125px] h-[610px] w-[685px] max-[1023px]:hidden">
            <Image
              src="/home/blog-bb.webp"
              alt=""
              width={685}
              height={640}
              className="h-full w-full object-cover object-top"
            />
          </div>
          <div className="relative flex w-[420px] flex-col gap-5 pt-[203px] max-[1023px]:w-full max-[1023px]:max-w-[640px] max-[1023px]:pt-8">
            <p className="text-sm">
              <Link
                href="/blog"
                className="font-medium text-[#5E616E] transition-colors hover:text-[#FF6426]"
              >
                ← All posts
              </Link>
            </p>
            <h1
              className={`${displayFont} text-[64px] leading-[64px] font-extrabold max-[767px]:text-[44px] max-[767px]:leading-[48px]`}
            >
              {dark && <span className="text-[#2B2D33]">{dark} </span>}
              <span className="text-[#FF6426]">{accent}</span>
            </h1>
            {post.excerpt && <p className="text-base leading-6 text-[#2B2D33]">{post.excerpt}</p>}
            <div className="flex w-full flex-row items-center gap-5">
              <Image
                src="/home/blog-author-default.webp"
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-full object-cover"
              />
              <div className="flex min-w-px flex-1 flex-col gap-2.5">
                {post.authorName && (
                  <p className="text-sm leading-6 font-bold text-[#2B2D33]">{post.authorName}</p>
                )}
                <div className="flex flex-row items-center gap-5 text-sm leading-6 text-[#2B2D33]">
                  {date && (
                    <span className="flex flex-row items-center gap-2.5">
                      <Image src="/home/ico-date-dark.svg" alt="" width={24} height={24} />
                      {date}
                    </span>
                  )}
                  <span className="flex flex-row items-center gap-2.5">
                    <Image src="/home/ico-book-dark.svg" alt="" width={24} height={24} />
                    {minutes} min read
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="flex w-full flex-col items-start justify-center bg-white px-[100px] py-10 max-[1023px]:px-8 max-[767px]:px-5">
          {post.heroUrl && (
            <div className="relative mb-10 h-[420px] w-full overflow-hidden rounded-xl max-[767px]:h-[220px]">
              <Image
                src={post.heroUrl}
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 940px"
                className="object-cover"
              />
            </div>
          )}
          <SafeHtml
            as="article"
            html={post.body ?? ""}
            allowedTags={CMS_ALLOWED_TAGS}
            allowedAttrs={CMS_ALLOWED_ATTR}
            className="prose prose-lg prose-headings:font-[family-name:var(--font-inter)] prose-headings:font-extrabold prose-headings:text-[#2B2D33] prose-a:text-[#FF6426] max-w-none text-base leading-6 text-[#2B2D33]"
          />
        </section>

        <SubscribeBand />
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
