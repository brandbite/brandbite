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

function formatReasonBadge(reason: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium";
  switch (reason) {
    case "AUTO_ASSIGN":
      return `${base} bg-[#e6f3ff] text-[#19568a] border border-[#c2ddff]`;
    case "FALLBACK":
      return `${base} bg-[#ffe3e0] text-[#b02a1d] border border-[#f2a094]`;
    case "REBALANCE":
      return `${base} bg-[#f7f0ff] text-[#653f9e] border border-[#dbc8ff]`;
    default:
      return `${base} bg-[#f4f4f0] text-[#5c5b5a] border border-[#ddddcf]`;
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
      <div className="min-h-screen bg-[#f5f3f0] px-6 py-10 text-[#424143]">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold tracking-tight">
            Assignment log
          </h1>
          <p className="mt-2 text-sm text-[#9a9892]">
            This page is only available to site owners and admins.
          </p>
          <div className="mt-4 rounded-2xl border border-[#f3c2bf] bg-[#fff5f4] px-4 py-3 text-sm text-[#9b3a32]">
            You don&apos;t have permission to view ticket assignment logs.
          </div>
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
      designer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#f5f3f0] px-6 py-10 text-[#424143]">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Debug panel
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Ticket assignment log
            </h1>
            <p className="mt-1 text-xs text-[#9a9892]">
              Last 50 assignment events across all workspaces: auto-assign,
              fallback and future strategies.
            </p>
          </div>
          <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
            Showing {logs.length} events
          </div>
        </header>

        {/* Empty state */}
        {logs.length === 0 && (
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-6 text-sm text-[#7a7a7a]">
            <p className="font-medium text-[#424143]">
              No assignment events yet
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Once customers start creating tickets and the auto-assign
              engine runs, events will appear here for debugging.
            </p>
          </div>
        )}

        {/* Log table */}
        {logs.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
            <div className="border-b border-[#eeede7] bg-[#f8f6f2] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a8984]">
              Assignment events
            </div>
            <div className="divide-y divide-[#f1f0ea] text-xs">
              {logs.map((log) => {
                const ticket = log.ticket;
                const designer = log.designer;

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
                      <p className="text-[11px] font-medium text-[#424143]">
                        {formatDateTime(log.createdAt)}
                      </p>
                      <p className="mt-1">
                        <span className={formatReasonBadge(reason)}>
                          {reason}
                        </span>
                      </p>
                    </div>

                    {/* Middle column: ticket info */}
                    <div className="flex-1">
                      <p className="text-[11px] font-medium text-[#424143]">
                        {code} ·{" "}
                        <span className="text-[#7a7a7a]">
                          {ticket?.title ?? "Unknown ticket"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#9a9892]">
                        {companyName}
                      </p>
                      {ticket && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#7a7a7a]">
                          <span className="inline-flex items-center rounded-full bg-[#f4f4f0] px-2 py-0.5">
                            Status:{" "}
                            <span className="ml-1 font-medium text-[#424143]">
                              {formatStatusLabel(ticket.status)}
                            </span>
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[#fff4e6] px-2 py-0.5">
                            Priority:{" "}
                            <span className="ml-1 font-medium text-[#9a5b2b]">
                              {formatPriorityLabel(ticket.priority)}
                            </span>
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Right column: designer + metadata */}
                    <div className="w-full md:w-64">
                      <p className="text-[11px] font-medium text-[#424143]">
                        {designer ? (
                          <>
                            Assigned to{" "}
                            <span className="font-semibold">
                              {designer.name || designer.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-[#b02a1d]">
                            Fallback / unassigned
                          </span>
                        )}
                      </p>
                      {designer && (
                        <p className="mt-0.5 text-[10px] text-[#9a9892]">
                          {designer.email}
                        </p>
                      )}
                      {metadataPreview && (
                        <p className="mt-1 text-[10px] text-[#7a7a7a]">
                          <span className="font-medium text-[#424143]">
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
