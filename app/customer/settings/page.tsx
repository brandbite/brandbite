// -----------------------------------------------------------------------------
// @file: app/customer/settings/page.tsx
// @purpose: Customer-facing settings page (account + company + plan overview)
// @version: v1.4.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { FormInput } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TagBadge } from "@/components/ui/tag-badge";
import { TAG_COLORS, TAG_COLOR_KEYS, type TagColorKey } from "@/lib/tag-colors";

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

function hasPlanManagementAccess(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "OWNER" || role === "BILLING";
}

function hasCompanyEditAccess(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "OWNER" || role === "PM";
}

function prettyCompanyRole(
  role: CompanyRole | null | undefined,
): string {
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
      return "\u2014";
  }
}

function prettyBillingStatus(
  status: BillingStatus | null | undefined,
): string {
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

function billingStatusClassName(
  status: BillingStatus | null | undefined,
): string {
  switch (status) {
    case "ACTIVE":
      return "bg-[#f0fff6] text-[#137a3a]";
    case "PAST_DUE":
      return "bg-[#fff4e6] text-[#9a5b2b]";
    case "CANCELED":
      return "bg-[#f5f3f0] text-[#9a9892]";
    default:
      return "bg-[#f5f3f0] text-[#9a9892]";
  }
}

type PreferenceEntry = { type: string; enabled: boolean };

const CUSTOMER_PREFS: { type: string; label: string; description: string }[] = [
  { type: "REVISION_SUBMITTED", label: "Creative submitted a new revision", description: "Get notified when your creative uploads new work for review" },
  { type: "TICKET_STATUS_CHANGED", label: "Ticket status changed", description: "Get notified when a ticket's status is updated" },
  { type: "PIN_RESOLVED", label: "Feedback note resolved", description: "Get notified when a creative resolves one of your revision notes" },
  { type: "TICKET_COMPLETED", label: "Ticket completed", description: "Get notified when a ticket is marked as done" },
];

/** Pencil icon (inline SVG, 14x14) */
function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  );
}

