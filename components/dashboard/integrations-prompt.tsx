// -----------------------------------------------------------------------------
// @file: components/dashboard/integrations-prompt.tsx
// @purpose: On the customer overview: tell companies that haven't connected
//           Google Drive or Dropbox that they can, and why it helps (source
//           files land in their own storage for good instead of being deleted
//           from brandbite 90 days after a request is done). Owners and PMs
//           get Connect buttons; other members are told who can connect.
//           A connection that needs reconnecting gets a reconnect prompt.
//           "Not now" hides it in this browser for 30 days.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClass } from "@/components/admin/v2/ui";

type Integration = {
  provider: "GOOGLE_DRIVE" | "DROPBOX" | "SLACK";
  label: string;
  slug: string;
  available: boolean;
  status: "CONNECTED" | "BROKEN" | "NOT_CONNECTED";
};

const STORAGE = ["GOOGLE_DRIVE", "DROPBOX"] as const;
const DISMISS_KEY = "bb-integrations-prompt-dismissed-until";
const DISMISS_DAYS = 30;

function dismissedNow(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

export function IntegrationsPrompt() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  // Nothing renders until the fetch below answers, so reading the browser's
  // storage here can't make the server and client markup differ.
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && dismissedNow());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/integrations", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.integrations) return;
        setItems(json.integrations);
        setCanManage(Boolean(json.canManage));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) return null;
  const storage = items.filter(
    (i): i is Integration & { provider: (typeof STORAGE)[number] } =>
      (STORAGE as readonly string[]).includes(i.provider) && i.available,
  );
  if (storage.length === 0) return null;
  if (storage.some((i) => i.status === "CONNECTED")) return null;
  const broken = storage.find((i) => i.status === "BROKEN");

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
      );
    } catch {
      // storage blocked: just hide for now
    }
    setHidden(true);
  };

  // A broken connection is worth showing even after "Not now".
  if (hidden && !broken) return null;

  return (
    <section
      aria-labelledby="integrations-prompt-title"
      className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-80">
          <h2 id="integrations-prompt-title" className="text-xl leading-7 font-semibold">
            {broken
              ? `${broken.label} needs reconnecting`
              : "Keep your source files in your own storage"}
          </h2>
          {broken ? (
            <p className="mt-1 text-base text-[var(--av2-text-2)]">
              {broken.label} stopped accepting brandbite&apos;s access, so new source files are kept
              on brandbite for 90 days instead. Reconnect it so they land in your own storage again.
            </p>
          ) : (
            <>
              <p className="mt-1 text-base text-[var(--av2-text-2)]">
                Connect Google Drive or Dropbox and your creative&apos;s layered and print-ready
                files (PSD, AI, video projects) go straight into your account.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>
                  <span className="font-medium">Yours for good.</span>{" "}
                  <span className="text-[var(--av2-text-2)]">
                    Without a connection, source files are deleted from brandbite 90 days after a
                    request is done.
                  </span>
                </li>
                <li>
                  <span className="font-medium">Already organised.</span>{" "}
                  <span className="text-[var(--av2-text-2)]">
                    One folder per project and request, ready to share with your team.
                  </span>
                </li>
                <li>
                  <span className="font-medium">Private.</span>{" "}
                  <span className="text-[var(--av2-text-2)]">
                    brandbite only sees the folder it creates, nothing else in your storage.
                  </span>
                </li>
              </ul>
            </>
          )}
          {!canManage ? (
            <p className="mt-3 text-sm text-[var(--av2-text-2)]">
              Your company owner or a project manager can connect it under Settings › Integrations.
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full">
          {canManage
            ? (broken ? [broken] : storage).map((item, index) => (
                // A full page load: the connect route redirects to the provider.
                <a
                  key={item.provider}
                  href={`/api/customer/integrations/${item.slug}/connect`}
                  className={buttonClass(index === 0 ? "primary" : "secondary")}
                >
                  {broken ? `Reconnect ${item.label}` : `Connect ${item.label}`}
                </a>
              ))
            : null}
          <Link
            href="/customer/settings?tab=integrations"
            className="px-2 text-sm font-medium text-[var(--av2-link)] hover:underline"
          >
            Learn more
          </Link>
          {!broken ? (
            <Button variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
