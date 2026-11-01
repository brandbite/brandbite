// -----------------------------------------------------------------------------
// @file: app/admin/ai-settings/page.tsx
// @purpose: Admin AI tool configuration — availability, token cost and hourly
//           rate limit per tool, plus usage KPIs.
//
//           Admin design language v1: usage KPIs on top, then the six tools in
//           one editable comparison table with a single SaveBar. The API still
//           saves one tool per PATCH, so "Save changes" walks the changed rows
//           in order and sends the same payloads as the old per-card buttons:
//             - availability: { toolType, enabled }            (admins + owner)
//             - pricing:      { toolType, tokenCost, rateLimit } (owner only)
//           Keeping the two PATCHes separate matters: the route 403s the whole
//           request when a SITE_ADMIN sends pricing fields, so bundling them
//           would block an admin's on/off change too.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState, type SVGProps } from "react";

import {
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  KpiCard,
  KpiGrid,
  PageHeader,
  SaveBar,
  Skeleton,
  Switch,
  Table,
  Td,
  TextInput,
  Th,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconClock, IconCoins } from "@/components/admin/v2/icons";
import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";

type ToolConfig = {
  toolType: string;
  label: string;
  enabled: boolean;
  tokenCost: number;
  rateLimit: number;
  updatedAt: string | null;
};

type UsageStats = {
  totalGenerations: number;
  last30Days: number;
  last7Days: number;
  failedCount: number;
  failureRate: string;
  totalTokensConsumed: number;
  byToolType: { toolType: string; count: number }[];
};

/** Editable row state. Numbers stay strings so a cleared input isn't "0". */
type Draft = { enabled: boolean; tokenCost: string; rateLimit: string };

type RowErrors = { tokenCost?: string; rateLimit?: string };

const toDraft = (t: ToolConfig): Draft => ({
  enabled: t.enabled,
  tokenCost: String(t.tokenCost),
  rateLimit: String(t.rateLimit),
});

const isWhole = (v: string) => v.trim() !== "" && Number.isInteger(Number(v));

/** Mirrors what the PATCH route accepts (tokenCost >= 0, rateLimit >= 1). */
function validateRow(d: Draft): RowErrors {
  const e: RowErrors = {};
  if (!isWhole(d.tokenCost) || Number(d.tokenCost) < 0) e.tokenCost = "Enter 0 or more.";
  if (!isWhole(d.rateLimit) || Number(d.rateLimit) < 1) e.rateLimit = "Enter 1 or more.";
  return e;
}

function rowChanges(t: ToolConfig, d: Draft | undefined) {
  if (!d) return { enabled: false, pricing: false };
  return {
    enabled: d.enabled !== t.enabled,
    pricing: Number(d.tokenCost) !== t.tokenCost || Number(d.rateLimit) !== t.rateLimit,
  };
}

// ---------------------------------------------------------------------------
// Page-local glyphs (one per tool type + KPI icons the shared set lacks)
// ---------------------------------------------------------------------------

const svgBase = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type Glyph = (p: SVGProps<SVGSVGElement>) => React.JSX.Element;

