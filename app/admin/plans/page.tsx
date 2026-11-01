// -----------------------------------------------------------------------------
// @file: app/admin/plans/page.tsx
// @purpose: Admin-facing management of subscription plans. Plan catalogue on
//           the left, editor panel on the right. The editor splits the plan
//           into three groups (plan details / billing & Stripe / public
//           pricing card); "New plan" starts a create flow in the same panel.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  KeyValueList,
  KpiCard,
  PageHeader,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Switch,
  TabPanel,
  Table,
  TableFooter,
  Tabs,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconCoins, IconDocument } from "@/components/admin/v2/icons";
import { IconCatalog } from "@/components/navigation/nav-icons";

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

type EditorTab = "details" | "billing" | "card";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

/** Form fields, kept as strings exactly like the inputs hold them. */
type FormState = {
  name: string;
  monthlyTokens: string;
  priceCents: string;
  isActive: boolean;
  isRecurring: boolean;
  stripeProductId: string;
  stripePriceId: string;
  tagline: string;
  featuresText: string;
  displayCtaLabel: string;
  displaySubtitle: string;
  displayOrder: string;
};

type FieldKey = "name" | "monthlyTokens" | "priceCents" | "displayOrder";

/** Which editor tab each validated field lives on. */
const FIELD_TAB: Record<FieldKey, EditorTab> = {
  name: "details",
  monthlyTokens: "details",
  priceCents: "billing",
  displayOrder: "card",
};

class FieldError extends Error {
  constructor(
    public field: FieldKey,
    message: string,
  ) {
    super(message);
  }
}

const EMPTY_FORM: FormState = {
  name: "",
  monthlyTokens: "",
  priceCents: "",
  isActive: true,
  isRecurring: true,
  stripeProductId: "",
  stripePriceId: "",
  tagline: "",
  featuresText: "",
  displayCtaLabel: "",
  displaySubtitle: "",
  displayOrder: "",
};

const formFromPlan = (plan: Plan): FormState => ({
  name: plan.name,
  monthlyTokens: String(plan.monthlyTokens),
  priceCents: plan.priceCents != null ? String(plan.priceCents) : "",
  isActive: plan.isActive,
  isRecurring: plan.isRecurring,
  stripeProductId: plan.stripeProductId ?? "",
  stripePriceId: plan.stripePriceId ?? "",
  tagline: plan.tagline ?? "",
  featuresText: plan.features?.join("\n") ?? "",
  displayCtaLabel: plan.displayCtaLabel ?? "",
  displaySubtitle: plan.displaySubtitle ?? "",
  displayOrder: plan.displayOrder != null ? String(plan.displayOrder) : "",
});

