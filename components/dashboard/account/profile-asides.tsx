// -----------------------------------------------------------------------------
// @file: components/dashboard/account/profile-asides.tsx
// @purpose: Right-hand cards on the customer + creative profile: an account
//           summary for customers and a setup checklist for creatives, both from
//           the user's real data.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { IconBuilding } from "@/components/admin/v2/icons";
import { Badge, Button, Card, Callout, TextLink } from "@/components/admin/v2/ui";

function prettyCompanyRole(role: string | null | undefined): string | null {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "PM":
      return "Project manager";
    case "BILLING":
      return "Billing manager";
    case "MEMBER":
      return "Member";
    default:
      return null;
  }
}

/** Customer: role, company role and company, with the way to company settings. */
export function CustomerAccountSummary({ roleLabel }: { roleLabel: string }) {
  const [company, setCompany] = useState<{ name: string; role: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer/settings", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.company?.name) {
          setCompany({ name: json.company.name, role: prettyCompanyRole(json.user?.companyRole) });
        }
      } catch {
        // The summary is a convenience: it simply shows less.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside>
      <Card>
        <h2 className="text-xl leading-7 font-semibold">Account summary</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>{roleLabel}</Badge>
          {company?.role && <Badge>{company.role}</Badge>}
        </div>
        {company && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium">
            <IconBuilding width={18} height={18} className="shrink-0 text-[var(--av2-text-2)]" />
            <span className="min-w-0 break-words">{company.name}</span>
          </p>
        )}
        <div className="mt-4 border-t border-[var(--av2-border)] pt-4">
          <TextLink href="/customer/settings">Company settings</TextLink>
        </div>
      </Card>
    </aside>
  );
}

function ChecklistRow({
  done,
  title,
  detail,
  action,
}: {
  /** Null while the answer isn't known. */
  done: boolean | null;
  title: string;
  detail: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--av2-border)] p-3">
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          done
            ? "border-[var(--av2-fill-green)] text-[var(--av2-fill-green)]"
            : "border-[var(--av2-fill-neutral)]"
        }`}
      >
        {done && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {title}
          <span className="sr-only">
            {done === null ? " (checking)" : done ? " (done)" : " (to do)"}
          </span>
        </p>
        <p className="text-sm text-[var(--av2-text-2)]">{detail}</p>
      </div>
      {action}
    </li>
  );
}

export function CreativeSetupChecklist({
  name,
  workingHours,
  skillCount,
  onOpenWorkload,
}: {
  name: string | null;
  workingHours: string | null;
  /** Null while unknown (loading or the request failed). */
  skillCount: number | null;
  onOpenWorkload: () => void;
}) {
  return (
    <aside>
      <Card>
        <h2 className="text-xl leading-7 font-semibold">Setup checklist</h2>
        <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
          Get your account ready to take on work.
        </p>
        <ul className="mt-4 space-y-3">
          <ChecklistRow
            done={!!name}
            title="Identity"
            detail={name ? "Name and email are set." : "Add your full name."}
          />
          <ChecklistRow
            done={!!workingHours}
            title="Working hours"
            detail={workingHours ? workingHours : "Not set."}
            action={
              <Button onClick={onOpenWorkload}>{workingHours ? "Edit" : "Open Workload"}</Button>
            }
          />
          <ChecklistRow
            done={skillCount === null ? null : skillCount > 0}
            title="Skills"
            detail={
              <>
                {skillCount === null
                  ? "Review in "
                  : skillCount === 0
                    ? "None selected yet. Choose them in "
                    : `${skillCount} selected. Change them in `}
                <Link
                  href="/creative/settings"
                  className="font-semibold text-[var(--av2-link)] underline underline-offset-2"
                >
                  Settings
                </Link>
                .
              </>
            }
          />
        </ul>
      </Card>
    </aside>
  );
}

/** Onboarding guidance, shown until the checklist is finished. */
export function CreativeSetupBanner({ onOpenWorkload }: { onOpenWorkload: () => void }) {
  return (
    <div className="mb-6">
      <Callout tone="warning" title="Finish setting up your account">
        Complete your working hours under{" "}
        <button
          type="button"
          onClick={onOpenWorkload}
          className="font-semibold text-[var(--av2-link)] underline underline-offset-2"
        >
          Workload
        </button>
        , then set your skills and availability in{" "}
        <Link
          href="/creative/settings"
          className="font-semibold text-[var(--av2-link)] underline underline-offset-2"
        >
          Settings
        </Link>{" "}
        so work can be assigned to you.
      </Callout>
    </div>
  );
}
