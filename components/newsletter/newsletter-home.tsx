// -----------------------------------------------------------------------------
// @file: components/newsletter/newsletter-home.tsx
// @purpose: The newsletter builder's front page: the newsletters a company
//           on a plan keeps in its account (open, copy, keep as a template,
//           delete), the draft a visitor has in their browser, and the
//           gallery of ready-made templates (search, free / plan filter, a
//           full-size preview) that open in the editor. Also the three tilted
//           templates beside the page headline.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_PANEL,
  useToolAccessStatus,
} from "@/components/tools/tool-ui";
import type { NewsletterData } from "@/lib/newsletter/newsletter";
import { newsletterHtml, newsletterInnerHtml } from "@/lib/newsletter/render";
import type { NewsletterSummary } from "@/lib/newsletter/store.server";
import {
  builderImageSrc,
  fromTemplate,
  NEWSLETTER_TEMPLATES,
  templateIsPro,
  type NewsletterTemplate,
} from "@/lib/newsletter/templates";

const EDITOR = "/newsletter-builder/editor";
const DRAFT_KEY = "brandbite:newsletter-draft:v2";
/** The picture is the newsletter at its full width (the 600 pixel column and its margins), drawn smaller. */
const THUMB_WIDTH = 624;
const THUMB_SCALE = 0.4;

/** A small picture of a newsletter, drawn from the same HTML the email gets. */
function Thumb({
  data,
  scale,
  height = 230,
}: {
  data: NewsletterData;
  /** Given for a picture of a fixed width; without it the picture fills its card. */
  scale?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none block overflow-hidden rounded-lg border border-[var(--cs-border)]"
      style={{
        background: data.theme.page,
        height,
        width: scale ? THUMB_WIDTH * scale : undefined,
      }}
    >
      <span
        className="block"
        style={{
          // At its real width, so columns sit side by side as they do in an inbox.
          width: THUMB_WIDTH,
          transform: `scale(${scale ?? THUMB_SCALE})`,
          transformOrigin: "top left",
        }}
        // Built by lib/newsletter/render.ts, which escapes every value.
        dangerouslySetInnerHTML={{
          __html: newsletterInnerHtml(data, {
            placeholders: true,
            preview: true,
            assetBase: "",
            imageSrc: builderImageSrc,
          }),
        }}
      />
    </span>
  );
}

function templateData(template: NewsletterTemplate): NewsletterData {
  let made = 0;
  return fromTemplate(template, () => `t-${template.id}-${(made += 1)}`);
}

const TEMPLATES = NEWSLETTER_TEMPLATES.map((template) => ({
  template,
  pro: templateIsPro(template),
  data: templateData(template),
}));

type TemplateItem = (typeof TEMPLATES)[number];
type TemplateFilter = "all" | "free" | "plan";

const FREE_COUNT = TEMPLATES.filter((item) => !item.pro).length;

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

/** Three templates, tilted, beside the page headline. Decoration only. */
export function NewsletterCollage() {
  const pick = (id: string) => TEMPLATES.find((item) => item.template.id === id)?.data;
  const cards = [
    { data: pick("digest"), height: 180, place: "left-0 top-9 -rotate-[8deg]" },
    { data: pick("offer"), height: 180, place: "right-0 top-9 rotate-[8deg]" },
    { data: pick("welcome"), height: 220, place: "left-1/2 top-0 z-10 -translate-x-1/2" },
  ];
  return (
    <div aria-hidden className="relative h-[250px] w-[400px] max-[1023px]:hidden">
      <span className="absolute inset-x-6 top-4 bottom-0 rounded-[48%] bg-[#FFE4D6]" />
      {cards.map((card, index) =>
        card.data ? (
          <span
            key={index}
            className={`absolute block rounded-xl bg-white p-1.5 shadow-[0_10px_30px_rgba(36,37,40,0.14)] ${card.place}`}
          >
            <Thumb data={card.data} scale={0.25} height={card.height} />
          </span>
        ) : null,
      )}
    </div>
  );
}

const MailIcon = () => (
  <svg
    aria-hidden
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
  </svg>
);

const SearchIcon = () => (
  <svg
    aria-hidden
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4" />
  </svg>
);

const BADGE = "rounded-full px-2 text-xs leading-5 font-semibold";