const sameForm = (a: FormState, b: FormState) =>
  (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

const formatPrice = (priceCents: number | null) => {
  if (priceCents == null) return DASH;
  const dollars = priceCents / 100;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Live "= $49.00" helper for the cents input (no conversion is sent). */
const centsHint = (raw: string) => {
  if (raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return formatPrice(n);
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

function IconPlus() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 shrink-0 text-[var(--av2-accent)]"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Same rule as the shared OwnerOnlyBanner, drawn with the v2 Callout. */
function OwnerOnlyNote({ action }: { action: string }) {
  const { isSiteOwner, loading } = useSessionRole();
  if (loading || isSiteOwner) return null;
  return (
    <div className="mb-6" role="note">
      <Callout tone="warning" title="Site owner only">
        Site admins can view this page, but only the site owner can {action}. Requests from admins
        will be rejected with a 403.
      </Callout>
    </div>
  );
}

export default function AdminPlansPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // `selected` null = the panel is in "create new plan" mode.
  const [selected, setSelected] = useState<Plan | null>(null);
  // Public landing-page display copy lives in the same form. `featuresText`
  // is a newline-separated textarea — the API splits it back into a
  // string[] before persisting.
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<EditorTab>("details");
  const [fieldError, setFieldError] = useState<{ field: FieldKey; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const plans = useMemo(() => data?.plans ?? [], [data]);

  const activeCount = useMemo(() => plans.filter((p) => p.isActive).length, [plans]);
  const totalMonthlyTokens = useMemo(
    () => plans.reduce((sum, p) => sum + p.monthlyTokens, 0),
    [plans],
  );

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "INACTIVE" && p.isActive) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.stripeProductId ?? "").toLowerCase().includes(q) ||
        (p.stripePriceId ?? "").toLowerCase().includes(q)
      );
    });
  }, [plans, query, statusFilter]);

  const filtersActive = query.trim() !== "" || statusFilter !== "ALL";
  const resetFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };

  const baseline = selected ? formFromPlan(selected) : EMPTY_FORM;
  const dirty = !sameForm(form, baseline);
  const confirmDiscard = useUnsavedChanges(dirty, selected ? `Plan: ${selected.name}` : "New plan");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldError?.field === key) setFieldError(null);
  };

  const resetForm = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setTab("details");
    setFieldError(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromPlan = (plan: Plan) => {
    setSelected(plan);
    setForm(formFromPlan(plan));
    setFieldError(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const load = async (): Promise<Plan[] | null> => {
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
      return (json as PlansResponse).plans ?? [];
    } catch (err: any) {
      console.error("Admin plans fetch error:", err);
      setError(err?.message || "Failed to load plans.");
      return null;
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

  const handleClickPlan = async (plan: Plan) => {
    if (plan.id === selected?.id) return;
    if (!(await confirmDiscard())) return;
    fillFormFromPlan(plan);
  };

  const handleNewPlan = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const handleClosePanel = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    setFieldError(null);

    try {
      // The inputs used to carry `required` (name, monthly tokens); with
      // tabbed groups the fields aren't always mounted, so it's checked here.
      if (form.name.trim() === "") {
        throw new FieldError("name", "Name is required.");
      }

      const mt = parseInt(form.monthlyTokens, 10);
      if (!Number.isFinite(mt) || mt <= 0) {
        throw new FieldError("monthlyTokens", "Monthly tokens must be a positive number.");
      }

      const payload: any = {
        name: form.name.trim(),
        monthlyTokens: mt,
        isActive: form.isActive,
        isRecurring: form.isRecurring,
      };

      if (form.priceCents.trim() !== "") {
        const pc = parseInt(form.priceCents, 10);
        if (!Number.isFinite(pc) || pc < 0) {
          throw new FieldError("priceCents", "Price (cents) must be a non-negative number.");
        }
        payload.priceCents = pc;
      } else {
        payload.priceCents = null;
      }

      // Stripe IDs (optional)
      const productId = form.stripeProductId.trim();
      const priceId = form.stripePriceId.trim();
      payload.stripeProductId = productId !== "" ? productId : null;
      payload.stripePriceId = priceId !== "" ? priceId : null;

      // Public display copy. Send as strings; API/schema handle the
      // newline-split for `features` and the empty-string -> null
      // coercion for the rest.
      payload.tagline = form.tagline.trim() === "" ? null : form.tagline.trim();
      payload.features = form.featuresText.trim() === "" ? null : form.featuresText;
      payload.displayCtaLabel =
        form.displayCtaLabel.trim() === "" ? null : form.displayCtaLabel.trim();
      payload.displaySubtitle =
        form.displaySubtitle.trim() === "" ? null : form.displaySubtitle.trim();
      if (form.displayOrder.trim() === "") {
        payload.displayOrder = null;
      } else {
        const ord = parseInt(form.displayOrder, 10);
        if (!Number.isFinite(ord) || ord < 0) {
          throw new FieldError("displayOrder", "Display order must be a non-negative integer.");
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
      showToast({ type: "success", title: msg });

      const fresh = await load();

      if (!isEditing) {
        resetForm();
      } else {
        // Re-sync the editor with the saved record so the dirty state clears.
        const updated = fresh?.find((p) => p.id === selected?.id);
        if (updated) fillFormFromPlan(updated);
      }
      setSaveSuccess(msg);
    } catch (err: any) {
      console.error("Admin plans save error:", err);
      const errMsg = err?.message || "Failed to save plan.";
      if (err instanceof FieldError) {
        setFieldError({ field: err.field, message: errMsg });
        setTab(FIELD_TAB[err.field]);
      } else {
        setSaveError(errMsg);
      }
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (f: FieldKey) => (fieldError?.field === f ? fieldError.message : undefined);

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const tabIds = "plan-editor";
  const featureLines = form.featuresText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const previewPrice = (() => {
    const hint = centsHint(form.priceCents);
    return hint ?? DASH;
  })();

  const panelTitle = (
    <span className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="truncate">{selected ? selected.name : "New plan"}</span>
      {selected ? (
        selected.isActive ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge>Inactive</Badge>
        )
      ) : (
        <Badge tone="peach">Draft</Badge>
      )}
    </span>
  );

  const panel = (
    <form onSubmit={handleSubmit} noValidate className="contents">
      <DetailPanel
        title={panelTitle}
        onClose={selected ? handleClosePanel : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={dirty}
            status={
              saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : saveSuccess
                    ? saveSuccess
                    : "No unsaved changes"
            }
          >
            {dirty && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(baseline);
                  setFieldError(null);
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || saving}>
              {saving ? "Saving…" : selected ? "Save changes" : "Create plan"}
            </Button>
          </SaveBar>
        }
      >
        <p className="mb-4 text-sm text-[var(--av2-text-2)]">
          Monthly tokens control how many tokens are added to the company every billing cycle.
        </p>

        <Tabs
          idPrefix={tabIds}
          label="Plan settings"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "details", label: "Plan details" },
            { value: "billing", label: "Billing & Stripe" },
            { value: "card", label: "Pricing card" },
          ]}
        />

        {saveError && (
          <div className="mt-5">
            <Callout tone="error" title="Couldn't save the plan">
              {saveError}
            </Callout>
          </div>
        )}

        <div className="pt-5">
          {tab === "details" && (
            <TabPanel idPrefix={tabIds} value="details">
              <div className="space-y-5">
                <Field label="Plan name" htmlFor="plan-name" error={errorFor("name")}>
                  <TextInput
                    id="plan-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={!!errorFor("name")}
                    placeholder="e.g. Basic, Pro, Full"
                  />
                </Field>

                <Field
                  label="Monthly token allowance"
                  htmlFor="plan-monthly-tokens"
                  hint="Added to a company's balance each billing cycle."
                  error={errorFor("monthlyTokens")}
                >
                  <TextInput
                    id="plan-monthly-tokens"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.monthlyTokens}
                    onChange={(e) => set("monthlyTokens", e.target.value)}
                    aria-invalid={!!errorFor("monthlyTokens")}
                    placeholder="e.g. 100, 200, 400"
                    suffix="tokens"
                  />
                </Field>

                <div>
                  <Switch
                    checked={form.isActive}
                    onChange={(v) => set("isActive", v)}
                    label="Available for assignment"
                    describedBy="plan-active-hint"
                  />
                  <p id="plan-active-hint" className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                    {form.isActive
                      ? "Active — the plan can be assigned to companies."
                      : "Inactive — hidden from plan assignment."}
                  </p>
                </div>

                {selected && (
                  <PanelSection>
                    <KeyValueList
                      rows={[
                        {
                          label: "Companies using this plan",
                          value: (
                            <span className="tabular-nums">
                              {fmt(selected.attachedCompanies)}{" "}
                              {plural(selected.attachedCompanies, "company", "companies")}
                            </span>
                          ),
                        },
                        { label: "Created", value: formatDate(selected.createdAt) },
                        { label: "Last updated", value: formatDate(selected.updatedAt) },
                      ]}
                    />
                    <div className="mt-4">
                      <TextLink href="/admin/plan-assignment">Manage assignments</TextLink>
                    </div>
                  </PanelSection>
                )}
              </div>
            </TabPanel>
          )}

          {tab === "billing" && (
            <TabPanel idPrefix={tabIds} value="billing">
              <div className="space-y-5">
                <Field
                  label="Price (optional)"
                  htmlFor="plan-price-cents"
                  error={errorFor("priceCents")}
                  hint={
                    centsHint(form.priceCents)
                      ? `Entered in cents · ${centsHint(form.priceCents)}`
                      : "Entered in cents, e.g. 4900 for $49.00."
                  }
                >
                  <TextInput
                    id="plan-price-cents"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.priceCents}
                    onChange={(e) => set("priceCents", e.target.value)}
                    aria-invalid={!!errorFor("priceCents")}
                    placeholder="e.g. 4900"
                    suffix="cents"
                  />
                </Field>

                <div className="rounded-lg border border-[var(--av2-border)] p-4">
                  <Switch
                    checked={form.isRecurring}
                    onChange={(v) => set("isRecurring", v)}
                    label="Recurring subscription"
                    describedBy="plan-recurring-hint"
                  />
                  <p id="plan-recurring-hint" className="mt-2 text-xs text-[var(--av2-text-2)]">
                    {form.isRecurring
                      ? "Stripe subscription mode — charged monthly, renews automatically."
                      : "One-time top-up pack — single charge, tokens credited once. Use a Stripe one-time price."}
                  </p>
                </div>

                <Field
                  label="Stripe product ID (optional)"
                  htmlFor="plan-stripe-product-id"
                  hint="Starts with prod_"
                >
                  <TextInput
                    id="plan-stripe-product-id"
                    type="text"
                    value={form.stripeProductId}
                    onChange={(e) => set("stripeProductId", e.target.value)}
                    placeholder="e.g. prod_123..."
                    className="font-mono"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label="Stripe price ID (optional)"
                  htmlFor="plan-stripe-price-id"
                  hint="Starts with price_"
                >
                  <TextInput
                    id="plan-stripe-price-id"
                    type="text"
                    value={form.stripePriceId}
                    onChange={(e) => set("stripePriceId", e.target.value)}
                    placeholder="e.g. price_123..."
                    className="font-mono"
                    spellCheck={false}
                  />
                </Field>
              </div>
            </TabPanel>
          )}

          {tab === "card" && (
            <TabPanel idPrefix={tabIds} value="card">
              <p className="mb-5 text-sm text-[var(--av2-text-2)]">
                Copy shown to unauthenticated visitors on the pricing card. All fields optional —
                blank = sensible fallback.
              </p>
              <div className="space-y-5">
                <Field label="Tagline" htmlFor="plan-tagline">
                  <TextInput
                    id="plan-tagline"
                    type="text"
                    value={form.tagline}
                    onChange={(e) => set("tagline", e.target.value)}
                    placeholder="Best for startups and solo founders"
                  />
                </Field>

                <Field label="Feature bullets" htmlFor="plan-features" hint="One per line, max 12.">
                  <TextArea
                    id="plan-features"
                    value={form.featuresText}
                    onChange={(e) => set("featuresText", e.target.value)}
                    rows={4}
                    placeholder={
                      "1 active creative request at a time\nUnlimited revisions & brand asset storage\nDelivery in 2 to 3 business days per task"
                    }
                  />
                </Field>

                <Field
                  label="CTA label"
                  htmlFor="plan-display-cta-label"
                  hint="Overrides the default button label."
                >
                  <TextInput
                    id="plan-display-cta-label"
                    type="text"
                    value={form.displayCtaLabel}
                    onChange={(e) => set("displayCtaLabel", e.target.value)}
                    placeholder="GET STARTED"
                  />
                </Field>

                <Field label="Tip line below CTA" htmlFor="plan-display-subtitle">
                  <TextInput
                    id="plan-display-subtitle"
                    type="text"
                    value={form.displaySubtitle}
                    onChange={(e) => set("displaySubtitle", e.target.value)}
                    placeholder='"Pause or cancel anytime."'
                  />
                </Field>

                <Field
                  label="Display order"
                  htmlFor="plan-display-order"
                  hint="0 = leftmost; ties broken by price ascending."
                  error={errorFor("displayOrder")}
                >
                  <TextInput
                    id="plan-display-order"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.displayOrder}
                    onChange={(e) => set("displayOrder", e.target.value)}
                    aria-invalid={!!errorFor("displayOrder")}
                    placeholder="e.g. 0"
                  />
                </Field>

                <PanelSection title="Preview">
                  <p className="mb-3 text-xs text-[var(--av2-text-2)]">
                    Rough preview from the fields above; blank fields fall back to defaults on the
                    live site.
                  </p>
                  <div className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-5">
                    <p className="text-lg font-semibold">{form.name.trim() || "Plan name"}</p>
                    {form.tagline.trim() && (
                      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                        {form.tagline.trim()}
                      </p>
                    )}
                    <p className="mt-3 text-2xl font-bold tabular-nums">
                      {previewPrice}
                      {previewPrice !== DASH && (
                        <span className="ml-1 text-sm font-medium text-[var(--av2-text-2)]">
                          {form.isRecurring ? "/ month" : "one-time"}
                        </span>
                      )}
                    </p>
                    {featureLines.length > 0 && (
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {featureLines.slice(0, 12).map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <IconCheck />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-4 flex h-10 items-center justify-center rounded-lg bg-[var(--av2-text)] text-sm font-semibold text-[var(--av2-surface)]">
                      {form.displayCtaLabel.trim() || "Get started"}
                    </div>
                    {form.displaySubtitle.trim() && (
                      <p className="mt-2 text-center text-xs text-[var(--av2-text-2)]">
                        {form.displaySubtitle.trim()}
                      </p>
                    )}
                  </div>
                </PanelSection>
              </div>
            </TabPanel>
          )}
        </div>
      </DetailPanel>
    </form>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Plans"
        description="Configure subscription plans with monthly tokens, pricing and Stripe mapping."
        actions={
          <Button variant="primary" onClick={handleNewPlan}>
            <IconPlus />
            New plan
          </Button>
        }
      />

      <OwnerOnlyNote action="create, edit, or delete plans" />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Error">
            {error}
          </Callout>
        </div>
      )}

      <div className="mb-6 grid gap-6 sm:grid-cols-3">
        <KpiCard
          icon={<IconDocument />}
          tone="lavender"
          label="Total plans"
          value={loading && !data ? DASH : fmt(data ? plans.length : null)}
          hint="All configured plans"
        />
        <KpiCard
          icon={<IconCheckCircle />}
          tone="peach"
          label="Active"
          value={loading && !data ? DASH : fmt(data ? activeCount : null)}
          hint="Available for assignment"
        />
        <KpiCard
          icon={<IconCoins />}
          tone="green"
          label="Monthly tokens"
          value={loading && !data ? DASH : fmt(data ? totalMonthlyTokens : null)}
          hint="Sum across all plan allowances"
        />
      </div>

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <CardTitle>Plan catalogue</CardTitle>
            <div className="mt-4">
              <FilterBar>
                <SearchInput
                  className="min-w-[200px] flex-1"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search plans"
                  label="Search plans by name or Stripe ID"
                />
                <div className="w-full sm:w-40">
                  <Select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>
              </FilterBar>
            </div>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading plans…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconCatalog width={28} height={28} />}
                title="No plans defined yet"
                description="Create the first subscription plan with the New plan button."
              />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No plans match these filters"
                description="Try a different search or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Plans">
              <thead>
                <tr>
                  <Th>Plan</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Companies</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((p) => (
                  <Tr
                    key={p.id}
                    selected={selected?.id === p.id}
                    onSelect={() => handleClickPlan(p)}
                    label={`${p.name}, ${fmt(p.monthlyTokens)} tokens`}
                  >
                    <Td>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-[var(--av2-text-2)]">
                        {p.isRecurring ? "Recurring" : "One-time pack"}
                        {" · "}
                        {p.stripePriceId ? "Stripe linked" : "No Stripe price"}
                      </div>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {fmt(p.monthlyTokens)}
                      <span className="ml-1 text-xs text-[var(--av2-text-2)]">tokens</span>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {formatPrice(p.priceCents)}
                      {p.priceCents != null && (
                        <span className="ml-1 text-xs text-[var(--av2-text-2)]">
                          {p.isRecurring ? "/ month" : "once"}
                        </span>
                      )}
                    </Td>
                    <Td align="right">{fmt(p.attachedCompanies)}</Td>
                    <Td>
                      {p.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {data && plans.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                {fmt(filteredPlans.length)} of {fmt(plans.length)}{" "}
                {plural(plans.length, "plan", "plans")}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <span>Select a plan to edit it.</span>
              )}
            </TableFooter>
          )}
        </Card>
      </SplitView>
    </>
  );
}
