// -----------------------------------------------------------------------------
// @file: app/admin/plans/page.tsx
// @purpose: Admin-facing management of subscription plans
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";

type Plan = {
  id: string;
  name: string;
  monthlyTokens: number;
  priceCents: number | null;
  isActive: boolean;
  isRecurring: boolean;
  // Stripe mapping fields
  stripeProductId: string | null;
  stripePriceId: string | null;
  // Public landing-page display copy (PR 2 of pricing rework). Surfaces
  // through /api/plans for unauthenticated visitors.
  tagline: string | null;
  features: string[] | null;
  displayCtaLabel: string | null;
  displaySubtitle: string | null;
  displayOrder: number | null;

  attachedCompanies: number;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: Plan[];
};

export default function AdminPlansPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Plan | null>(null);
  const [name, setName] = useState("");
  const [monthlyTokens, setMonthlyTokens] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isRecurring, setIsRecurring] = useState(true);
  const [stripeProductId, setStripeProductId] = useState("");
  const [stripePriceId, setStripePriceId] = useState("");
  // Public landing-page display copy. Edited as separate fields here
  // and surfaced via /api/plans for the unauthenticated landing page.
  // `featuresText` is a newline-separated textarea — the API splits it
  // back into a string[] before persisting.
  const [tagline, setTagline] = useState("");
  const [featuresText, setFeaturesText] = useState("");
  const [displayCtaLabel, setDisplayCtaLabel] = useState("");
  const [displaySubtitle, setDisplaySubtitle] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const plans = data?.plans ?? [];

  const activeCount = useMemo(() => plans.filter((p) => p.isActive).length, [plans]);
  const totalMonthlyTokens = useMemo(
    () => plans.reduce((sum, p) => sum + p.monthlyTokens, 0),
    [plans],
  );

  const resetForm = () => {
    setSelected(null);
    setName("");
    setMonthlyTokens("");
    setPriceCents("");
    setIsActive(true);
    setIsRecurring(true);
    setStripeProductId("");
    setStripePriceId("");
    setTagline("");
    setFeaturesText("");
    setDisplayCtaLabel("");
    setDisplaySubtitle("");
    setDisplayOrder("");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromPlan = (plan: Plan) => {
    setSelected(plan);
    setName(plan.name);
    setMonthlyTokens(String(plan.monthlyTokens));
    setPriceCents(plan.priceCents != null ? String(plan.priceCents) : "");
    setIsActive(plan.isActive);
    setIsRecurring(plan.isRecurring);
    setStripeProductId(plan.stripeProductId ?? "");
    setStripePriceId(plan.stripePriceId ?? "");
    setTagline(plan.tagline ?? "");
    setFeaturesText(plan.features?.join("\n") ?? "");
    setDisplayCtaLabel(plan.displayCtaLabel ?? "");
    setDisplaySubtitle(plan.displaySubtitle ?? "");
    setDisplayOrder(plan.displayOrder != null ? String(plan.displayOrder) : "");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You must be signed in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to manage plans.");
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as PlansResponse);
    } catch (err: any) {
      console.error("Admin plans fetch error:", err);
      setError(err?.message || "Failed to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await load();
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClickPlan = (plan: Plan) => {
    fillFormFromPlan(plan);
  };

  const handleNewPlan = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const mt = parseInt(monthlyTokens, 10);
      if (!Number.isFinite(mt) || mt <= 0) {
        throw new Error("Monthly tokens must be a positive number.");
      }

      const payload: any = {
        name: name.trim(),
        monthlyTokens: mt,
        isActive,
        isRecurring,
      };

      if (priceCents.trim() !== "") {
        const pc = parseInt(priceCents, 10);
        if (!Number.isFinite(pc) || pc < 0) {
          throw new Error("Price (cents) must be a non-negative number.");
        }
        payload.priceCents = pc;
      } else {
        payload.priceCents = null;
      }

      // Stripe IDs (optional)
      const productId = stripeProductId.trim();
      const priceId = stripePriceId.trim();
      payload.stripeProductId = productId !== "" ? productId : null;
      payload.stripePriceId = priceId !== "" ? priceId : null;

      // Public display copy. Send as strings; API/schema handle the
      // newline-split for `features` and the empty-string -> null
      // coercion for the rest.
      payload.tagline = tagline.trim() === "" ? null : tagline.trim();
      payload.features = featuresText.trim() === "" ? null : featuresText;
      payload.displayCtaLabel = displayCtaLabel.trim() === "" ? null : displayCtaLabel.trim();
      payload.displaySubtitle = displaySubtitle.trim() === "" ? null : displaySubtitle.trim();
      if (displayOrder.trim() === "") {
        payload.displayOrder = null;
      } else {
        const ord = parseInt(displayOrder, 10);
        if (!Number.isFinite(ord) || ord < 0) {
          throw new Error("Display order must be a non-negative integer.");
        }
        payload.displayOrder = ord;
      }

      const isEditing = !!selected;

      const res = await fetch("/api/admin/plans", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isEditing ? { id: selected?.id, ...payload } : payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const msg = isEditing ? "Plan updated successfully." : "Plan created successfully.";
      setSaveSuccess(msg);
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Admin plans save error:", err);
      const errMsg = err?.message || "Failed to save plan.";
      setSaveError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (priceCents: number | null) => {
    if (priceCents == null) return "—";
    const dollars = priceCents / 100;
    return `$${dollars.toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Configure subscription plans with monthly tokens, pricing and Stripe mapping.
          </p>
        </div>
        <Button onClick={handleNewPlan}>New plan</Button>
      </div>

      <OwnerOnlyBanner action="create, edit, or delete plans" />

      {/* Error */}
      {error && (
        <InlineAlert variant="error" title="Error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Summary cards */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Total plans
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : plans.length}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">All configured plans.</p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Active
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : activeCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            Plans currently available for assignment.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Total monthly tokens
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : totalMonthlyTokens}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            Sum of monthly tokens across all plans.
          </p>
        </div>
      </section>

      {/* Table + Form — stacks below lg so the form column doesn't get
          squeezed (labels like "Price (in cents, optional)" and Stripe
          placeholders need ~400px to breathe). 2-col kicks in at lg
          (1024px+). */}
      <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        {/* List */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Plan list</h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">Click a row to edit.</p>
          </div>

          {loading ? (
            <LoadingState message="Loading plans…" />
          ) : plans.length === 0 ? (
            <EmptyState title="No plans defined yet." />
          ) : (
            <DataTable maxHeight="420px">
              <THead>
                <TH>Name</TH>
                <TH align="right">Monthly tokens</TH>
                <TH align="right">Price</TH>
                <TH align="center">Status</TH>
                <TH>Stripe IDs</TH>
                <TH align="right">Companies</TH>
                <TH align="right">Updated</TH>
              </THead>
              <tbody>
                {plans.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-[var(--bb-border-subtle)] last:border-b-0 ${
                      selected?.id === p.id
                        ? "bg-[var(--bb-primary-light)]"
                        : "bg-[var(--bb-bg-page)]"
                    } cursor-pointer`}
                    onClick={() => handleClickPlan(p)}
                  >
                    <TD>
                      <div className="font-semibold">{p.name}</div>
                    </TD>
                    <TD align="right">{p.monthlyTokens}</TD>
                    <TD align="right">{formatPrice(p.priceCents)}</TD>
                    <TD align="center">
                      <Badge variant={p.isActive ? "success" : "neutral"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="text-[var(--bb-secondary)]">{p.stripeProductId || "—"}</div>
                      <div className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                        {p.stripePriceId || "—"}
                      </div>
                    </TD>
                    <TD align="right">{p.attachedCompanies}</TD>
                    <TD align="right" className="text-[var(--bb-text-tertiary)]">
                      {formatDate(p.updatedAt)}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">
            {selected ? "Edit plan" : "Create new plan"}
          </h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            Monthly tokens control how many tokens are added to the company every billing cycle.
          </p>

          {saveError && (
            <InlineAlert variant="error" size="sm" className="mt-3">
              {saveError}
            </InlineAlert>
          )}

          {saveSuccess && (
            <InlineAlert variant="success" size="sm" className="mt-3">
              {saveSuccess}
            </InlineAlert>
          )}

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label htmlFor="plan-name" className="text-xs font-medium text-[var(--bb-secondary)]">
                Name
              </label>
              <FormInput
                id="plan-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Basic, Pro, Full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="plan-monthly-tokens"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Monthly tokens
              </label>
              <FormInput
                id="plan-monthly-tokens"
                type="number"
                min={1}
                value={monthlyTokens}
                onChange={(e) => setMonthlyTokens(e.target.value)}
                required
                placeholder="e.g. 100, 200, 400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="plan-price-cents"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Price (in cents, optional)
              </label>
              <FormInput
                id="plan-price-cents"
                type="number"
                min={0}
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                placeholder="e.g. 4900 for $49.00"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="plan-stripe-product-id"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Stripe product ID (optional)
              </label>
              <FormInput
                id="plan-stripe-product-id"
                type="text"
                value={stripeProductId}
                onChange={(e) => setStripeProductId(e.target.value)}
                placeholder="e.g. prod_123..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="plan-stripe-price-id"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Stripe price ID (optional)
              </label>
              <FormInput
                id="plan-stripe-price-id"
                type="text"
                value={stripePriceId}
                onChange={(e) => setStripePriceId(e.target.value)}
                placeholder="e.g. price_123..."
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--bb-secondary)]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-3 w-3 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                />
                Active
              </label>

              {selected && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Clear selection
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] p-3">
              <label className="flex items-start gap-2 text-xs font-medium text-[var(--bb-secondary)]">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="mt-0.5 h-3 w-3 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                />
                <span className="flex-1">
                  Recurring subscription
                  <span className="mt-0.5 block text-[10px] font-normal text-[var(--bb-text-muted)]">
                    {isRecurring
                      ? "Stripe subscription mode — charged monthly, renews automatically."
                      : "One-time top-up pack — single charge, tokens credited once. Use a Stripe one-time price."}
                  </span>
                </span>
              </label>
            </div>

            {/* Public landing-page display copy ----------------------- */}
            <fieldset className="rounded-lg border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] p-3">
              <legend className="px-1 text-[10px] font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Public landing-page card
              </legend>
              <p className="mb-3 text-[10px] font-normal text-[var(--bb-text-muted)]">
                Copy shown to unauthenticated visitors on the pricing card. All fields optional —
                blank = sensible fallback.
              </p>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="plan-tagline"
                    className="text-xs font-medium text-[var(--bb-secondary)]"
                  >
                    Tagline
                  </label>
                  <FormInput
                    id="plan-tagline"
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Best for startups and solo founders"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="plan-features"
                    className="text-xs font-medium text-[var(--bb-secondary)]"
                  >
                    Feature bullets (one per line, max 12)
                  </label>
                  <textarea
                    id="plan-features"
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    rows={4}
                    placeholder={
                      "1 active creative request at a time\nUnlimited revisions & brand asset storage\nDelivery in 2 to 3 business days per task"
                    }
                    className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="plan-display-cta-label"
                    className="text-xs font-medium text-[var(--bb-secondary)]"
                  >
                    CTA label (overrides default)
                  </label>
                  <FormInput
                    id="plan-display-cta-label"
                    type="text"
                    value={displayCtaLabel}
                    onChange={(e) => setDisplayCtaLabel(e.target.value)}
                    placeholder="GET STARTED"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="plan-display-subtitle"
                    className="text-xs font-medium text-[var(--bb-secondary)]"
                  >
                    Tip line below CTA
                  </label>
                  <FormInput
                    id="plan-display-subtitle"
                    type="text"
                    value={displaySubtitle}
                    onChange={(e) => setDisplaySubtitle(e.target.value)}
                    placeholder='"Pause or cancel anytime."'
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="plan-display-order"
                    className="text-xs font-medium text-[var(--bb-secondary)]"
                  >
                    Display order
                  </label>
                  <FormInput
                    id="plan-display-order"
                    type="number"
                    min={0}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    placeholder="0 = leftmost; ties broken by price asc"
                  />
                </div>
              </div>
            </fieldset>

            <Button type="submit" loading={saving} loadingText="Saving…" className="mt-2">
              {selected ? "Save changes" : "Create plan"}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
