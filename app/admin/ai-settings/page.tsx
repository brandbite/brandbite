"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
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

export default function AdminAiSettingsPage() {
  const [tools, setTools] = useState<ToolConfig[]>([]);
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

  const updateTool = async (toolType: string, updates: Partial<ToolConfig>) => {
    setSaving(toolType);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/ai/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolType, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setTools((prev) => prev.map((t) => (t.toolType === toolType ? { ...t, ...data.tool } : t)));
      setSuccess(`${data.tool.label} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bb-border)] border-t-[var(--bb-text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
          Admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
          AI Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--bb-text-muted)]">
          Configure AI tools, token costs, and rate limits.
        </p>
      </div>

      <OwnerOnlyBanner action="change token costs or rate limits (admins can still enable or disable tools)" />

      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      {success && <InlineAlert variant="success">{success}</InlineAlert>}

      {/* Usage Stats */}
      {usage && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Usage Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <StatCard label="Total Generations" value={usage.totalGenerations} />
            <StatCard label="Last 7 Days" value={usage.last7Days} />
            <StatCard label="Last 30 Days" value={usage.last30Days} />
            <StatCard label="Tokens Consumed" value={usage.totalTokensConsumed} />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span className="text-[11px] text-[var(--bb-text-muted)]">
              Failure rate:{" "}
              <span className="font-semibold text-[var(--bb-secondary)]">{usage.failureRate}</span>
            </span>
            {usage.byToolType.map((t) => (
              <span key={t.toolType} className="text-[11px] text-[var(--bb-text-muted)]">
                {t.toolType.replace(/_/g, " ").toLowerCase()}:{" "}
                <span className="font-semibold text-[var(--bb-secondary)]">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Tool Configs */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
          Tool Configuration
        </h2>
        <div className="space-y-4">
          {tools.map((tool) => (
            <ToolConfigCard
              key={tool.toolType}
              tool={tool}
              saving={saving === tool.toolType}
              onUpdate={(updates) => updateTool(tool.toolType, updates)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[var(--bb-secondary)]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function ToolConfigCard({
  tool,
  saving,
  onUpdate,
}: {
  tool: ToolConfig;
  saving: boolean;
  onUpdate: (updates: Partial<ToolConfig>) => void;
}) {
  const [tokenCost, setTokenCost] = useState(tool.tokenCost);
  const [rateLimit, setRateLimit] = useState(tool.rateLimit);

  const hasChanges = tokenCost !== tool.tokenCost || rateLimit !== tool.rateLimit;

  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">{tool.label}</h3>
          <Badge variant={tool.enabled ? "success" : "neutral"}>
            {tool.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <Button
          variant={tool.enabled ? "danger" : "primary"}
          size="sm"
          onClick={() => onUpdate({ enabled: !tool.enabled })}
          disabled={saving}
        >
          {tool.enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      <div className="mt-4 flex gap-6">
        <div>
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Token Cost
          </label>
          <FormInput
            type="number"
            min={0}
            value={tokenCost}
            onChange={(e) => setTokenCost(Number(e.target.value))}
            size="sm"
            className="w-24"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Rate Limit / Hour
          </label>
          <FormInput
            type="number"
            min={1}
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            size="sm"
            className="w-24"
          />
        </div>
        {hasChanges && (
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={() => onUpdate({ tokenCost, rateLimit })}
              loading={saving}
              loadingText="Saving..."
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {tool.updatedAt && (
        <p className="mt-2 text-[10px] text-[var(--bb-text-muted)]">
          Last updated: {new Date(tool.updatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
