// -----------------------------------------------------------------------------
// @file: components/brand-copy/brand-voice-copy.tsx
// @purpose: Brand-voice copy (customer dashboard): say what you need a
//           caption, headline, slogan, ad, product description or subject
//           line for, and get three options written in the voice your brand
//           guide describes. Included with a plan, a set number of runs a day.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import {
  Button,
  Callout,
  Card,
  CardTitle,
  Field,
  PageHeader,
  SegmentedControl,
  TextArea,
  buttonClass,
} from "@/components/admin/v2/ui";
import {
  BRAND_COPY_OPTIONS,
  BRIEF_MAX,
  BRIEF_MIN,
  COPY_KINDS,
  COPY_LENGTHS,
  KINDS_WITH_LENGTH,
  type CopyKind,
  type CopyLength,
} from "@/lib/brand-copy/copy";
import { keepWork, keptWork } from "@/lib/tools/keep";

type Status = {
  open: boolean;
  ready: boolean;
  dailyLimit: number;
  companyName: string | null;
  hasVoice: boolean;
  voice: { label: string; value: string }[];
};

type Result = { kind: CopyKind; options: string[]; usedVoice: boolean };

type Kept = {
  kind: CopyKind;
  length: CopyLength;
  brief: string;
  result: Result | null;
  remaining: number | null;
};

const KEEP_KEY = "brand-voice-copy";
const POST_PREVIEW_KEY = "post-preview";

