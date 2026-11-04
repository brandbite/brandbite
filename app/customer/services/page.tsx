// -----------------------------------------------------------------------------
// @file: app/customer/services/page.tsx
// @purpose: Customer service catalog: one category at a time, search across the
//           whole catalog, and the selected service's detail. Estimated hours are
//           work effort, never a delivery time.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { IconArrowUpRight, IconClock, IconCoins } from "@/components/admin/v2/icons";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  FilterChips,
  fmt,
  IconTile,
  KeyValueList,
  PageHeader,
  PanelSection,
  plural,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/admin/v2/ui";
import {
  formatTokens,
  ListFooter,
  pageOf,
  useRevealPanel,
} from "@/components/dashboard/money/money-ui";
import {
  canCreateTickets,
  canManageBilling,
  normalizeCompanyRole,
  type CompanyRole,
} from "@/lib/permissions/companyRoles";

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Service = {
  id: string;
  name: string;
  category: string | null;
  categoryIcon: string | null;
  categorySortOrder: number;
  description: string | null;
  tokenCost: number;
  estimatedHours: number | null;
  hasQuantity: boolean;
  quantityLabel: string | null;
  defaultQuantity: number;
};

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
};

function formatEffort(hours: number | null): string {
  return hours == null ? DASH : `~${hours}h`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [roleKnown, setRoleKnown] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { ref: panelRef, reveal } = useRevealPanel();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/customer/services", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json as any)?.error ?? `Request failed (${res.status})`);
        }

        if (!cancelled) {
          setServices(json.services ?? []);
          setCategories(json.categories ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load services.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // The balance and role only add context to the detail panel, so a failure
    // here must not block the catalog.
    const loadContext = async () => {
      try {
        const [tokensRes, settingsRes] = await Promise.all([
          fetch("/api/customer/tokens", { cache: "no-store" }),
          fetch("/api/customer/settings", { cache: "no-store" }),
        ]);
        const [tokensJson, settingsJson] = await Promise.all([
          tokensRes.json().catch(() => null),
          settingsRes.json().catch(() => null),
        ]);
        if (cancelled) return;
        if (tokensRes.ok && typeof tokensJson?.company?.tokenBalance === "number") {
          setBalance(tokensJson.company.tokenBalance);
        }
        if (settingsRes.ok) {
          setCompanyRole(normalizeCompanyRole(settingsJson?.user?.companyRole));
          setRoleKnown(true);
        }
      } catch (err) {
        console.error("[CustomerServices] balance or role load error", err);
      }
    };

    load();
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group services by category, using DB sort order
  const grouped = useMemo(() => {
    // Build a category order map from DB categories
    const catOrderMap = new Map<string, { sortOrder: number; icon: string | null }>();
    for (const cat of categories) {
      catOrderMap.set(cat.name, { sortOrder: cat.sortOrder, icon: cat.icon });
    }

    const map = new Map<string, Service[]>();

    for (const svc of services) {
      const cat = svc.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(svc);
    }

    // Sort by category sort order (from DB), then alphabetically for unknowns
    const result: { category: string; icon: string | null; services: Service[] }[] = [];
    const sortedCats = [...map.keys()].sort((a, b) => {
      const aOrder = catOrderMap.get(a)?.sortOrder ?? 999;
      const bOrder = catOrderMap.get(b)?.sortOrder ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });

    for (const category of sortedCats) {
      const items = map.get(category) ?? [];
      if (items.length > 0) {
        const icon = catOrderMap.get(category)?.icon ?? items[0]?.categoryIcon ?? null;
        result.push({ category, icon, services: items });
      }
    }

    return result;
  }, [services, categories]);

  const activeGroup = grouped.find((g) => g.category === activeCategory) ?? grouped[0] ?? null;
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;

  // Search spans the whole catalog: people rarely know which category holds a service.
  const list = useMemo(() => {
    if (!searching) return activeGroup?.services ?? [];
    return grouped
      .flatMap((g) => g.services)
      .filter((s) =>
        [s.name, s.description ?? "", s.category ?? ""].join(" ").toLowerCase().includes(needle),
      );
  }, [searching, needle, activeGroup, grouped]);

  const paged = pageOf(list, page, PAGE_SIZE);
  // Derived from the visible rows, so the panel always shows a row on this page.
  const selected = paged.rows.find((s) => s.id === selectedId) ?? paged.rows[0] ?? null;

  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    setQuery("");
    setPage(1);
    setSelectedId(null);
  };

  const categoryOptions = grouped.map((g) => ({
    value: g.category,
    label: `${g.icon ? `${g.icon} ` : ""}${g.category}`,
    count: g.services.length,
  }));

  const hideCreate = roleKnown && !canCreateTickets(companyRole);
  const short = selected != null && balance != null && balance < selected.tokenCost;

  return (
    <>
      <PageHeader
        title="Services"
        description="Browse our full service catalog."
        meta={
          !loading && !error ? (
            <>
              {fmt(services.length)} {plural(services.length, "service", "services")} across{" "}
              {fmt(grouped.length)} {plural(grouped.length, "category", "categories")}
            </>
          ) : null
        }
      />

      {error ? (
        <Callout tone="error" title="We couldn't load the services">
          {error}
        </Callout>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading services" className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96" />
        </div>
      ) : services.length === 0 ? (
        <Card>
          <EmptyState
            title="No services available yet"
            description="Services will appear here once they are published."
          />
        </Card>
      ) : (
        <>
          <div className="max-sm:hidden">
            <FilterChips
              label="Service categories"
              options={categoryOptions}
              value={searching ? "" : (activeGroup?.category ?? "")}
              onChange={chooseCategory}
            />
          </div>

          <div className="mt-4 mb-6 grid gap-3 sm:grid-cols-[minmax(0,420px)]">
            <div className="sm:hidden">
              <Select
                aria-label="Service category"
                value={activeGroup?.category ?? ""}
                onChange={(e) => chooseCategory(e.target.value)}
              >
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({o.count})
                  </option>
                ))}
              </Select>
            </div>
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
                setSelectedId(null);
              }}
              placeholder="Search all services"
              label="Search all services"
            />
          </div>

          <SplitView
            panel={
              selected ? (
                <div ref={panelRef} className="scroll-mt-20 xl:contents">
                  <ServiceDetail
                    service={selected}
                    balance={balance}
                    short={short}
                    hideCreate={hideCreate}
                    canAddTokens={canManageBilling(companyRole)}
                  />
                </div>
              ) : null
            }
          >
            <Card padding="none">
              <div className="px-6 pt-6 pb-4">
                <CardTitle
                  description={`${fmt(paged.total)} ${plural(paged.total, "service", "services")}`}
                >
                  {searching
                    ? "Search results"
                    : `${activeGroup?.icon ? `${activeGroup.icon} ` : ""}${activeGroup?.category ?? ""}`}
                </CardTitle>
              </div>

              {paged.total === 0 ? (
                <EmptyState
                  title="No services match your search"
                  description="Try a different word, or pick a category above."
                />
              ) : (
                <>
                  <Table label="Services">
                    <thead>
                      <tr>
                        <Th>Service</Th>
                        <Th>Tokens</Th>
                        <Th className="max-sm:hidden">Estimated effort</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.rows.map((svc) => (
                        <Tr
                          key={svc.id}
                          selected={svc.id === selected?.id}
                          onSelect={() => {
                            setSelectedId(svc.id);
                            reveal();
                          }}
                          label={svc.name}
                        >
                          <Td>
                            <p className="font-semibold">{svc.name}</p>
                            {svc.description ? (
                              <p className="mt-0.5 line-clamp-2 text-[var(--av2-text-2)]">
                                {svc.description}
                              </p>
                            ) : null}
                            {searching && svc.category ? (
                              <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                                {svc.category}
                              </p>
                            ) : null}
                          </Td>
                          <Td className="whitespace-nowrap">
                            <Badge tone="peach">{formatTokens(svc.tokenCost)}</Badge>
                          </Td>
                          <Td className="whitespace-nowrap max-sm:hidden">
                            {formatEffort(svc.estimatedHours)}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                  <ListFooter {...paged} onPage={setPage} />
                </>
              )}
            </Card>
          </SplitView>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Selected service
// ---------------------------------------------------------------------------

function ServiceDetail({
  service,
  balance,
  short,
  hideCreate,
  canAddTokens,
}: {
  service: Service;
  balance: number | null;
  short: boolean;
  hideCreate: boolean;
  canAddTokens: boolean;
}) {
  return (
    <DetailPanel
      title={service.name}
      footer={
        hideCreate ? (
          <p className="text-sm text-[var(--av2-text-2)]">
            Your role can&apos;t create requests. Ask an owner, project manager or member to create
            this one.
          </p>
        ) : (
          <ButtonLink
            href={`/customer/tickets/new?jobTypeId=${service.id}`}
            variant="primary"
            className="w-full"
          >
            Create request
            <IconArrowUpRight />
          </ButtonLink>
        )
      }
    >
      <PanelSection>
        {service.description ? <p className="text-base">{service.description}</p> : null}

        <div className="mt-4 grid gap-4 rounded-xl bg-[var(--av2-bg)] p-4 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile tone="peach" size={40}>
              <IconCoins />
            </IconTile>
            <div className="min-w-0">
              <p className="text-xl leading-7 font-bold tabular-nums">
                {formatTokens(service.tokenCost)}
              </p>
              <p className="text-xs text-[var(--av2-text-2)]">
                {service.hasQuantity ? "Per unit" : "Token cost"}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <IconTile tone="neutral" size={40}>
              <IconClock />
            </IconTile>
            <div className="min-w-0">
              <p className="text-xl leading-7 font-bold tabular-nums">
                {formatEffort(service.estimatedHours)}
              </p>
              <p className="text-xs text-[var(--av2-text-2)]">
                Estimated effort, not a delivery time
              </p>
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection>
        <KeyValueList
          rows={[
            { label: "Company balance", value: formatTokens(balance) },
            ...(service.hasQuantity && service.quantityLabel
              ? [{ label: "Quantity", value: service.quantityLabel }]
              : []),
          ]}
        />
        {short ? (
          <div className="mt-4">
            <Callout
              tone="warning"
              title={`This service needs ${service.hasQuantity ? "at least " : ""}${formatTokens(service.tokenCost)}.`}
              action={
                canAddTokens ? (
                  <ButtonLink href="/customer/settings" variant="secondary">
                    Add tokens
                  </ButtonLink>
                ) : undefined
              }
            >
              {canAddTokens
                ? null
                : "Your owner or billing manager can add tokens to your company balance."}
            </Callout>
          </div>
        ) : null}
      </PanelSection>
    </DetailPanel>
  );
}
