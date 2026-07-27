// -----------------------------------------------------------------------------
// @file: components/marketing/blog-list.tsx
// @purpose: Blog index content from the Figma "blog - main" frames: category
//           tag pills, dark featured card (latest post), post card grid,
//           and a "Read More" reveal. Receives posts from the server page
//           (content stays CMS-driven via /admin/blog).
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const displayFont = "font-[family-name:var(--font-inter)]";
const PAGE_SIZE = 6;

export type BlogCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  date: string; // preformatted "Jul 12, 2026"
  readMinutes: number;
};

function MetaRow({ card, light }: { card: BlogCard; light?: boolean }) {
  const color = light ? "text-[#F7F4F1]" : "text-[#2B2D33]";
  const suffix = light ? "light" : "dark";
  return (
    <div className={`flex flex-row items-center gap-5 text-sm leading-6 ${color}`}>
      <span className="flex flex-row items-center gap-2.5">
        <Image src={`/home/ico-date-${suffix}.svg`} alt="" width={24} height={24} />
        {card.date}
      </span>
      <span className="flex flex-row items-center gap-2.5">
        <Image src={`/home/ico-book-${suffix}.svg`} alt="" width={24} height={24} />
        {card.readMinutes} min read
      </span>
    </div>
  );
}

export function BlogList({ posts }: { posts: BlogCard[] }) {
  const [activeTag, setActiveTag] = useState("ALL POSTS");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const post of posts) {
      if (post.category) set.add(post.category.toUpperCase());
    }
    return ["ALL POSTS", ...Array.from(set)];
  }, [posts]);

  const filtered = useMemo(
    () =>
      activeTag === "ALL POSTS"
        ? posts
        : posts.filter((post) => post.category?.toUpperCase() === activeTag),
    [posts, activeTag],
  );

  const featured = filtered[0];
  const rest = filtered.slice(1, 1 + visible);
  const hasMore = filtered.length > 1 + visible;

  if (posts.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-5 py-16 text-center">
        <p className={`${displayFont} text-4xl leading-9 font-extrabold text-[#2B2D33]`}>
          No posts yet. <span className="text-[#FF6426]">Fresh thoughts coming soon.</span>
        </p>
        <Image
          src="/home/blog-doodle.png"
          alt="More good stuff coming your way."
          width={387}
          height={60}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-[60px] max-[767px]:gap-10">
      {/* Category tags */}
      {tags.length > 1 && (
        <div className="flex w-full flex-row flex-wrap items-center justify-between gap-3 max-[1023px]:justify-center">
          {tags.map((tag) => {
            const isActive = tag === activeTag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setActiveTag(tag);
                  setVisible(PAGE_SIZE);
                }}
                aria-pressed={isActive}
                className={`cursor-pointer rounded-[20px] px-3 py-2 text-xs leading-6 font-bold tracking-[4px] transition-colors ${
                  isActive
                    ? "border border-[#12131A] bg-[#12131A] text-white"
                    : "border border-[#E0D2FF] bg-transparent text-[#5E616E] hover:border-[#8D5BFF] hover:text-[#2B2D33]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Featured post */}
      {featured && (
        <div className="flex w-full flex-row items-stretch max-[767px]:flex-col-reverse">
          <div className="flex min-w-px flex-1 flex-row items-center rounded-l-xl bg-[#12131A] px-[60px] py-10 max-[1023px]:px-8 max-[767px]:rounded-t-none max-[767px]:rounded-b-xl max-[767px]:px-5">
            <div className="flex min-w-px flex-1 flex-col items-start justify-center gap-2.5">
              <p className="w-full text-xs leading-6 font-bold tracking-[4px] text-[#8D5BFF]">
                FEATURED
              </p>
              <h2
                className={`w-full ${displayFont} text-4xl leading-9 font-extrabold text-[#FF6426]`}
              >
                {featured.title}
              </h2>
              {featured.excerpt && (
                <p className="w-full text-sm leading-6 text-[#F7F4F1]">{featured.excerpt}</p>
              )}
              <Link
                href={`/blog/${featured.slug}`}
                className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
              >
                <span className="text-xl leading-8 font-bold whitespace-nowrap text-white">
                  Read More
                </span>
                <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
              </Link>
              <div className="flex w-full flex-row items-center gap-5 pt-2">
                <Image
                  src="/home/blog-author-default.webp"
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-full object-cover"
                />
                <div className="flex min-w-px flex-1 flex-col gap-2.5">
                  {featured.authorName && (
                    <p className="text-sm leading-6 font-bold text-[#F7F4F1]">
                      {featured.authorName}
                    </p>
                  )}
                  <MetaRow card={featured} light />
                </div>
              </div>
            </div>
          </div>
          <div className="relative min-w-px flex-1 overflow-hidden rounded-r-xl bg-[#F7F4F1] max-[767px]:h-[250px] max-[767px]:rounded-t-xl max-[767px]:rounded-b-none">
            <Image
              src={featured.thumbnailUrl ?? "/home/blog-placeholder.webp"}
              alt=""
              fill
              sizes="(max-width: 767px) 100vw, 530px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Post cards */}
      {rest.length > 0 && (
        <div className="grid w-full grid-cols-3 gap-5 max-[1023px]:grid-cols-2 max-[767px]:grid-cols-1">
          {rest.map((card) => (
            <div
              key={card.id}
              className="flex flex-col items-end justify-between gap-5 rounded-xl bg-[#F7F4F1] p-2.5"
            >
              <div className="flex w-full flex-col items-start justify-center gap-2.5">
                <Link
                  href={`/blog/${card.slug}`}
                  className="relative block h-[240px] w-full overflow-hidden rounded-xl"
                >
                  <Image
                    src={card.thumbnailUrl ?? "/home/blog-placeholder.webp"}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 100vw, 340px"
                    className="object-cover"
                  />
                </Link>
                {card.category && (
                  <p className="w-full text-xs leading-6 font-bold tracking-[4px] text-[#FF6426] uppercase">
                    {card.category}
                  </p>
                )}
                <h3
                  className={`w-full ${displayFont} text-base leading-5 font-bold text-[#2B2D33]`}
                >
                  <Link href={`/blog/${card.slug}`} className="hover:text-[#FF6426]">
                    {card.title}
                  </Link>
                </h3>
                {card.excerpt && (
                  <p className="w-full text-base leading-6 text-[#2B2D33]">{card.excerpt}</p>
                )}
                <MetaRow card={card} />
              </div>
              <Link
                href={`/blog/${card.slug}`}
                className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-75"
              >
                <span className="text-base leading-8 font-bold whitespace-nowrap text-[#2B2D33]">
                  Read More
                </span>
                <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="relative flex w-full items-center justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="font-brand cursor-pointer rounded-[10px] border-none bg-[#2B2D33] p-5 text-xl leading-none font-bold text-white transition-colors hover:bg-[#FF6426]"
          >
            Read More
          </button>
          <Image
            src="/home/blog-doodle.png"
            alt="More good stuff coming your way."
            width={387}
            height={60}
            className="absolute right-0 max-[1023px]:hidden"
          />
        </div>
      )}
    </div>
  );
}
