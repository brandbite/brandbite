// -----------------------------------------------------------------------------
// @file: app/customer/settings/page.tsx
// @purpose: Customer settings under Company, Plan & billing, Notifications and
//           Workspace access tabs. Panels stay mounted so edits survive a switch.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import {
  IconBuilding,
  IconCoins,
  IconDocument,
  IconTicket,
  IconUsers,
} from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  Eyebrow,
  Field,
  fmt,
  IconTile,
  KeyValueList,
  PageHeader,
  plural,
  Skeleton,
  Tabs,
  TextInput,
  TextLink,
  type Tone,
} from "@/components/admin/v2/ui";
import { KeptTabPanel, useTabFromUrl } from "@/components/dashboard/account/account-ui";
import { CompanyTagsCard } from "@/components/dashboard/account/company-tags";
import { DeleteAccountCard } from "@/components/dashboard/account/delete-account";
import {
  NotificationPreferencesBody,
  useNotificationPreferences,
} from "@/components/dashboard/account/notification-matrix";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { CONTACT_EMAIL } from "@/lib/brand";

type UserRole = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";
type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";
type BillingStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";

type CustomerSettingsResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    companyRole: CompanyRole | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    tokenBalance: number;
    billingStatus: BillingStatus | null;
    hasLiveSubscription: boolean;
    createdAt: string;
    updatedAt: string;
    counts: {
      members: number;
      projects: number;
      tickets: number;
    };
  };
  plan: {
    id: string;
    name: string;
    monthlyTokens: number;
    priceCents: number | null;
    isActive: boolean;
  } | null;
};

// Top-up packs (one-time Plans where isRecurring=false).
type Topup = {
  id: string;
  name: string;
  description: string | null;
  monthlyTokens: number;
  priceCents: number | null;
};

// Available recurring plans (for upgrade/downgrade).
type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  monthlyTokens: number;
  priceCents: number | null;
};

type SettingsTab = "company" | "plan" | "notifications" | "access";

const TABS: readonly SettingsTab[] = ["company", "plan", "notifications", "access"];
const TAB_PREFIX = "customer-settings";

function hasPlanManagementAccess(role: CompanyRole | null | undefined): boolean {
  return role === "OWNER" || role === "BILLING";
}

function hasCompanyEditAccess(role: CompanyRole | null | undefined): boolean {
  return role === "OWNER" || role === "PM";
}

function prettyCompanyRole(role: CompanyRole | null | undefined): string {
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
      return DASH;
  }
}

function prettyRole(role: UserRole): string {
  switch (role) {
    case "SITE_OWNER":
      return "Site owner";
    case "SITE_ADMIN":
      return "Site admin";
    case "DESIGNER":
      return "Creative";
    case "CUSTOMER":
      return "Customer";
    default:
      return role;
  }
}

function prettyBillingStatus(status: BillingStatus | null | undefined): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Past due";
    case "CANCELED":
      return "Canceled";
    default:
      return "Not set";
  }
}

function billingStatusTone(status: BillingStatus | null | undefined): Tone {
  switch (status) {
    case "ACTIVE":
      return "green";
    case "PAST_DUE":
      return "amber";
    default:
      return "neutral";
  }
}

function formatPrice(priceCents: number | null): string {
  if (priceCents == null) return DASH;
  const dollars = priceCents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconTile tone="neutral" size={44}>
        {icon}
      </IconTile>
      <div className="min-w-0">
        <p className="text-xl leading-7 font-bold tabular-nums">{value}</p>
        <p className="text-sm text-[var(--av2-text-2)]">{label}</p>
      </div>
    </div>
  );
}

