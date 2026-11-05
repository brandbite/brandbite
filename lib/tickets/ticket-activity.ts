// -----------------------------------------------------------------------------
// @file: lib/tickets/ticket-activity.ts
// @purpose: Build a ticket's Activity timeline for one viewer. Older tickets get
//           what existing tables recorded; TicketEvent adds status, assignment
//           and detail changes from the day it shipped.
//
//           Customers aren't told which creative is assigned, and neither side
//           sees admin names. Message bodies and token amounts stay out: they
//           have their own tabs and pages.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { isSiteAdminRole, type AppUserRole } from "@/lib/roles";
import type { TicketDetailField } from "@/lib/tickets/ticket-events";

/** TicketEvent started recording on this day. Older tickets show a partial-history note. */
export const ACTIVITY_TRACKING_SINCE = new Date("2026-11-06T00:00:00Z");

export type ActivityViewer = { kind: "customer" | "creative" | "admin"; userId: string };

export type ActivityItem = {
  id: string;
  at: string;
  /** Who did it, ready to display: "You", "Ada Lane", "Your creative". */
  actor: string;
  /** Continues the sentence after the actor: "moved this request to Done". */
  summary: string;
};

const NOUN = { customer: "request", creative: "job", admin: "ticket" } as const;

const STATUS_LABELS: Record<string, string> = {
  TODO: "Backlog",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELED: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const FIELD_LABELS: Record<TicketDetailField, string> = {
  title: "title",
  description: "description",
  priority: "priority",
  dueDate: "due date",
  project: "project",
  jobType: "job type",
};

type Person = { id: string; name: string | null; email: string; role: string };

function displayName(person: Person): string {
  return person.name || person.email;
}

function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Null when the ticket doesn't exist. Callers check access before calling. */
export async function buildTicketActivity(ticketId: string, viewer: ActivityViewer) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      createdAt: true,
      createdById: true,
      completedAt: true,
      completedById: true,
      assignmentLogs: { select: { id: true, creativeId: true, createdAt: true } },
      revisions: {
        select: {
          id: true,
          version: true,
          submittedAt: true,
          submittedByCreativeId: true,
          aiGenerationId: true,
          feedbackAt: true,
          feedbackByCustomerId: true,
        },
      },
      events: { select: { id: true, type: true, actorId: true, metadata: true, createdAt: true } },
    },
  });
  if (!ticket) return null;

  const eventCreativeIds = ticket.events
    .filter((e) => e.type === "CREATIVE_CHANGED")
    .map((e) => (e.metadata as { toCreativeId?: string | null } | null)?.toCreativeId);

  const peopleIds = new Set(
    [
      ticket.createdById,
      ticket.completedById,
      ...ticket.assignmentLogs.map((l) => l.creativeId),
      ...ticket.revisions.flatMap((r) => [r.submittedByCreativeId, r.feedbackByCustomerId]),
      ...ticket.events.map((e) => e.actorId),
      ...eventCreativeIds,
    ].filter((id): id is string => !!id),
  );
  const people = await prisma.userAccount.findMany({
    where: { id: { in: [...peopleIds] } },
    select: { id: true, name: true, email: true, role: true },
  });
  const personById = new Map(people.map((p) => [p.id, p]));

  const noun = NOUN[viewer.kind];

  const actorLabel = (userId: string | null | undefined): string => {
    if (userId && userId === viewer.userId) return "You";
    const person = userId ? personById.get(userId) : undefined;
    if (!person) return "brandbite";
    if (viewer.kind === "admin") return displayName(person);
    if (isSiteAdminRole(person.role as AppUserRole)) return "The brandbite team";
    if (person.role === "DESIGNER") {
      return viewer.kind === "customer" ? "Your creative" : "A creative";
    }
    return displayName(person);
  };

  /** The creative in the object of a sentence: "assigned ___". */
  const creativeLabel = (creativeId: string): string => {
    if (viewer.kind === "creative") return creativeId === viewer.userId ? "you" : "a creative";
    if (viewer.kind === "customer") return "a creative";
    const person = personById.get(creativeId);
    return person ? displayName(person) : "a creative";
  };

  const items: (ActivityItem & { sortAt: number })[] = [];
  const push = (id: string, at: Date, actor: string, summary: string) =>
    items.push({ id, at: at.toISOString(), sortAt: at.getTime(), actor, summary });

  push(
    `created-${ticket.id}`,
    ticket.createdAt,
    actorLabel(ticket.createdById),
    `created this ${noun}`,
  );

  for (const log of ticket.assignmentLogs) {
    if (!log.creativeId) continue;
    push(
      `assignment-${log.id}`,
      log.createdAt,
      "brandbite",
      `assigned ${creativeLabel(log.creativeId)}`,
    );
  }

  for (const revision of ticket.revisions) {
    if (revision.aiGenerationId) {
      push(
        `revision-${revision.id}`,
        revision.submittedAt,
        "brandbite AI",
        `generated version ${revision.version}`,
      );
    } else {
      push(
        `revision-${revision.id}`,
        revision.submittedAt,
        actorLabel(revision.submittedByCreativeId),
        `submitted version ${revision.version}`,
      );
    }
    if (revision.feedbackAt) {
      push(
        `feedback-${revision.id}`,
        revision.feedbackAt,
        actorLabel(revision.feedbackByCustomerId),
        `requested changes on version ${revision.version}`,
      );
    }
  }

  if (ticket.completedAt) {
    push(
      `completed-${ticket.id}`,
      ticket.completedAt,
      actorLabel(ticket.completedById),
      `marked this ${noun} as Done`,
    );
  }

  for (const event of ticket.events) {
    const actor = actorLabel(event.actorId);
    const id = `event-${event.id}`;

    if (event.type === "STATUS_CHANGED") {
      const { from, to } = event.metadata as { from: string; to: string };
      push(
        id,
        event.createdAt,
        actor,
        to === "CANCELED"
          ? `cancelled this ${noun}`
          : `moved this ${noun} from ${STATUS_LABELS[from] ?? from} to ${STATUS_LABELS[to] ?? to}`,
      );
    } else if (event.type === "CREATIVE_CHANGED") {
      const { toCreativeId } = event.metadata as { toCreativeId: string | null };
      push(
        id,
        event.createdAt,
        actor,
        toCreativeId ? `assigned ${creativeLabel(toCreativeId)}` : "removed the assigned creative",
      );
    } else {
      const { fields, priority } = event.metadata as {
        fields: TicketDetailField[];
        priority?: { from: string; to: string };
      };
      const parts = fields.map((field) =>
        field === "priority" && priority
          ? `priority (${PRIORITY_LABELS[priority.from] ?? priority.from} to ${PRIORITY_LABELS[priority.to] ?? priority.to})`
          : FIELD_LABELS[field],
      );
      push(id, event.createdAt, actor, `updated the ${listOf(parts)}`);
    }
  }

  // Sorting oldest first, then reversing, keeps "created" last when timestamps tie.
  items.sort((a, b) => a.sortAt - b.sortAt);
  const activity: ActivityItem[] = items
    .reverse()
    .map(({ id, at, actor, summary }) => ({ id, at, actor, summary }));

  return { activity, partialHistory: ticket.createdAt < ACTIVITY_TRACKING_SINCE };
}