export default function CustomerSettingsPage() {
  const { showToast } = useToast();
  const [data, setData] =
    useState<CustomerSettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<PreferenceEntry[]>([]);
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(true);
  const [togglingType, setTogglingType] = useState<string | null>(null);

  // User profile editing
  const [editingUser, setEditingUser] = useState(false);
  const [draftUserName, setDraftUserName] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Company profile editing
  const [editingCompany, setEditingCompany] = useState(false);
  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [draftWebsite, setDraftWebsite] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Tag management
  type SettingsTag = { id: string; name: string; color: TagColorKey };
  const [tags, setTags] = useState<SettingsTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<TagColorKey>("BLUE");
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState<TagColorKey>("BLUE");
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  const [billingError, setBillingError] = useState<string | null>(
    null,
  );
  const [billingLoading, setBillingLoading] =
    useState<boolean>(false);

  const searchParams = useSearchParams();
  const billingStatusParam = searchParams.get("billing");

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
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerSettingsResponse);
        }
      } catch (err: any) {
        console.error("Customer settings fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message || "Failed to load settings.",
          );
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

  // Load notification preferences
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/preferences");
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.preferences) {
          setNotifPrefs(json.preferences);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setNotifPrefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleTogglePref = useCallback(
    async (type: string, currentEnabled: boolean) => {
      setTogglingType(type);
      const newEnabled = !currentEnabled;
      setNotifPrefs((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: newEnabled } : p)),
      );
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, enabled: newEnabled }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setNotifPrefs((prev) =>
          prev.map((p) => (p.type === type ? { ...p, enabled: currentEnabled } : p)),
        );
        showToast({ type: "error", title: "Failed to update preference" });
      } finally {
        setTogglingType(null);
      }
    },
    [showToast],
  );

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
      setData((prev) =>
        prev ? { ...prev, user: { ...prev.user, name: trimmed } } : prev,
      );
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

  const canManagePlan = hasPlanManagementAccess(
    user?.companyRole ?? null,
  );
  const canEditCompany = hasCompanyEditAccess(
    user?.companyRole ?? null,
  );

  const formatPrice = (priceCents: number | null) => {
    if (priceCents == null) return "\u2014";
    const euros = priceCents / 100;
    return `\u20AC${euros.toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const prettyRole = (role: UserRole) => {
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
  };

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
        body: JSON.stringify({ planId: plan.id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.url) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      // Redirect user to Stripe Checkout
      window.location.href = json.url as string;
    } catch (err: any) {
      console.error("Billing checkout error:", err);
      setBillingError(
        err?.message || "Failed to start billing checkout.",
      );
    } finally {
      setBillingLoading(false);
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
  };

  const cancelEditingCompany = () => {
    setEditingCompany(false);
    setDraftCompanyName("");
    setDraftWebsite("");
  };

  // ---- Tag management ----
  useEffect(() => {
    if (!data) return;
    // Only fetch if user has edit access (OWNER + PM)
    if (!hasCompanyEditAccess(data.user.companyRole)) {
      setTagsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer/tags");
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.tags) {
          setTags(json.tags as SettingsTag[]);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [data]);

  const handleAddTag = useCallback(async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setAddingTag(true);
    try {
      const res = await fetch("/api/customer/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: newTagColor }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({
          type: "error",
          title: json?.error || "Failed to create tag",
        });
        return;
      }
      setTags((prev) =>
        [...prev, json.tag as SettingsTag].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewTagName("");
      setNewTagColor("BLUE");
      showToast({ type: "success", title: `Tag "${trimmed}" created` });
    } catch {
      showToast({ type: "error", title: "Failed to create tag" });
    } finally {
      setAddingTag(false);
    }
  }, [newTagName, newTagColor, showToast]);

  const handleSaveTag = useCallback(async () => {
    if (!editingTagId) return;
    const trimmed = editTagName.trim();
    if (!trimmed) return;
    setSavingTag(true);
    try {
      const res = await fetch(`/api/customer/tags/${editingTagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: editTagColor }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({
          type: "error",
          title: json?.error || "Failed to update tag",
        });
        return;
      }
      setTags((prev) =>
        prev.map((t) =>
          t.id === editingTagId ? (json.tag as SettingsTag) : t,
        ),
      );
      setEditingTagId(null);
      showToast({ type: "success", title: "Tag updated" });
    } catch {
      showToast({ type: "error", title: "Failed to update tag" });
    } finally {
      setSavingTag(false);
    }
  }, [editingTagId, editTagName, editTagColor, showToast]);

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      setDeletingTagId(tagId);
      try {
        const res = await fetch(`/api/customer/tags/${tagId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          showToast({
            type: "error",
            title: json?.error || "Failed to delete tag",
          });
          return;
        }
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        showToast({ type: "success", title: "Tag deleted" });
      } catch {
        showToast({ type: "error", title: "Failed to delete tag" });
      } finally {
        setDeletingTagId(null);
      }
    },
    [showToast],
  );

  const startEditingTag = (tag: SettingsTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const cancelEditingTag = () => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("BLUE");
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Settings
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Your account, company and subscription information.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <InlineAlert variant="error" title="Something went wrong" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Billing status banner (after Stripe redirect) */}
        {!loading && billingStatusParam === "success" && (
          <InlineAlert variant="success" title="Billing updated" className="mb-4">
            Your subscription has been updated successfully. If the
            changes are not reflected immediately, they will appear
            after the next refresh.
          </InlineAlert>
        )}

        {!loading && billingStatusParam === "cancelled" && (
          <InlineAlert variant="warning" title="Checkout cancelled" className="mb-4">
            You cancelled the Stripe checkout. No changes were made to
            your current subscription.
          </InlineAlert>
        )}

        {/* Content */}
        {loading ? (
          <div className="mt-6 text-sm text-[#7a7a7a]">
            Loading settings…
          </div>
        ) : !data ? (
          <div className="mt-6">
            <EmptyState title="No settings data found." description="We couldn't load your account information. Please try refreshing the page." />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* ============================================================ */}
            {/* Account card                                                  */}
            {/* ============================================================ */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Account
                  </h2>
                  <p className="mt-1 text-xs text-[#7a7a7a]">
                    Your personal profile inside Brandbite.
                  </p>
                </div>
                {!editingUser && (
                  <button
                    type="button"
                    onClick={startEditingUser}
                    className="inline-flex items-center gap-1 rounded-full border border-[#e3e1dc] px-2.5 py-1 text-[11px] font-medium text-[#7a7a7a] transition-colors hover:border-[#f15b2b] hover:text-[#f15b2b]"
                  >
                    <PencilIcon />
                    Edit
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-[#424143]">
                {/* Name — editable */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Name
                  </p>
                  {editingUser ? (
                    <FormInput
                      size="sm"
                      value={draftUserName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDraftUserName(e.target.value)
                      }
                      placeholder="Your name"
                      disabled={savingUser}
                      className="mt-1"
                      autoFocus
                    />
                  ) : (
                    <p className="mt-0.5">
                      {user?.name || "\u2014"}
                    </p>
                  )}
                </div>

                {/* Email — always read-only */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Email
                  </p>
                  <p className="mt-0.5">{user?.email}</p>
                </div>

                {/* Role — always read-only */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Role
                  </p>
                  <p className="mt-0.5">
                    {user ? prettyRole(user.role) : "\u2014"}
                  </p>
                </div>

                {/* Company role — always read-only */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Company role
                  </p>
                  <p className="mt-0.5">
                    {prettyCompanyRole(user?.companyRole ?? null)}
                  </p>
                </div>

                {/* Save / Cancel buttons */}
                {editingUser && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={savingUser}
                      loadingText="Saving…"
                      onClick={handleSaveUser}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelEditingUser}
                      disabled={savingUser}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/* Company card                                                  */}
            {/* ============================================================ */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Company
                  </h2>
                  <p className="mt-1 text-xs text-[#7a7a7a]">
                    The workspace your requests belong to.
                  </p>
                </div>
                {canEditCompany && !editingCompany && (
                  <button
                    type="button"
                    onClick={startEditingCompany}
                    className="inline-flex items-center gap-1 rounded-full border border-[#e3e1dc] px-2.5 py-1 text-[11px] font-medium text-[#7a7a7a] transition-colors hover:border-[#f15b2b] hover:text-[#f15b2b]"
                  >
                    <PencilIcon />
                    Edit
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-[#424143]">
                {/* Name — editable (OWNER + PM) */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Name
                  </p>
                  {editingCompany ? (
                    <FormInput
                      size="sm"
                      value={draftCompanyName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDraftCompanyName(e.target.value)
                      }
                      placeholder="Company name"
                      disabled={savingCompany}
                      className="mt-1"
                      autoFocus
                    />
                  ) : (
                    <p className="mt-0.5">{company?.name}</p>
                  )}
                </div>

                {/* Slug — always read-only */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Slug
                  </p>
                  <p className="mt-0.5">{company?.slug}</p>
                </div>

                {/* Website — editable (OWNER + PM) */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Website
                  </p>
                  {editingCompany ? (
                    <FormInput
                      size="sm"
                      type="url"
                      value={draftWebsite}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDraftWebsite(e.target.value)
                      }
                      placeholder="https://example.com"
                      disabled={savingCompany}
                      className="mt-1"
                    />
                  ) : company?.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-block text-[#f15b2b] underline decoration-[#f15b2b]/30 hover:decoration-[#f15b2b]"
                    >
                      {company.website}
                    </a>
                  ) : (
                    <p className="mt-0.5">{"\u2014"}</p>
                  )}
                </div>

                {/* Counts — always read-only */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Members
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.members ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Projects
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.projects ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Tickets
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.tickets ?? 0}
                    </p>
                  </div>
                </div>

                {/* Created at — always read-only */}
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Created at
                  </p>
                  <p className="mt-0.5">
                    {company
                      ? formatDate(company.createdAt)
                      : "\u2014"}
                  </p>
                </div>

                {/* Save / Cancel buttons */}
                {editingCompany && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={savingCompany}
                      loadingText="Saving…"
                      onClick={handleSaveCompany}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelEditingCompany}
                      disabled={savingCompany}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/* Plan card                                                     */}
            {/* ============================================================ */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Subscription plan
              </h2>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                The plan that defines your monthly token allowance.
              </p>

              {plan ? (
                <div className="mt-3 space-y-2 text-xs text-[#424143]">
                  {!canManagePlan && (
                    <div className="rounded-lg border border-[#f6c89f] bg-[#fff4e6] px-3 py-2 text-[11px] text-[#7a7a7a]">
                      <p className="text-[11px] font-medium text-[#9a5b2b]">
                        Limited access
                      </p>
                      <p className="mt-1">
                        You don&apos;t have permission to manage billing for
                        this company. You can see the current plan, but
                        only the owner or billing manager can request
                        changes.
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Plan name
                    </p>
                    <p className="mt-0.5">{plan.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Monthly tokens
                    </p>
                    <p className="mt-0.5">
                      {plan.monthlyTokens} tokens
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Price
                    </p>
                    <p className="mt-0.5">
                      {formatPrice(plan.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-medium text-[#9a9892]">
                        Subscription status
                      </p>
                      <div className="mt-1">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                            billingStatusClassName(
                              company?.billingStatus ?? null,
                            )
                          }
                        >
                          {prettyBillingStatus(
                            company?.billingStatus ?? null,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {billingError && (
                    <InlineAlert variant="error" size="sm" className="mt-2">
                      {billingError}
                    </InlineAlert>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="rounded-lg bg-[#fbfaf8] px-3 py-2 text-[11px] text-[#7a7a7a]">
                      {canManagePlan ? (
                        <>
                          Use the button on the right to manage your
                          subscription and billing details through
                          Stripe.
                        </>
                      ) : (
                        <>
                          Need to change something? Ask your company
                          owner or billing manager to manage the
                          subscription.
                        </>
                      )}
                    </div>

                    {canManagePlan && (
                      <button
                        type="button"
                        onClick={handleStartBillingCheckout}
                        disabled={billingLoading || !plan.isActive}
                        className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-[#f15b2b] px-3 py-2 text-[11px] font-semibold text-white shadow-sm disabled:opacity-60"
                      >
                        {billingLoading
                          ? "Redirecting\u2026"
                          : "Manage billing"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-[#fbfaf8] px-3 py-2 text-[11px] text-[#7a7a7a]">
                  No subscription plan is assigned to your company yet.
                  Please contact support if this does not look correct.
                </div>
              )}
            </section>
          </div>
        )}

        {/* Notification preferences */}
        {!loading && data && (
          <div className="mt-6 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#424143]">
              Notification preferences
            </h2>
            <p className="mt-0.5 text-[11px] text-[#9a9892]">
              Choose which events you want to be notified about
            </p>

            {notifPrefsLoading ? (
              <p className="mt-4 text-xs text-[#9a9892]">Loading preferences...</p>
            ) : (
              <div className="mt-4 space-y-1">
                {CUSTOMER_PREFS.map((pref) => {
                  const prefMap = new Map(notifPrefs.map((p) => [p.type, p.enabled]));
                  const enabled = prefMap.get(pref.type) ?? true;
                  const isToggling = togglingType === pref.type;

                  return (
                    <div
                      key={pref.type}
                      className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-[#f5f3f0]/50"
                    >
                      <div className="mr-4 min-w-0">
                        <p className="text-xs font-medium text-[#424143]">{pref.label}</p>
                        <p className="mt-0.5 text-[10px] text-[#9a9892]">{pref.description}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label={pref.label}
                        aria-checked={enabled}
                        disabled={isToggling}
                        onClick={() => handleTogglePref(pref.type, enabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                          enabled ? "bg-[#f15b2b]" : "bg-[#d0cec9]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            enabled ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tag management — OWNER + PM only */}
        {!loading && data && canEditCompany && (
          <div className="mt-6 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#424143]">Tags</h2>
            <p className="mt-0.5 text-[11px] text-[#9a9892]">
              Manage tags used to categorize creative requests across your
              company.
            </p>

            {tagsLoading ? (
              <p className="mt-4 text-xs text-[#9a9892]">Loading tags…</p>
            ) : (
              <>
                {/* Existing tags */}
                {tags.length === 0 ? (
                  <p className="mt-4 text-xs text-[#9a9892]">
                    No tags yet. Create your first tag below.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between rounded-xl bg-[#f7f5f0] px-3 py-2"
                      >
                        {editingTagId === tag.id ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={editTagName}
                              onChange={(e) =>
                                setEditTagName(e.target.value)
                              }
                              maxLength={30}
                              className="w-32 rounded border border-[#e3e1dc] px-2 py-1 text-[12px] text-[#424143] focus:border-[#f15b2b] focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveTag();
                                }
                                if (e.key === "Escape") cancelEditingTag();
                              }}
                            />
                            <div className="flex gap-1">
                              {TAG_COLOR_KEYS.map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setEditTagColor(key)}
                                  className={`h-6 w-6 rounded-full border-2 ${
                                    editTagColor === key
                                      ? "border-[#424143] scale-110"
                                      : "border-transparent"
                                  }`}
                                  style={{
                                    backgroundColor: TAG_COLORS[key].dot,
                                  }}
                                  title={TAG_COLORS[key].label}
                                />
                              ))}
                            </div>
                            <Button
                              size="sm"
                              onClick={handleSaveTag}
                              loading={savingTag}
                              loadingText="…"
                              disabled={!editTagName.trim()}
                            >
                              Save
                            </Button>
                            <button
                              type="button"
                              onClick={cancelEditingTag}
                              className="text-[11px] text-[#9a9892] hover:text-[#424143]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <TagBadge
                              name={tag.name}
                              color={tag.color}
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditingTag(tag)}
                                className="rounded p-1 text-[#9a9892] hover:text-[#424143]"
                                title="Edit tag"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTagToDelete(tag.id)}
                                disabled={deletingTagId === tag.id}
                                className="rounded p-1 text-[#9a9892] hover:text-[#b13832] disabled:opacity-50"
                                title="Delete tag"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new tag */}
                <div className="mt-4 rounded-xl border border-dashed border-[#d4d2ce] bg-white px-3 py-3">
                  <p className="mb-2 text-[11px] font-medium text-[#9a9892]">
                    Add a new tag
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                      maxLength={30}
                      className="w-40 rounded border border-[#e3e1dc] px-2 py-1.5 text-[12px] text-[#424143] placeholder:text-[#9a9892] focus:border-[#f15b2b] focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <div className="flex gap-1.5">
                      {TAG_COLOR_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewTagColor(key)}
                          className={`h-6 w-6 rounded-full border-2 transition-transform ${
                            newTagColor === key
                              ? "scale-110 border-[#424143]"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{
                            backgroundColor: TAG_COLORS[key].dot,
                          }}
                          title={TAG_COLORS[key].label}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddTag}
                      loading={addingTag}
                      loadingText="Adding…"
                      disabled={!newTagName.trim()}
                    >
                      Add tag
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      {/* Delete tag confirmation */}
      <ConfirmDialog
        open={tagToDelete !== null}
        onClose={() => setTagToDelete(null)}
        onConfirm={async () => {
          if (!tagToDelete) return;
          await handleDeleteTag(tagToDelete);
          setTagToDelete(null);
        }}
        title="Delete tag"
        description="This tag will be removed from all tickets. This can't be undone."
        confirmLabel="Delete"
        loading={deletingTagId === tagToDelete}
      />
    </>
  );
}
