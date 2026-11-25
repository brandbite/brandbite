// -----------------------------------------------------------------------------
// @file: components/home/customer-cards.tsx
// @purpose: The two side cards on the customer Home. "Your brand, ready to
//           create" shows how complete the brand setup is with the next step,
//           and offers to connect file storage. "Last month" is the monthly
//           recap in short. Each loads itself and renders nothing when it has
//           nothing to say (owner switch off, nothing delivered, all done).
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { IconArrowRight, IconCoins } from "@/components/admin/v2/icons";
import { IconTile } from "@/components/admin/v2/ui";
import { ArrowLink } from "@/components/home/home-ui";
import { TOOL_ICONS } from "@/components/tools/tool-icons";
import type { BrandProfile } from "@/lib/engagement/brand-profile";
import type { MonthlyRecap } from "@/lib/engagement/monthly-recap";

type Integration = {
  provider: "GOOGLE_DRIVE" | "DROPBOX" | "SLACK";
  label: string;
  slug: string;
  available: boolean;
  status: "CONNECTED" | "BROKEN" | "NOT_CONNECTED";
};

const GREEN_LINK =
  "font-semibold text-[#256b3a] underline underline-offset-2 dark:text-[#7fd396] rounded focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

async function load<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function CloudIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 18a4 4 0 0 1-.6-7.960A5.500 5.500 0 0 1 17 9.500a4.250 4.250 0 0 1 .5 8.500z" />
    </svg>
  );
}

export function BrandReadyCard() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [storage, setStorage] = useState<{ items: Integration[]; canManage: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      load<{ enabled?: boolean; profile?: BrandProfile }>("/api/customer/brand-profile"),
      load<{ integrations?: Integration[]; canManage?: boolean }>("/api/customer/integrations"),
    ]).then(([brand, integrations]) => {
      if (!live) return;
      if (brand?.enabled && brand.profile) setProfile(brand.profile);
      if (integrations?.integrations) {
        setStorage({
          items: integrations.integrations.filter(
            (i) => (i.provider === "GOOGLE_DRIVE" || i.provider === "DROPBOX") && i.available,
          ),
          canManage: Boolean(integrations.canManage),
        });
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!loaded) return null;

  const next = profile?.steps.find((step) => !step.done) ?? null;
  const connected = storage?.items.some((i) => i.status === "CONNECTED") ?? false;
  const broken = storage?.items.find((i) => i.status === "BROKEN") ?? null;
  // The checklist's own storage step already says it; don't say it twice.
  const showStorage =
    storage != null && storage.items.length > 0 && !connected && next?.key !== "storage";

  if (!profile && !showStorage) return null;

  return (
    <section className="min-w-0 rounded-2xl border border-[#dfe9dc] bg-[var(--av2-success-bg)] p-6 dark:border-[#24382a]">
      {profile ? (
        <>
          <h2 className="text-[22px] leading-7 font-semibold text-[#1f5c2e] dark:text-[#7fd396]">
            {next ? "Your brand, ready to create" : "Your brand is ready to create"}
          </h2>
          <p className="mt-1 text-[15px]">{profile.percent}% complete</p>
          <div
            role="progressbar"
            aria-label="Brand profile"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={profile.percent}
            aria-valuetext={`${profile.percent}% complete`}
            className="mt-3 flex gap-1.5"
          >
            {profile.steps.map((step) => (
              <span
                key={step.key}
                className={`h-2.5 flex-1 rounded-full ${step.done ? "bg-[#1f6b35]" : "bg-[var(--av2-border)]"}`}
              />
            ))}
          </div>
          {next ? (
            <>
              <p className="mt-4 text-[15px]">
                Next: <span className="font-medium">{next.label}</span>, so your creative has what
                they need to stay on brand.
              </p>
              <p className="mt-1.5">
                <ArrowLink href={next.action.href}>{next.action.label}</ArrowLink>
              </p>
            </>
          ) : (
            <p className="mt-4 text-[15px]">
              All set. Your creatives have everything they need to stay on brand.
            </p>
          )}
        </>
      ) : null}

      {showStorage ? (
        <div
          className={`flex items-start gap-3.5 ${profile ? "mt-5 border-t border-[#cfdfcb] pt-5 dark:border-[#24382a]" : ""}`}
        >
          <span className="mt-0.5 shrink-0">
            <CloudIcon />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              {broken ? `${broken.label} needs reconnecting` : "Connect your file storage"}
            </h3>
            {storage.canManage ? (
              <p className="mt-0.5 text-[15px]">
                {(broken ? [broken] : storage.items).map((item, index) => (
                  <span key={item.provider}>
                    {index > 0 ? " or " : ""}
                    {/* A full page load: the connect route redirects to the provider. */}
                    <a
                      href={`/api/customer/integrations/${item.slug}/connect`}
                      className={GREEN_LINK}
                    >
                      {broken ? `Reconnect ${item.label}` : item.label}
                    </a>
                  </span>
                ))}{" "}
                <IconArrowRight width={16} height={16} className="inline align-[-3px]" />
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                Your company owner or a project manager can connect it under Settings ›
                Integrations.
              </p>
            )}
            <p className="mt-1 text-sm text-[var(--av2-text-2)]">
              Source files then go to your own storage instead of being deleted from brandbite 90
              days after a request is done.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const DeliveredIcon = TOOL_ICONS.delivery;

/** Last month in two figures; `onToggle` shows or hides the full recap. */
export function RecapMiniCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);

  useEffect(() => {
    let live = true;
    load<{ enabled?: boolean; recap?: MonthlyRecap }>("/api/customer/monthly-recap").then(
      (json) => {
        if (live && json?.enabled && json.recap) setRecap(json.recap);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (!recap || recap.jobsDelivered === 0) return null;

  return (
    <section className="min-w-0 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
      <h2 className="text-[22px] leading-7 font-semibold">Last month</h2>
      <p className="text-sm text-[var(--av2-text-2)]">{recap.monthLabel}</p>
      <ul className="mt-4 space-y-3">
        <li className="flex items-center gap-4">
          <IconTile tone="green" size={40} round>
            <DeliveredIcon width={20} height={20} />
          </IconTile>
          <span className="text-lg">
            <span className="font-bold tabular-nums">{recap.jobsDelivered}</span> delivered
          </span>
        </li>
        <li className="flex items-center gap-4">
          <IconTile tone="lavender" size={40} round>
            <IconCoins />
          </IconTile>
          <span className="text-lg">
            <span className="font-bold tabular-nums">{recap.tokensUsed}</span> tokens used
          </span>
        </li>
      </ul>
      <div className="mt-5 border-t border-[var(--av2-border)] pt-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 text-[15px] ${GREEN_LINK}`}
        >
          {open ? "Hide monthly recap" : "View monthly recap"}
          <IconArrowRight width={16} height={16} className={open ? "rotate-90" : ""} />
        </button>
      </div>
    </section>
  );
}