const IconImage: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.5-4.5L7 19.5" />
  </svg>
);
const IconCrop: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M6.5 2.5v14a1 1 0 0 0 1 1h14" />
    <path d="M2.5 6.5h14a1 1 0 0 1 1 1v14" />
  </svg>
);
const IconType: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
  </svg>
);
const IconSparkle: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z" />
  </svg>
);
const IconBrief: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M14 3.5v5h5M9 13h6M9 16.5h4" />
  </svg>
);
const IconUpscale: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M14 3.5h6.5V10M20.5 3.5 13 11" />
    <path d="M10 20.5H3.5V14M3.5 20.5 11 13" />
  </svg>
);
const IconBolt: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" />
  </svg>
);
const IconBars: Glyph = (p) => (
  <svg {...svgBase} {...p}>
    <path d="M5 20.5v-7M12 20.5v-15M19 20.5v-10" />
  </svg>
);
const IconCheck: Glyph = (p) => (
  <svg {...svgBase} strokeWidth={2} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const TOOL_ICON: Record<
  string,
  { Icon: Glyph; tone: "lavender" | "peach" | "green" | "amber" | "blue" }
> = {
  IMAGE_GENERATION: { Icon: IconImage, tone: "lavender" },
  BACKGROUND_REMOVAL: { Icon: IconCrop, tone: "peach" },
  TEXT_GENERATION: { Icon: IconType, tone: "blue" },
  DESIGN_SUGGESTION: { Icon: IconSparkle, tone: "amber" },
  BRIEF_PARSING: { Icon: IconBrief, tone: "green" },
  UPSCALE_IMAGE: { Icon: IconUpscale, tone: "lavender" },
};

const TILE: Record<string, string> = {
  lavender: "bg-[var(--av2-lavender-bg)] text-[var(--av2-text)]",
  peach: "bg-[var(--av2-selected)] text-[var(--av2-link)]",
  green: "bg-[var(--av2-success-bg)] text-[var(--av2-text)]",
  amber: "bg-[var(--av2-attention-from)] text-[var(--av2-link)]",
  blue: "bg-[var(--av2-bg)] text-[var(--av2-text)]",
};

function ToolIcon({ toolType }: { toolType: string }) {
  const meta = TOOL_ICON[toolType] ?? { Icon: IconSparkle, tone: "lavender" as const };
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TILE[meta.tone]}`}
    >
      <meta.Icon />
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-5 w-[26rem] max-w-full" />
      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-16 rounded-xl" />
      <Skeleton className="mt-6 h-[460px] rounded-2xl" />
      <p className="sr-only" role="status">
        Loading AI settings…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAiSettingsPage() {
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [configRes, usageRes] = await Promise.all([
        fetch("/api/admin/ai/config"),
        fetch("/api/admin/ai/usage"),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        setTools(data.tools);
        setDrafts(
          Object.fromEntries((data.tools as ToolConfig[]).map((t) => [t.toolType, toDraft(t)])),
        );
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.usage);
      }
    } catch {
      setError("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** One PATCH per call — same endpoint and payload shape as before. */
  const updateTool = async (toolType: string, updates: Partial<ToolConfig>) => {
    const res = await fetch("/api/admin/ai/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolType, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");

    const tool = data.tool as ToolConfig;
    setTools((prev) => prev.map((t) => (t.toolType === toolType ? { ...t, ...tool } : t)));
    return tool;
  };

  const patchDraft = (toolType: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [toolType]: { ...prev[toolType], ...patch } }));

  // --- dirty state ----------------------------------------------------------
  const changedTools = useMemo(
    () =>
      tools.filter((t) => {
        const c = rowChanges(t, drafts[t.toolType]);
        return c.enabled || c.pricing;
      }),
    [tools, drafts],
  );
  const errors = useMemo(() => {
    const out: Record<string, RowErrors> = {};
    for (const t of tools) {
      const d = drafts[t.toolType];
      if (!d) continue;
      const e = validateRow(d);
      if (e.tokenCost || e.rateLimit) out[t.toolType] = e;
    }
    return out;
  }, [tools, drafts]);
  const errorCount = Object.keys(errors).length;
  const dirty = changedTools.length > 0;

  const handleSave = async () => {
    if (!dirty || errorCount > 0) return;
    setError("");
    setSuccess("");
    const saved: string[] = [];
    try {
      // Sequential on purpose: each tool is its own PATCH (and its own audit
      // entry); stop at the first failure so a 403 isn't repeated per row.
      for (const t of changedTools) {
        const d = drafts[t.toolType];
        const c = rowChanges(t, d);
        setSaving(t.toolType);
        let latest: ToolConfig | null = null;
        if (c.enabled) latest = await updateTool(t.toolType, { enabled: d.enabled });
        if (c.pricing) {
          latest = await updateTool(t.toolType, {
            tokenCost: Number(d.tokenCost),
            rateLimit: Number(d.rateLimit),
          });
        }
        if (latest) {
          const next = latest;
          patchDraft(t.toolType, {
            ...(c.enabled ? { enabled: next.enabled } : {}),
            ...(c.pricing
              ? { tokenCost: String(next.tokenCost), rateLimit: String(next.rateLimit) }
              : {}),
          });
          saved.push(next.label);
        }
      }
      setSuccess(
        saved.length === 1
          ? `${saved[0]} updated.`
          : `${saved.length} tools updated: ${saved.join(", ")}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      setError(saved.length > 0 ? `${msg} (Saved before the error: ${saved.join(", ")}.)` : msg);
    } finally {
      setSaving(null);
    }
  };

  const handleReset = () => {
    setDrafts(Object.fromEntries(tools.map((t) => [t.toolType, toDraft(t)])));
  };

  if (loading) return <LoadingSkeleton />;

  // --- derived display values ----------------------------------------------
  const usageByTool = new Map((usage?.byToolType ?? []).map((u) => [u.toolType, u.count]));
  const labelFor = (toolType: string) =>
    tools.find((t) => t.toolType === toolType)?.label ?? toolType.replace(/_/g, " ").toLowerCase();
  const isSaving = saving !== null;

  const saveStatus = (() => {
    if (errorCount > 0) {
      const names = Object.keys(errors).map(labelFor);
      return (
        <span className="text-[var(--av2-error-text)]">
          Fix {errorCount} {plural(errorCount, "tool", "tools")} before saving: {names.join(", ")}.
        </span>
      );
    }
    if (isSaving) return `Saving ${labelFor(saving)}…`;
    if (dirty) {
      return (
        <>
          <span className="font-semibold text-[var(--av2-text)]">
            {changedTools.length} {plural(changedTools.length, "tool", "tools")} changed:
          </span>{" "}
          {changedTools.map((t) => t.label).join(", ")}.
        </>
      );
    }
    return (
      <span className="inline-flex items-center gap-2">
        <IconCheck width={16} height={16} />
        No unsaved changes
      </span>
    );
  })();

  return (
    <div>
      <PageHeader
        title="AI settings"
        description="Control tool availability, token costs and hourly limits."
      />

      <OwnerOnlyBanner action="change token costs or rate limits (admins can still enable or disable tools)" />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}
      {success && (
        <div className="mb-6" role="status">
          <Callout tone="success" title={success} />
        </div>
      )}

      {/* ---------------- Usage ---------------- */}
      {usage ? (
        <>
          <KpiGrid>
            <KpiCard
              icon={<IconBolt width={22} height={22} />}
              tone="lavender"
              label="Total generations"
              value={fmt(usage.totalGenerations)}
              hint="All time"
            />
            <KpiCard
              icon={<IconBars width={22} height={22} />}
              tone="peach"
              label="Last 7 days"
              value={fmt(usage.last7Days)}
            />
            <KpiCard
              icon={<IconClock width={22} height={22} />}
              tone="blue"
              label="Last 30 days"
              value={fmt(usage.last30Days)}
            />
            <KpiCard
              icon={<IconCoins width={22} height={22} />}
              tone="green"
              label="Tokens consumed"
              value={fmt(usage.totalTokensConsumed)}
              hint="All time"
            />
          </KpiGrid>

          <div className="mb-6">
            {usage.totalGenerations === 0 ? (
              <Callout tone="info" title={`Failure rate: ${DASH}`}>
                No generations yet, so there is no failure rate to report.
              </Callout>
            ) : usage.failedCount > 0 ? (
              <Callout
                tone="warning"
                title={`${fmt(usage.failedCount)} of ${fmt(usage.totalGenerations)} ${plural(usage.totalGenerations, "generation", "generations")} failed`}
              >
                All-time failure rate {usage.failureRate}, based on {fmt(usage.totalGenerations)}{" "}
                {plural(usage.totalGenerations, "generation", "generations")}.
              </Callout>
            ) : (
              <Callout tone="success" title="No failed generations">
                All-time failure rate {usage.failureRate}, based on {fmt(usage.totalGenerations)}{" "}
                {plural(usage.totalGenerations, "generation", "generations")}.
              </Callout>
            )}
          </div>
        </>
      ) : (
        <div className="mb-6">
          <Callout tone="info" title="Usage unavailable">
            AI usage stats couldn&apos;t be loaded. Tool settings below still work.
          </Callout>
        </div>
      )}

      {/* ---------------- Tool configuration ---------------- */}
      <Card padding="none">
        <div className="px-6 pt-6 pb-4">
          <CardTitle
            description="Token cost is charged per request. Rate limits are measured per hour."
            action={
              <span className="pt-1 text-sm whitespace-nowrap text-[var(--av2-text-2)]">
                {fmt(tools.length)} {plural(tools.length, "tool", "tools")}
              </span>
            }
          >
            Tool configuration
          </CardTitle>
        </div>

        {tools.length === 0 ? (
          <div className="border-t border-[var(--av2-border)] px-6 py-10 text-center text-sm text-[var(--av2-text-2)]">
            No AI tools could be loaded.
          </div>
        ) : (
          <Table label="AI tool configuration">
            <thead className="bg-[var(--av2-bg)]">
              <tr>
                <Th>Tool</Th>
                <Th>Availability</Th>
                <Th>Token cost</Th>
                <Th>Rate limit / hour</Th>
                <Th align="right">Generations (all time)</Th>
                <Th>Last updated</Th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const d = drafts[tool.toolType] ?? toDraft(tool);
                const c = rowChanges(tool, d);
                const e = errors[tool.toolType] ?? {};
                const rowSaving = saving === tool.toolType;
                const labelId = `ai-tool-${tool.toolType}`;
                return (
                  <tr
                    key={tool.toolType}
                    className={`border-b border-[var(--av2-border)] last:border-b-0 ${
                      c.enabled || c.pricing
                        ? "bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                        : ""
                    }`}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <ToolIcon toolType={tool.toolType} />
                        <div className="min-w-0">
                          <p id={labelId} className="font-semibold whitespace-nowrap">
                            {tool.label}
                          </p>
                          {(c.enabled || c.pricing) && (
                            <p className="text-xs text-[var(--av2-link)]">
                              {rowSaving ? "Saving…" : "Unsaved"}
                            </p>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={d.enabled}
                          onChange={(v) => patchDraft(tool.toolType, { enabled: v })}
                          labelledBy={labelId}
                          describedBy={`${labelId}-state`}
                          disabled={isSaving}
                        />
                        <span id={`${labelId}-state`} className="text-sm whitespace-nowrap">
                          {d.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="w-36">
                        <TextInput
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          suffix="tokens"
                          aria-label={`${tool.label} token cost`}
                          aria-invalid={Boolean(e.tokenCost)}
                          aria-describedby={e.tokenCost ? `${labelId}-cost-err` : undefined}
                          value={d.tokenCost}
                          disabled={isSaving}
                          onChange={(ev) =>
                            patchDraft(tool.toolType, { tokenCost: ev.target.value })
                          }
                        />
                        {e.tokenCost && (
                          <p
                            id={`${labelId}-cost-err`}
                            className="mt-1 text-xs text-[var(--av2-error-text)]"
                          >
                            {e.tokenCost}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="w-36">
                        <TextInput
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          suffix="/ hour"
                          aria-label={`${tool.label} rate limit per hour`}
                          aria-invalid={Boolean(e.rateLimit)}
                          aria-describedby={e.rateLimit ? `${labelId}-rate-err` : undefined}
                          value={d.rateLimit}
                          disabled={isSaving}
                          onChange={(ev) =>
                            patchDraft(tool.toolType, { rateLimit: ev.target.value })
                          }
                        />
                        {e.rateLimit && (
                          <p
                            id={`${labelId}-rate-err`}
                            className="mt-1 text-xs text-[var(--av2-error-text)]"
                          >
                            {e.rateLimit}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td align="right">{usage ? fmt(usageByTool.get(tool.toolType) ?? 0) : DASH}</Td>
                    <Td className="whitespace-nowrap text-[var(--av2-text-2)]">
                      {tool.updatedAt ? (
                        new Date(tool.updatedAt).toLocaleDateString()
                      ) : (
                        <span title="Never saved — using the built-in defaults">
                          Never <span className="text-xs">(defaults)</span>
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <div className="border-t border-[var(--av2-border)] px-6 py-4">
          <SaveBar dirty={dirty} status={saveStatus}>
            <Button variant="secondary" onClick={handleReset} disabled={!dirty || isSaving}>
              Reset changes
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={!dirty || isSaving || errorCount > 0}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </SaveBar>
        </div>
      </Card>
    </div>
  );
}