export function BrandVoiceCopy() {
  const router = useRouter();
  const ids = useId();
  const [kept] = useState(() => keptWork<Kept>(KEEP_KEY));
  const [status, setStatus] = useState<Status | "loading" | "error">("loading");
  const [kind, setKind] = useState<CopyKind>(kept?.kind ?? "caption");
  const [length, setLength] = useState<CopyLength>(kept?.length ?? "medium");
  const [brief, setBrief] = useState(kept?.brief ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(kept?.result ?? null);
  const [remaining, setRemaining] = useState<number | null>(kept?.remaining ?? null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tools/brand-copy", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : Promise.reject(new Error())))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    keepWork<Kept>(KEEP_KEY, { kind, length, brief, result, remaining });
  }, [kind, length, brief, result, remaining]);

  const chosen = COPY_KINDS.find((k) => k.id === kind) ?? COPY_KINDS[0];
  const briefLength = brief.trim().length;
  const usable = typeof status === "object" && status.open && status.ready;
  const out = remaining === 0;

  const write = async () => {
    if (!usable || busy) return;
    setBusy(true);
    setError(null);
    setCopied(null);
    try {
      const res = await fetch("/api/tools/brand-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, length, brief }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        options?: string[];
        remaining?: number;
        usedVoice?: boolean;
        error?: string;
      };
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (!res.ok || !data.options?.length) {
        setError(data.error ?? "The copy couldn't be written. Try again in a moment.");
        return;
      }
      setResult({ kind, options: data.options, usedVoice: Boolean(data.usedVoice) });
    } catch {
      setError("We couldn't reach the writer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
    } catch {
      setError("Your browser didn't allow the copy. Select the text and copy it.");
    }
  };

  /** Take a caption to Post and ad preview, keeping whatever is already set up there. */
  const previewAsPost = (text: string) => {
    keepWork(POST_PREVIEW_KEY, { ...(keptWork<object>(POST_PREVIEW_KEY) ?? {}), caption: text });
    router.push("/post-preview");
  };

  return (
    <div>
      <PageHeader
        title="Brand-voice copy"
        description="Captions, headlines, slogans and ad copy, written the way your brand guide says your brand talks."
        meta={
          typeof status === "object" && status.open
            ? `Included with your plan · ${status.dailyLimit} writing runs a day for your company${
                remaining === null ? "" : ` · ${remaining} left for now`
              }`
            : undefined
        }
      />

      {status === "error" ? (
        <Callout tone="error" title="This tool couldn't load.">
          Reload the page to try again.
        </Callout>
      ) : typeof status === "object" && !status.open ? (
        <Callout
          tone="info"
          title="Brand-voice copy is included with a brandbite plan."
          action={
            <Link href="/customer/tokens" className={buttonClass("primary")}>
              Open Tokens
            </Link>
          }
        >
          Once your company is on a plan, you can write here in your brand&apos;s voice.
        </Callout>
      ) : typeof status === "object" && !status.ready ? (
        <Callout tone="info" title="Coming soon">
          Brand-voice copy isn&apos;t switched on yet.
        </Callout>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[1100px]:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <div className="flex flex-col gap-5">
                <fieldset>
                  <legend className="mb-1.5 block text-sm font-medium">What do you need?</legend>
                  <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
                    {COPY_KINDS.map((option) => {
                      const selected = option.id === kind;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setKind(option.id)}
                          className={`flex min-h-[68px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--av2-text)] focus-visible:ring-offset-2 focus-visible:outline-none ${
                            selected
                              ? "border-[var(--av2-text)] bg-[var(--av2-bg)]"
                              : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                          }`}
                        >
                          <span className="text-sm font-semibold">{option.label}</span>
                          <span className="text-xs text-[var(--av2-text-2)]">{option.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Field
                  label="What is it for?"
                  htmlFor={`${ids}-brief`}
                  hint={`Give the facts to use: what, for whom, any offer or date. Nothing is invented for you. ${briefLength} / ${BRIEF_MAX}`}
                >
                  <TextArea
                    id={`${ids}-brief`}
                    rows={4}
                    maxLength={BRIEF_MAX}
                    value={brief}
                    placeholder={chosen.placeholder}
                    onChange={(event) => setBrief(event.target.value)}
                  />
                </Field>

                {KINDS_WITH_LENGTH.includes(kind) ? (
                  <div>
                    <p aria-hidden className="mb-1.5 text-sm font-medium">
                      Length
                    </p>
                    <SegmentedControl<CopyLength>
                      label="Length"
                      options={COPY_LENGTHS.map((l) => ({ value: l.id, label: l.label }))}
                      value={length}
                      onChange={setLength}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    disabled={busy || out || briefLength < BRIEF_MIN}
                    onClick={() => void write()}
                  >
                    {busy
                      ? "Writing…"
                      : result
                        ? `Write ${BRAND_COPY_OPTIONS} more`
                        : `Write ${BRAND_COPY_OPTIONS} options`}
                  </Button>
                  <p className="text-sm text-[var(--av2-text-2)]" role="status">
                    {out
                      ? "Your company has used today's writing runs. More open up over the next 24 hours."
                      : busy
                        ? "This takes a few seconds."
                        : "A run counts only when the copy is written."}
                  </p>
                </div>

                {error ? <Callout tone="error">{error}</Callout> : null}
              </div>
            </Card>

            {result ? (
              <Card>
                <CardTitle>
                  {COPY_KINDS.find((k) => k.id === result.kind)?.label ?? "Options"}
                </CardTitle>
                {result.usedVoice ? null : (
                  <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                    Written in a plain style, because your brand guide doesn&apos;t describe your
                    voice yet.
                  </p>
                )}
                <ol className="mt-4 flex flex-col gap-3">
                  {result.options.map((option, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4"
                    >
                      <p className="text-base leading-6 whitespace-pre-wrap">{option}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => void copy(option, index)}>
                          {copied === index ? "Copied" : "Copy"}
                        </Button>
                        {result.kind === "caption" || result.kind === "ad" ? (
                          <Button size="sm" variant="ghost" onClick={() => previewAsPost(option)}>
                            Preview as a post
                          </Button>
                        ) : null}
                        <span className="text-xs text-[var(--av2-text-2)] tabular-nums">
                          {option.length} characters
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm text-[var(--av2-text-2)]">
                  Written by AI from your description and your brand guide. Read it before you
                  publish, and check every fact.
                </p>
              </Card>
            ) : null}
          </div>

          <Card as="div">
            <CardTitle>Your brand&apos;s voice</CardTitle>
            {status === "loading" ? (
              <p className="mt-2 text-sm text-[var(--av2-text-2)]">Loading…</p>
            ) : typeof status === "object" && status.hasVoice ? (
              <>
                <dl className="mt-3 flex flex-col gap-3">
                  {status.voice.map((row) => (
                    <div key={row.label}>
                      <dt className="text-xs font-semibold text-[var(--av2-text-2)]">
                        {row.label}
                      </dt>
                      <dd className="text-sm">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                  From your brand guide. The copy also follows its voice notes, its “always” and
                  “never” lists and your sample text.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                Your brand guide doesn&apos;t describe how your brand talks yet, so the copy will be
                in a plain style. Add tone words, notes or a sample of your writing and it will
                sound like you.
              </p>
            )}
            <Link href="/customer/brand" className={`mt-4 ${buttonClass("secondary", "sm")}`}>
              {typeof status === "object" && status.hasVoice
                ? "Edit in Brand guide"
                : "Open Brand guide"}
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
