// -----------------------------------------------------------------------------
// @file: components/tools/all-tools.tsx
// @purpose: The "All tools" page for customers and creatives: every hub tool
//           the role can see, grouped by category, with a search box and a
//           category filter. Built tools are links; the next ones in line
//           show as "Soon" without a link.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { IconSearch } from "@/components/admin/v2/icons";
import { Badge, EmptyState, FilterChips, IconTile, PageHeader } from "@/components/admin/v2/ui";
import { TOOL_ICONS } from "@/components/tools/tool-icons";
import {
  toolGroups,
  toolHref,
  type HubTool,
  type ToolCategory,
  type ToolRole,
} from "@/lib/tools/registry";

type Filter = "all" | ToolCategory;

function matches(tool: HubTool, query: string): boolean {
  if (!query) return true;
  return `${tool.name} ${tool.description}`.toLowerCase().includes(query);
}

function ToolBadges({ tool }: { tool: HubTool }) {
  // A tool that isn't built yet only says so; how it will be paid for can still change.
  if (tool.status !== "live") return <Badge tone="neutral">Soon</Badge>;
  return (
    <>
      {tool.access === "pro" ? <Badge tone="lavender">Pro</Badge> : null}
      {tool.access === "tokens" ? <Badge tone="neutral">Uses tokens</Badge> : null}
      {tool.inRequest ? <Badge tone="neutral">In requests</Badge> : null}
    </>
  );
}

export function ToolCard({ tool, role }: { tool: HubTool; role: ToolRole }) {
  const Icon = TOOL_ICONS[tool.icon];
  const href = toolHref(tool, role);
  const body = (
    <>
      <IconTile tone={href ? "peach" : "neutral"} size={44}>
        <Icon width={22} height={22} />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
          {tool.name}
          <ToolBadges tool={tool} />
        </span>
        <span className="mt-0.5 block text-sm text-[var(--av2-text-2)]">{tool.description}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <li className="flex items-start gap-3.5 rounded-2xl border border-dashed border-[var(--av2-border)] p-4">
        {body}
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="flex h-full items-start gap-3.5 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4 transition-colors hover:border-[var(--av2-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
      >
        {body}
      </Link>
    </li>
  );
}

export function AllTools({ role }: { role: ToolRole }) {
  const groups = useMemo(() => toolGroups(role), [role]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const needle = query.trim().toLowerCase();
  const shown = groups
    .filter((group) => filter === "all" || group.category.id === filter)
    .map((group) => ({ ...group, tools: group.tools.filter((tool) => matches(tool, needle)) }))
    .filter((group) => group.tools.length > 0);

  return (
    <>
      <PageHeader title="Tools" description="Everything you can do in brandbite, in one place." />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <label className="flex h-11 max-w-md min-w-[240px] flex-1 items-center gap-2.5 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3.5 focus-within:ring-2 focus-within:ring-[var(--av2-accent)]">
          <IconSearch width={18} height={18} className="shrink-0 text-[var(--av2-text-2)]" />
          <span className="sr-only">Find a tool</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a tool"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--av2-text-2)]"
          />
        </label>
        <FilterChips<Filter>
          label="Filter tools by category"
          options={[
            { value: "all", label: "All" },
            ...groups.map((group) => ({ value: group.category.id, label: group.category.label })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="No tool matches that"
          description="Try a different word, or clear the search to see every tool."
        />
      ) : (
        <div className="space-y-8">
          {shown.map((group) => (
            <section key={group.category.id} aria-labelledby={`tools-${group.category.id}`}>
              <h2 id={`tools-${group.category.id}`} className="text-xl leading-7 font-semibold">
                {group.category.label}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{group.category.note}</p>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} role={role} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