/** A template at its real size, as a computer or a phone shows it, before it is opened. */
function TemplatePreview({
  item,
  locked,
  onClose,
}: {
  item: TemplateItem;
  locked: boolean;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(36,37,40,0.55)] p-4 max-[639px]:p-0"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.template.name} template preview`}
        className="flex h-full max-h-[860px] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl bg-[var(--cs-surface)] shadow-2xl max-[639px]:max-h-none max-[639px]:rounded-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border)] px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-base leading-6 font-semibold">{item.template.name}</p>
            <p className={`truncate ${TOOL_HINT}`}>{item.template.note}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Preview size"
              className="flex rounded-[10px] border border-[var(--cs-border)] p-1"
            >
              {(
                [
                  { id: "desktop", label: "Desktop" },
                  { id: "phone", label: "Mobile" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={device === option.id}
                  onClick={() => setDevice(option.id)}
                  className={`h-9 rounded-md px-3 text-sm leading-5 font-semibold ${
                    device === option.id
                      ? "bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                      : "text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {locked ? (
              <Link href="/meet" className={studioButtonClasses("secondary")}>
                Choose with plan
              </Link>
            ) : (
              <Link
                href={`${EDITOR}?template=${item.template.id}`}
                className={studioButtonClasses("primary")}
              >
                Use template
              </Link>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className={`flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--cs-border)] hover:border-[var(--cs-text)] ${TOOL_FOCUS}`}
            >
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 justify-center bg-[#e7e4df] p-4 max-[639px]:p-2">
          <iframe
            title={`${item.template.name} preview`}
            // No scripts can run in it; same-origin only so its pictures load.
            sandbox="allow-same-origin"
            srcDoc={newsletterHtml(item.data, {
              imageSrc: builderImageSrc,
              assetBase: "",
              preview: true,
              placeholders: true,
            })}
            className="h-full max-w-full rounded-lg bg-white shadow-lg"
            style={{ width: device === "phone" ? 390 : 760 }}
          />
        </div>
      </div>
    </div>
  );
}

export function NewsletterHome() {
  const router = useRouter();
  const { access, ready } = useToolAccessStatus();
  const pro = access.pro;

  const [saved, setSaved] = useState<NewsletterSummary[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const closePreview = useCallback(() => setPreviewing(null), []);

  const load = async () => {
    try {
      const res = await fetch("/api/newsletters", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as {
        newsletters?: NewsletterSummary[];
        error?: string;
      } | null;
      if (!res.ok || !body?.newsletters) throw new Error(body?.error ?? "");
      setSaved(body.newsletters);
      setFailure(null);
    } catch (error) {
      setFailure(
        (error instanceof Error && error.message) || "Your newsletters couldn't be loaded.",
      );
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (pro) {
      void load();
      return;
    }
    // After the first paint, so the server's HTML and the browser's agree.
    const timer = window.setTimeout(() => {
      try {
        setHasDraft(Boolean(window.localStorage.getItem(DRAFT_KEY)));
      } catch {
        // Storage switched off: there is no draft to offer.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, pro]);

  /** One request about a kept newsletter; the list is read again after it. */
  const run = async (id: string, work: () => Promise<Response>, then?: (body: unknown) => void) => {
    setBusy(id);
    setFailure(null);
    try {
      const res = await work();
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "");
      then?.(body);
      await load();
    } catch (error) {
      setFailure((error instanceof Error && error.message) || "That didn't work. Try again.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  /** A copy of a kept newsletter; `open` goes straight into the editor with it. */
  const duplicate = (item: NewsletterSummary, open: boolean) =>
    run(
      item.id,
      async () => {
        const source = await fetch(`/api/newsletters/${item.id}`, { cache: "no-store" });
        if (!source.ok) return source;
        const { data } = (await source.json()) as { data: NewsletterData };
        const name = open ? item.name : `Copy of ${item.name}`.slice(0, 120);
        return fetch("/api/newsletters", json("POST", { name, data: { ...data, name } }));
      },
      (body) => {
        const id = (body as { newsletter?: { id: string } } | null)?.newsletter?.id;
        if (open && id) router.push(`${EDITOR}?id=${id}`);
      },
    );

  const mine = (saved ?? []).filter((item) => !item.isTemplate);
  const myTemplates = (saved ?? []).filter((item) => item.isTemplate);

  const savedCard = (item: NewsletterSummary) => (
    <li
      key={item.id}
      className="flex flex-col gap-3 rounded-xl border border-[var(--cs-border)] p-4"
    >
      <div className="min-w-0">
        <p className="truncate text-sm leading-5 font-semibold">{item.name}</p>
        <p className={`truncate ${TOOL_HINT}`}>{item.subject || "No subject line yet"}</p>
        <p className={TOOL_HINT}>Changed {dateLabel(item.updatedAt)}</p>
      </div>
      {confirming === item.id ? (
        <div role="alertdialog" aria-label={`Delete ${item.name}?`} className="flex flex-col gap-2">
          <p className="text-sm leading-5">
            Delete it for everyone in your company? This can&apos;t be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === item.id}
              onClick={() =>
                void run(item.id, () => fetch(`/api/newsletters/${item.id}`, { method: "DELETE" }))
              }
              className={studioButtonClasses("danger")}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={studioButtonClasses("secondary")}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.isTemplate ? (
            <button
              type="button"
              disabled={busy === item.id}
              onClick={() => void duplicate(item, true)}
              className={studioButtonClasses("primary")}
            >
              Use
            </button>
          ) : null}
          <Link
            href={`${EDITOR}?id=${item.id}`}
            className={studioButtonClasses(item.isTemplate ? "secondary" : "primary")}
          >
            {item.isTemplate ? "Edit" : "Open"}
          </Link>
          {!item.isTemplate ? (
            <button
              type="button"
              disabled={busy === item.id}
              onClick={() => void duplicate(item, false)}
              className={studioButtonClasses("secondary")}
            >
              Duplicate
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy === item.id}
            onClick={() =>
              void run(item.id, () =>
                fetch(
                  `/api/newsletters/${item.id}`,
                  json("PATCH", { isTemplate: !item.isTemplate }),
                ),
              )
            }
            className={studioButtonClasses("secondary")}
          >
            {item.isTemplate ? "Not a template" : "Keep as template"}
          </button>
          <button
            type="button"
            disabled={busy === item.id}
            onClick={() => setConfirming(item.id)}
            className={studioButtonClasses("tertiary")}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );

  const words = query.trim().toLowerCase();
  const shown = TEMPLATES.filter((item) => {
    // The free / plan split only means something to a visitor without a plan.
    if (!pro && filter === "free" && item.pro) return false;
    if (!pro && filter === "plan" && !item.pro) return false;
    if (!words) return true;
    return `${item.template.name} ${item.template.note}`.toLowerCase().includes(words);
  });
  const previewed = previewing
    ? TEMPLATES.find((item) => item.template.id === previewing)
    : undefined;

  /** The "Your newsletters" band: what is kept, and the way to start a new one. */
  const strip = (text: ReactNode, actions: ReactNode) => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-6 py-5 max-[767px]:px-5">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E3F1E4] text-[#1F6B3A]">
          <MailIcon />
        </span>
        <h2 className="text-xl leading-7 font-semibold whitespace-nowrap">Your newsletters</h2>
      </div>
      <div className="min-w-[220px] flex-1 border-l border-[var(--cs-border)] pl-6 text-sm leading-5 max-[767px]:min-w-full max-[767px]:border-l-0 max-[767px]:pl-0">
        {text}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const scratch = (variant: "primary" | "secondary") => (
    <Link href={`${EDITOR}?template=blank`} className={studioButtonClasses(variant)}>
      Start from scratch
    </Link>
  );

  return (
    <section aria-label="Newsletter builder" className="flex flex-col gap-6">
      {pro ? (
        <>
          {strip(
            saved === null && !failure ? (
              <p className="text-[var(--cs-muted)]">Loading…</p>
            ) : mine.length || myTemplates.length ? (
              <>
                <p className="font-semibold">
                  {mine.length} {mine.length === 1 ? "newsletter" : "newsletters"}
                  {myTemplates.length
                    ? ` and ${myTemplates.length} of your own ${myTemplates.length === 1 ? "template" : "templates"}`
                    : ""}
                </p>
                <p className="text-[var(--cs-muted)]">
                  Kept in your account and shared with your company.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">No newsletters yet.</p>
                <p className="text-[var(--cs-muted)]">
                  Pick a template below. Your work is kept in your account and shared with your
                  company.
                </p>
              </>
            ),
            scratch("primary"),
          )}
          <p role="alert" className={`${TOOL_ERROR} empty:hidden`}>
            {failure ?? ""}
          </p>
          {mine.length || myTemplates.length ? (
            <div className={TOOL_PANEL}>
              {mine.length ? (
                <ul className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
                  {mine.map(savedCard)}
                </ul>
              ) : null}
              {myTemplates.length ? (
                <>
                  <h3 className={`text-base leading-6 font-semibold ${mine.length ? "mt-6" : ""}`}>
                    Your templates
                  </h3>
                  <ul className="mt-3 grid grid-cols-3 gap-3 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
                    {myTemplates.map(savedCard)}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : hasDraft ? (
        strip(
          <>
            <p className="font-semibold">One draft, kept in this browser.</p>
            <p className="text-[var(--cs-muted)]">
              With a plan, newsletters are kept in your account and shared with your company.
            </p>
          </>,
          <>
            <Link href={EDITOR} className={studioButtonClasses("primary")}>
              Continue your draft
            </Link>
            {scratch("secondary")}
          </>,
        )
      ) : (
        strip(
          <>
            <p className="font-semibold">No newsletters yet.</p>
            <p className="text-[var(--cs-muted)]">
              Your draft is kept in this browser. With a plan, newsletters are shared with your
              company.
            </p>
          </>,
          scratch("primary"),
        )
      )}

      <div>
        <h2 className="text-[28px] leading-9 font-bold">Start from a template</h2>
        <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
          Choose a ready-made design, then make it your own with your words, images and brand style.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Search templates</span>
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--cs-muted)]">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
              className={`${TOOL_INPUT} pl-10`}
            />
          </label>
          {!pro ? (
            <div role="group" aria-label="Show templates" className="flex flex-wrap gap-2">
              {(
                [
                  { id: "all", label: "All", count: TEMPLATES.length },
                  { id: "free", label: "Free", count: FREE_COUNT },
                  {
                    id: "plan",
                    label: "Included with plan",
                    count: TEMPLATES.length - FREE_COUNT,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`flex h-11 items-center gap-2 rounded-[10px] border px-4 text-sm leading-5 font-semibold transition-colors ${TOOL_FOCUS} ${
                    filter === option.id
                      ? "border-transparent bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-md px-1.5 text-xs leading-5 ${
                      filter === option.id ? "bg-white/70" : "bg-[var(--cs-background)]"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ul className="mt-5 grid grid-cols-3 gap-5 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
          {shown.map(({ template, pro: needsPlan, data }) => {
            const locked = needsPlan && !pro;
            return (
              <li
                key={template.id}
                className="flex flex-col rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4"
              >
                <Thumb data={data} />
                <p className="mt-4 flex items-center gap-2">
                  <span className="text-base leading-6 font-semibold">{template.name}</span>
                  {pro ? null : needsPlan ? (
                    <span className={`${BADGE} bg-[var(--cs-soft)] text-[var(--cs-soft-text)]`}>
                      Plan
                    </span>
                  ) : (
                    <span className={`${BADGE} bg-[#E3F1E4] text-[#1F6B3A]`}>Free</span>
                  )}
                </p>
                <p className={`mt-0.5 ${TOOL_HINT}`}>{template.note}.</p>
                <div className="mt-4 flex flex-1 items-end justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewing(template.id)}
                    aria-label={`Preview ${template.name}`}
                    className={`flex h-11 items-center rounded-md text-sm leading-5 font-semibold text-[var(--cs-brand-strong)] underline underline-offset-4 hover:no-underline ${TOOL_FOCUS}`}
                  >
                    Preview
                  </button>
                  {locked ? (
                    <Link
                      href="/meet"
                      aria-label={`${template.name}: choose with a brandbite plan`}
                      className={studioButtonClasses("secondary")}
                    >
                      Choose with plan
                    </Link>
                  ) : (
                    <Link
                      href={`${EDITOR}?template=${template.id}`}
                      aria-label={`Use the ${template.name} template`}
                      className={studioButtonClasses("primary")}
                    >
                      Use template
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p aria-live="polite" className={`mt-4 ${TOOL_HINT}`}>
          {shown.length === 0
            ? "No template matches. Try another word, or start from scratch."
            : shown.length === TEMPLATES.length
              ? `All ${TEMPLATES.length} templates`
              : `Showing ${shown.length} of ${TEMPLATES.length} templates`}
        </p>
      </div>

      {previewed ? (
        <TemplatePreview item={previewed} locked={previewed.pro && !pro} onClose={closePreview} />
      ) : null}
    </section>
  );
}