export default function CustomerSettingsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<CustomerSettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const notifications = useNotificationPreferences();

  // Null until the user picks one: the default depends on the company role.
  const [tab, setTab] = useState<SettingsTab | null>(null);
  useTabFromUrl<SettingsTab>(TABS, setTab);

  // User profile editing
  const [editingUser, setEditingUser] = useState(false);
  const [draftUserName, setDraftUserName] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Company profile editing
  const [editingCompany, setEditingCompany] = useState(false);
  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [draftWebsite, setDraftWebsite] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState<boolean>(false);

  const [topups, setTopups] = useState<Topup[]>([]);
  const [topupLoadingId, setTopupLoadingId] = useState<string | null>(null);

  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [planChangeTarget, setPlanChangeTarget] = useState<SubscriptionPlan | null>(null);

  // Leave-workspace state. Softer alternative to deleting the whole account
  // — severs CompanyMember row only, keeps the UserAccount + ledger. Server
  // blocks the last OWNER from leaving (must transfer ownership first).
  const [leaveWorkspaceOpen, setLeaveWorkspaceOpen] = useState(false);
  const [leavingWorkspace, setLeavingWorkspace] = useState(false);
  const [leaveWorkspaceError, setLeaveWorkspaceError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    amountDueCents: number;
    currency: string;
    lineItems: { description: string | null; amountCents: number; proration: boolean }[];
  } | null>(null);
  const [changePlanSaving, setChangePlanSaving] = useState(false);

  const searchParams = useSearchParams();
  const billingStatusParam = searchParams.get("billing");
  const returnDraftId = searchParams.get("draft");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerSettingsResponse);
        }
      } catch (err: any) {
        console.error("Customer settings fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load settings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load top-up packs (non-recurring plans) for the "Need more tokens now?" section.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/plans/topups", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json?.topups)) setTopups(json.topups as Topup[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the catalog of recurring plans so the customer can upgrade/downgrade.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/plans/subscriptions", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json?.plans)) setAvailablePlans(json.plans as SubscriptionPlan[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- User profile save ----
  const handleSaveUser = useCallback(async () => {
    const trimmed = draftUserName.trim();
    if (!trimmed) {
      showToast({ type: "error", title: "Name cannot be empty" });
      return;
    }
    setSavingUser(true);
    try {
      const res = await fetch("/api/customer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: { name: trimmed } }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, name: trimmed } } : prev));
      setEditingUser(false);
      showToast({ type: "success", title: "Profile updated" });
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Failed to update profile",
      });
    } finally {
      setSavingUser(false);
    }
  }, [draftUserName, showToast]);

  // ---- Company profile save ----
  const handleSaveCompany = useCallback(async () => {
    const trimmedName = draftCompanyName.trim();
    if (trimmedName.length < 2) {
      showToast({
        type: "error",
        title: "Company name must be at least 2 characters",
      });
      return;
    }
    setSavingCompany(true);
    try {
      const res = await fetch("/api/customer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: {
            name: trimmedName,
            website: draftWebsite.trim() || null,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to update");
      setData((prev) =>
        prev
          ? {
              ...prev,
              company: {
                ...prev.company,
                name: trimmedName,
                website: draftWebsite.trim() || null,
              },
            }
          : prev,
      );
      setEditingCompany(false);
      showToast({ type: "success", title: "Company profile updated" });
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Failed to update company",
      });
    } finally {
      setSavingCompany(false);
    }
  }, [draftCompanyName, draftWebsite, showToast]);

  const user = data?.user;
  const company = data?.company;
  const plan = data?.plan;

  const canManagePlan = hasPlanManagementAccess(user?.companyRole ?? null);
  const canEditCompany = hasCompanyEditAccess(user?.companyRole ?? null);

  // Back from Stripe lands on the plan; otherwise whoever manages the plan
  // starts there and everyone else starts on the company.
  const activeTab: SettingsTab = tab ?? (billingStatusParam || canManagePlan ? "plan" : "company");

  const unsaved =
    (editingUser && draftUserName.trim() !== (user?.name ?? "")) ||
    (editingCompany &&
      (draftCompanyName.trim() !== (company?.name ?? "") ||
        draftWebsite.trim() !== (company?.website ?? "")));
  useUnsavedChanges(unsaved, "Settings");

  const handleStartBillingCheckout = async () => {
    if (!plan?.id) return;
    setBillingLoading(true);
    setBillingError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id, returnDraftId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.url) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      // Redirect user to Stripe Checkout
      window.location.href = json.url as string;
    } catch (err: any) {
      console.error("Billing checkout error:", err);
      setBillingError(err?.message || "Failed to start billing checkout.");
    } finally {
      setBillingLoading(false);
    }
  };

  /** Open the change-plan confirm modal and fetch the upcoming-invoice preview
   *  so the customer can see the prorated cost before committing. */
  const openPlanChange = async (target: SubscriptionPlan) => {
    setPlanChangeTarget(target);
    setPreview(null);
    setBillingError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/billing/preview-plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: target.id }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        setPreview({
          amountDueCents: json.amountDueCents,
          currency: json.currency,
          lineItems: json.lineItems ?? [],
        });
      }
    } catch (err) {
      console.error("[plan-change preview] error", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePlanChange = () => {
    setPlanChangeTarget(null);
    setPreview(null);
  };

  const confirmPlanChange = async () => {
    if (!planChangeTarget) return;
    setChangePlanSaving(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planChangeTarget.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      showToast({ type: "success", title: "Plan changed. Next invoice will reflect the change." });
      closePlanChange();
      // Refresh the settings payload so the header card shows the new plan.
      const reload = await fetch("/api/customer/settings", { cache: "no-store" });
      const reloadJson = await reload.json().catch(() => null);
      if (reload.ok && reloadJson) setData(reloadJson as CustomerSettingsResponse);
    } catch (err: any) {
      console.error("[plan-change confirm] error", err);
      setBillingError(err?.message || "Failed to change plan.");
    } finally {
      setChangePlanSaving(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    setLeavingWorkspace(true);
    setLeaveWorkspaceError(null);
    try {
      const res = await fetch("/api/customer/members/me", { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to leave workspace.");
      }
      // Hard reload: the server has no opinion about which company to switch
      // to next; let the app's normal "first company or onboarding" path
      // decide from a clean state.
      window.location.href = "/";
    } catch (err) {
      setLeaveWorkspaceError(err instanceof Error ? err.message : "Failed to leave workspace.");
    } finally {
      setLeavingWorkspace(false);
    }
  };

  /** Start a Stripe one-time checkout for a specific top-up pack planId. */
  const handleBuyTopup = async (topupId: string) => {
    setTopupLoadingId(topupId);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: topupId, returnDraftId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }
      window.location.href = json.url as string;
    } catch (err: any) {
      console.error("Top-up checkout error:", err);
      setBillingError(err?.message || "Failed to start top-up checkout.");
    } finally {
      setTopupLoadingId(null);
    }
  };

  // ---- Start editing helpers ----
  const startEditingUser = () => {
    setDraftUserName(user?.name || "");
    setEditingUser(true);
  };

  const cancelEditingUser = () => {
    setEditingUser(false);
    setDraftUserName("");
  };

  const startEditingCompany = () => {
    setDraftCompanyName(company?.name || "");
    setDraftWebsite(company?.website || "");
    setEditingCompany(true);
    setTab("company");
  };

  const cancelEditingCompany = () => {
    setEditingCompany(false);
    setDraftCompanyName("");
    setDraftWebsite("");
  };

  const otherPlans = plan ? availablePlans.filter((p) => p.id !== plan.id) : [];
  const panel = { idPrefix: TAB_PREFIX, active: activeTab };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, company and subscription information."
      />

      <div className="space-y-6">
        {error && (
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        )}

        {returnDraftId && (
          <Callout
            tone="info"
            title="Your request is saved as a draft"
            action={
              <ButtonLink href={`/customer/tickets/new?draft=${encodeURIComponent(returnDraftId)}`}>
                Continue your request
              </ButtonLink>
            }
          >
            Pick up where you left off once your balance is ready.
          </Callout>
        )}

        {/* Billing status banner (after Stripe redirect) */}
        {!loading && billingStatusParam === "success" && (
          <Callout tone="success" title="Billing updated">
            Your subscription has been updated successfully. If the changes are not reflected
            immediately, they will appear after the next refresh.
          </Callout>
        )}

        {!loading && billingStatusParam === "cancelled" && (
          <Callout tone="warning" title="Checkout cancelled">
            You cancelled the Stripe checkout. No changes were made to your current subscription.
          </Callout>
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading settings" className="space-y-6">
            <Skeleton className="h-9 w-96 max-w-full" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : !data || !company || !user ? (
          !error && (
            <Card>
              <EmptyState
                title="No settings data found."
                description="We couldn't load your account information. Please try refreshing the page."
              />
            </Card>
          )
        ) : (
          <>
            <Tabs<SettingsTab>
              label="Settings sections"
              idPrefix={TAB_PREFIX}
              value={activeTab}
              onChange={setTab}
              tabs={[
                { value: "company", label: "Company" },
                { value: "plan", label: "Plan & billing" },
                { value: "notifications", label: "Notifications" },
                { value: "access", label: "Workspace access" },
              ]}
            />

            {/* Company at a glance, on every tab */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile tone="peach" size={52}>
                    <IconBuilding />
                  </IconTile>
                  <p className="min-w-0 text-xl leading-7 font-semibold break-words">
                    {company.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  <StatTile
                    icon={<IconUsers />}
                    value={fmt(company.counts.members)}
                    label={plural(company.counts.members, "member", "members")}
                  />
                  <StatTile
                    icon={<IconDocument />}
                    value={fmt(company.counts.projects)}
                    label={plural(company.counts.projects, "project", "projects")}
                  />
                  <StatTile
                    icon={<IconTicket />}
                    value={fmt(company.counts.tickets)}
                    label={plural(company.counts.tickets, "request", "requests")}
                  />
                </div>
                {canEditCompany && !editingCompany && (
                  <Button onClick={startEditingCompany}>Edit company</Button>
                )}
              </div>
            </Card>

            {/* ======================== Company ======================== */}
            <KeptTabPanel value="company" {...panel}>
              <div className="grid items-start gap-6 xl:grid-cols-2">
                <Card>
                  <CardTitle description="The workspace your requests belong to.">
                    Company profile
                  </CardTitle>
                  <div className="mt-4">
                    {editingCompany ? (
                      <div className="space-y-4">
                        <Field label="Name" htmlFor="company-name">
                          <TextInput
                            id="company-name"
                            value={draftCompanyName}
                            onChange={(e) => setDraftCompanyName(e.target.value)}
                            placeholder="Company name"
                            autoComplete="organization"
                            disabled={savingCompany}
                            autoFocus
                          />
                        </Field>
                        <Field label="Website" htmlFor="company-website">
                          <TextInput
                            id="company-website"
                            type="url"
                            value={draftWebsite}
                            onChange={(e) => setDraftWebsite(e.target.value)}
                            autoComplete="url"
                            placeholder="https://example.com"
                            disabled={savingCompany}
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            onClick={handleSaveCompany}
                            disabled={savingCompany}
                            aria-busy={savingCompany || undefined}
                          >
                            {savingCompany ? "Saving…" : "Save"}
                          </Button>
                          <Button onClick={cancelEditingCompany} disabled={savingCompany}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <KeyValueList
                        rows={[
                          { label: "Name", value: company.name },
                          { label: "Slug", value: company.slug },
                          {
                            label: "Website",
                            value: company.website ? (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--av2-link)] underline underline-offset-2"
                              >
                                {company.website}
                              </a>
                            ) : (
                              DASH
                            ),
                          },
                          { label: "Created at", value: formatDate(company.createdAt) },
                        ]}
                      />
                    )}
                  </div>
                  {!canEditCompany && (
                    <p className="mt-4 text-sm text-[var(--av2-text-2)]">
                      Only owners and project managers can edit the company profile.
                    </p>
                  )}
                </Card>
                <CompanyTagsCard canManage={canEditCompany} />
              </div>
            </KeptTabPanel>

            {/* ===================== Plan & billing ===================== */}
            <KeptTabPanel value="plan" {...panel}>
              {billingError && !planChangeTarget && (
                <Callout tone="error" title="Billing">
                  {billingError}
                </Callout>
              )}

              <div
                className={
                  topups.length > 0
                    ? "grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]"
                    : "grid gap-6"
                }
              >
                <Card>
                  <CardTitle description="The plan that defines your monthly token allowance.">
                    Your plan &amp; billing
                  </CardTitle>

                  {plan ? (
                    <>
                      {!canManagePlan && (
                        <div className="mt-4">
                          <Callout tone="warning" title="Limited access">
                            You don&apos;t have permission to manage billing for this company. You
                            can see the current plan, but only the owner or billing manager can
                            request changes.
                          </Callout>
                        </div>
                      )}
                      <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
                        <div className="flex min-w-0 items-center gap-4">
                          <IconTile tone="green" size={64}>
                            <IconCoins width={28} height={28} />
                          </IconTile>
                          <div className="min-w-0">
                            <Eyebrow>Current plan</Eyebrow>
                            <p className="mt-1 text-2xl leading-8 font-bold">{plan.name}</p>
                            <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                              {plan.monthlyTokens.toLocaleString()} tokens/month ·{" "}
                              {plan.priceCents == null
                                ? DASH
                                : `${formatPrice(plan.priceCents)}/month`}
                            </p>
                          </div>
                        </div>
                        <div className="min-w-[200px]">
                          <Eyebrow>Subscription status</Eyebrow>
                          <div className="mt-2">
                            <Badge tone={billingStatusTone(company.billingStatus)}>
                              {prettyBillingStatus(company.billingStatus)}
                            </Badge>
                          </div>
                          {/* Only offered when there's no live subscription — a second
                              checkout would create a second, double-billed subscription
                              (the API refuses it too). */}
                          {canManagePlan && !company.hasLiveSubscription && (
                            <Button
                              variant="primary"
                              className="mt-3 w-full"
                              onClick={handleStartBillingCheckout}
                              disabled={billingLoading || !plan.isActive}
                              aria-busy={billingLoading || undefined}
                            >
                              {billingLoading ? "Redirecting…" : "Start subscription"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="mt-5 border-t border-[var(--av2-border)] pt-4 text-sm text-[var(--av2-text-2)]">
                        {canManagePlan && company.hasLiveSubscription ? (
                          <>
                            To upgrade or downgrade, use <strong>Switch to a different plan</strong>{" "}
                            below. For invoices, your payment method or cancelling, contact us at{" "}
                            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
                              {CONTACT_EMAIL}
                            </a>
                            .
                          </>
                        ) : canManagePlan ? (
                          <>
                            Start your subscription through Stripe to receive your monthly tokens.
                          </>
                        ) : (
                          <>
                            Need to change something? Ask your company owner or billing manager to
                            manage the subscription.
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--av2-text-2)]">
                      No subscription plan is assigned to your company yet. Please contact support
                      if this does not look correct.
                    </p>
                  )}
                </Card>

                {/* One-time token top-up packs */}
                {topups.length > 0 && (
                  <Card>
                    <CardTitle description="One-time top-up — charged immediately, tokens credited when payment succeeds.">
                      Need more tokens now?
                    </CardTitle>
                    <ul className="mt-4 space-y-3">
                      {topups.map((t) => (
                        <li
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--av2-border)] p-4"
                        >
                          <div className="min-w-0">
                            <p className="text-base font-semibold">
                              {t.monthlyTokens.toLocaleString()} tokens
                            </p>
                            <p className="text-sm text-[var(--av2-text-2)]">
                              {formatPrice(t.priceCents)} one-time
                            </p>
                            <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                              {t.name}
                              {t.description ? ` · ${t.description}` : ""}
                            </p>
                          </div>
                          {canManagePlan ? (
                            <Button
                              onClick={() => handleBuyTopup(t.id)}
                              disabled={topupLoadingId !== null}
                              aria-busy={topupLoadingId === t.id || undefined}
                            >
                              {topupLoadingId === t.id ? "Redirecting…" : "Buy tokens"}
                            </Button>
                          ) : (
                            <p className="text-xs text-[var(--av2-text-2)]">Owner / Billing only</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>

              {/* Change plan — upgrade/downgrade with Stripe proration */}
              {plan && canManagePlan && otherPlans.length > 0 && (
                <Card>
                  <CardTitle description="Upgrade or downgrade at any time. Stripe prorates the charge so you only pay the difference for the remaining days in your billing period.">
                    Switch to a different plan
                  </CardTitle>
                  <ul className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {otherPlans.map((p) => {
                      const isUpgrade = p.monthlyTokens > plan.monthlyTokens;
                      return (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--av2-border)] p-4"
                        >
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
                              {p.name}
                              <Badge tone={isUpgrade ? "peach" : "neutral"}>
                                {isUpgrade ? "Upgrade" : "Downgrade"}
                              </Badge>
                            </p>
                            {p.description && (
                              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                                {p.description}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                              {p.monthlyTokens.toLocaleString()} tokens/month
                            </p>
                            <p className="text-sm font-semibold">
                              {p.priceCents == null ? DASH : `${formatPrice(p.priceCents)}/month`}
                            </p>
                          </div>
                          <Button onClick={() => openPlanChange(p)} disabled={changePlanSaving}>
                            Preview change
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4">
                    <Callout tone="info" title="Preview before you change plans">
                      You&apos;ll see the prorated charge before you confirm the switch.
                    </Callout>
                  </div>
                </Card>
              )}
            </KeptTabPanel>

            {/* ===================== Notifications ===================== */}
            <KeptTabPanel value="notifications" {...panel}>
              <Card>
                <CardTitle description="Choose which events you want to be notified about. Changes save instantly, and these are the same personal choices as under your profile.">
                  Notification preferences
                </CardTitle>
                <div className="mt-4">
                  <NotificationPreferencesBody role="CUSTOMER" state={notifications} />
                </div>
              </Card>
            </KeptTabPanel>

            {/* ==================== Workspace access ==================== */}
            <KeptTabPanel value="access" {...panel}>
              <div className="grid items-start gap-6 xl:grid-cols-2">
                <Card>
                  <CardTitle
                    description="Your personal profile inside brandbite."
                    action={
                      !editingUser ? <Button onClick={startEditingUser}>Edit</Button> : undefined
                    }
                  >
                    Your account
                  </CardTitle>
                  <div className="mt-4">
                    {editingUser && (
                      <Field label="Name" htmlFor="account-name" className="mb-4">
                        <TextInput
                          id="account-name"
                          value={draftUserName}
                          onChange={(e) => setDraftUserName(e.target.value)}
                          placeholder="Your name"
                          autoComplete="name"
                          disabled={savingUser}
                          autoFocus
                        />
                      </Field>
                    )}
                    <KeyValueList
                      rows={[
                        ...(editingUser ? [] : [{ label: "Name", value: user.name || DASH }]),
                        { label: "Email", value: user.email },
                        { label: "Role", value: prettyRole(user.role) },
                        { label: "Company role", value: prettyCompanyRole(user.companyRole) },
                      ]}
                    />
                    {editingUser && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          onClick={handleSaveUser}
                          disabled={savingUser}
                          aria-busy={savingUser || undefined}
                        >
                          {savingUser ? "Saving…" : "Save"}
                        </Button>
                        <Button onClick={cancelEditingUser} disabled={savingUser}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[var(--av2-border)] pt-4">
                    <TextLink href="/customer/profile">Open your profile</TextLink>
                  </div>
                </Card>

                <Card>
                  <CardTitle description="Who belongs to this company and what they can do.">
                    Company members
                  </CardTitle>
                  <p className="mt-4 text-sm">
                    {company.counts.members.toLocaleString()}{" "}
                    {plural(company.counts.members, "member", "members")}
                  </p>
                  {canEditCompany ? (
                    <div className="mt-4">
                      <ButtonLink href="/customer/members">Manage members</ButtonLink>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                      Only owners and project managers can view and manage members.
                    </p>
                  )}
                </Card>
              </div>

              {/* Kept apart from the forms above. */}
              <div className="space-y-6 border-t border-[var(--av2-border)] pt-6">
                <Card className="border-[var(--av2-attention-border)]">
                  <h2 className="text-xl leading-7 font-semibold">Leave this workspace</h2>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--av2-text-2)]">
                    Remove yourself from <strong>{company.name}</strong>. Your account stays active
                    and you keep access to any other workspaces you belong to. If you are the only
                    owner, you must promote another member to Owner before leaving.
                  </p>
                  <Button
                    variant="danger"
                    className="mt-4"
                    onClick={() => {
                      setLeaveWorkspaceError(null);
                      setLeaveWorkspaceOpen(true);
                    }}
                  >
                    Leave workspace
                  </Button>
                </Card>

                <DeleteAccountCard
                  endpoint="/api/customer/account"
                  email={user.email}
                  description="Delete your brandbite account permanently. Your ledger history and existing requests are retained in anonymized form for audit purposes; your email is freed up for future sign-ups."
                />
              </div>
            </KeptTabPanel>
          </>
        )}
      </div>

      {/* Leave-workspace confirm modal. No email echo — the action is
          reversible (owner can re-invite) and the server blocks the sole
          OWNER with a clear error, so a lightweight confirm is enough. */}
      <Modal open={leaveWorkspaceOpen} onClose={() => setLeaveWorkspaceOpen(false)} size="md">
        <ModalHeader
          title={`Leave ${company?.name ?? "this workspace"}?`}
          onClose={() => setLeaveWorkspaceOpen(false)}
        />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--av2-text-2)]">
          <p>
            You&apos;ll lose access to this workspace&apos;s projects, requests, and members. Your
            account stays active and you keep any other workspace memberships. An owner can
            re-invite you later.
          </p>
          {user?.companyRole === "OWNER" && (
            <Callout tone="warning">
              You&apos;re an Owner of this workspace. If you&apos;re the only Owner, this action
              will be blocked — promote another member to Owner first.
            </Callout>
          )}
          {leaveWorkspaceError && <Callout tone="error">{leaveWorkspaceError}</Callout>}
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setLeaveWorkspaceOpen(false)}
            disabled={leavingWorkspace}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleLeaveWorkspace}
            disabled={leavingWorkspace}
            aria-busy={leavingWorkspace || undefined}
          >
            {leavingWorkspace ? "Leaving…" : "Leave workspace"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Plan change confirm modal with Stripe preview */}
      <Modal open={planChangeTarget !== null} onClose={closePlanChange} size="md">
        <ModalHeader title="Confirm plan change" onClose={closePlanChange} />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--av2-text-2)]">
          {planChangeTarget && (
            <>
              <p>
                Switch to <strong>{planChangeTarget.name}</strong> (
                {planChangeTarget.monthlyTokens.toLocaleString()} tokens/mo)?
              </p>
              {previewLoading && <p className="text-xs">Fetching prorated cost from Stripe…</p>}
              {!previewLoading && preview && (
                <div className="rounded-lg border border-[var(--av2-border)] p-3 text-sm">
                  <p>Your next invoice from Stripe will look like this:</p>
                  <ul className="mt-2 space-y-1">
                    {preview.lineItems.map((li, i) => (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <span className="flex-1">
                          {li.description ?? "Line item"}
                          {li.proration && <span className="ml-1 text-xs">(proration)</span>}
                        </span>
                        <span className="font-mono text-[var(--av2-text)]">
                          {(li.amountCents / 100).toFixed(2)} {preview.currency.toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--av2-border)] pt-2 font-semibold text-[var(--av2-text)]">
                    <span>Amount due now</span>
                    <span className="font-mono">
                      {(preview.amountDueCents / 100).toFixed(2)} {preview.currency.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              {!previewLoading && !preview && (
                <p className="text-xs">
                  (Preview unavailable — Stripe will bill the prorated difference on your next
                  invoice.)
                </p>
              )}
              {billingError && <Callout tone="error">{billingError}</Callout>}
            </>
          )}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={closePlanChange} disabled={changePlanSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmPlanChange}
            disabled={changePlanSaving}
            aria-busy={changePlanSaving || undefined}
          >
            {changePlanSaving ? "Switching…" : "Confirm switch"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
