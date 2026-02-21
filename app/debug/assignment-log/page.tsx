// -----------------------------------------------------------------------------
// @file: app/debug/assignment-log/page.tsx
// @purpose: Internal debug view for ticket assignment logs (auto-assign, fallback, etc.)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";

function formatTicketCode(args: {
  projectCode: string | null;
  companyTicketNumber: number | null;
  ticketId: string;
}) {
  const { projectCode, companyTicketNumber, ticketId } = args;

  if (projectCode && companyTicketNumber != null) {
    return `${projectCode}-${companyTicketNumber}`;
  }

  if (companyTicketNumber != null) {
    return `#${companyTicketNumber}`;
  }

  return ticketId.slice(0, 8);
}

function formatStatusLabel(status: TicketStatus) {
  switch (status) {
    case "TODO":
      return "To do";
    case "IN_PROGRESS":
      return "In progress";
    case "IN_REVIEW":
      return "In review";
    case "DONE":
      return "Done";
    default:
      return status;
  }
}

function formatPriorityLabel(priority: TicketPriority) {
  switch (priority) {
    case "LOW":
      return "Low";
    case "MEDIUM":
      return "Medium";
    case "HIGH":
      return "High";
    case "URGENT":
      return "Urgent";
    default:
      return priority;
  }
}

function reasonBadgeVariant(reason: string): BadgeVariant {
  switch (reason) {
    case "AUTO_ASSIGN":
      return "info";
    case "FALLBACK":
      return "warning";
    case "REBALANCE":
      return "primary";
    default:
      return "neutral";
  }
}

function formatDateTime(value: Date) {
  // Basit, okunabilir bir tarih-saat formatı
  return value.toLocaleString();
}

export default async function AssignmentLogDebugPage() {
  const user = await getCurrentUserOrThrow();

  // Only global admins/owners can access this debug view
  if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
    return (
      <div className="min-h-screen bg-[var(--bb-bg-card)] px-6 py-10 text-[var(--bb-secondary)]">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Assignment log
          </h1>
          <p className="mt-2 text-sm text-[var(--bb-text-tertiary)]">
            This page is only available to site owners and admins.
          </p>
          <InlineAlert variant="error" className="mt-4">
            You don&apos;t have permission to view ticket assignment logs.
          </InlineAlert>
        </div>
      </div>
    );
  }

  const logs = await prisma.ticketAssignmentLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          companyTicketNumber: true,
          project: {
            select: {
              code: true,
            },
          },
          company: {
            select: {
              name: true,
            },
          },
        },
      },
      creative: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] px-6 py-10 text-[var(--bb-secondary)]">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">
              Debug panel
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Ticket assignment log
            </h1>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Last 50 assignment events across all workspaces: auto-assign,
              fallback and future strategies.
            </p>
          </div>
          <div className="rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)]">
            Showing {logs.length} events
          </div>
        </header>

        {/* Empty state */}
        {logs.length === 0 && (
          <EmptyState title="No assignment events yet." description="Once customers start creating tickets and the auto-assign engine runs, events will appear here for debugging." />
        )}

        {/* Log table */}
        {logs.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm">
            <div className="border-b border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--bb-text-tertiary)]">
              Assignment events
            </div>
            <div className="divide-y divide-[var(--bb-border-subtle)] text-xs">
              {logs.map((log) => {
                const ticket = log.ticket;
                const creative = log.creative;

                const code = ticket
                  ? formatTicketCode({
                      projectCode: ticket.project?.code ?? null,
                      companyTicketNumber:
                        ticket.companyTicketNumber ?? null,
                      ticketId: ticket.id,
                    })
                  : log.ticketId;

                const companyName =
                  ticket?.company?.name ?? "Unknown company";

                const reason = String(log.reason ?? "UNKNOWN");

                let metadataPreview = "";
                try {
                  if (log.metadata) {
                    const raw = log.metadata as any;
                    metadataPreview = JSON.stringify(raw, null, 0);
                    if (metadataPreview.length > 120) {
                      metadataPreview =
                        metadataPreview.slice(0, 117) + "...";
                    }
                  }
                } catch {
                  metadataPreview = "[unreadable metadata]";
                }

                return (
                  <div
                    key={log.id}
                    className="flex flex-col gap-1 px-4 py-2.5 md:flex-row md:items-start md:gap-3"
                  >
                    {/* Left column: time + reason */}
                    <div className="w-full md:w-40">
                      <p className="text-[11px] font-medium text-[var(--bb-secondary)]">
                        {formatDateTime(log.createdAt)}
                      </p>
                      <p className="mt-1">
                        <Badge variant={reasonBadgeVariant(reason)}>
                          {reason}
                        </Badge>
                      </p>
                    </div>

                    {/* Middle column: ticket info */}
                    <div className="flex-1">
                      <p className="text-[11px] font-medium text-[var(--bb-secondary)]">
                        {code} ·{" "}
                        <span className="text-[var(--bb-text-secondary)]">
                          {ticket?.title ?? "Unknown ticket"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                        {companyName}
                      </p>
                      {ticket && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--bb-text-secondary)]">
                          <span className="inline-flex items-center rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5">
                            Status:{" "}
                            <span className="ml-1 font-medium text-[var(--bb-secondary)]">
                              {formatStatusLabel(ticket.status)}
                            </span>
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[var(--bb-warning-bg)] px-2 py-0.5">
                            Priority:{" "}
                            <span className="ml-1 font-medium text-[var(--bb-warning-text)]">
                              {formatPriorityLabel(ticket.priority)}
                            </span>
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Right column: creative + metadata */}
                    <div className="w-full md:w-64">
                      <p className="text-[11px] font-medium text-[var(--bb-secondary)]">
                        {creative ? (
                          <>
                            Assigned to{" "}
                            <span className="font-semibold">
                              {creative.name || creative.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--bb-danger-text)]">
                            Fallback / unassigned
                          </span>
                        )}
                      </p>
                      {creative && (
                        <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                          {creative.email}
                        </p>
                      )}
                      {metadataPreview && (
                        <p className="mt-1 text-[10px] text-[var(--bb-text-secondary)]">
                          <span className="font-medium text-[var(--bb-secondary)]">
                            Metadata:
                          </span>{" "}
                          <span className="font-mono">
                            {metadataPreview}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
