// -----------------------------------------------------------------------------
// @file: lib/ticket-drafts.ts
// @purpose: Saved, unsent requests. A draft spends no tokens, has no ticket number
//           and reaches nobody until it's submitted. Customers see only their own;
//           brandbite admins can see all of them.
// -----------------------------------------------------------------------------

import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const MAX_DRAFT_ATTACHMENTS = 8;

/**
 * Forgiving on purpose: a draft is unfinished, so nothing here is required and
 * nothing here is checked against the catalog. All of that happens on submit.
 */
export const ticketDraftFieldsSchema = z.object({
  title: z.string().max(500).optional().default(""),
  description: z.string().max(200_000).optional().default(""),
  jobTypeId: z.string().max(100).optional().default(""),
  projectId: z.string().max(100).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(10).optional().default(1).catch(1),
  priority: z.string().max(20).optional().default("MEDIUM"),
  dueDate: z.string().max(40).optional().default(""),
  tagIds: z.array(z.string().max(100)).max(20).optional().default([]),
  moodboardId: z.string().max(100).optional().default(""),
  creativeMode: z.string().max(20).optional().default("DESIGNER"),
});

export type TicketDraftFields = z.infer<typeof ticketDraftFieldsSchema>;

export const DRAFT_ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  bytes: true,
} as const;

export type DraftAttachment = {
  id: string;
  originalName: string | null;
  mimeType: string;
  bytes: number;
};

/** What's in the draft for the form, from its stored row. */
export function draftToClient(draft: {
  id: string;
  title: string;
  description: string;
  fields: unknown;
  updatedAt: Date;
  attachments?: DraftAttachment[];
}) {
  const parsed = ticketDraftFieldsSchema.safeParse({
    ...(draft.fields as object),
    title: draft.title,
    description: draft.description,
  });
  return {
    id: draft.id,
    ...(parsed.success ? parsed.data : ticketDraftFieldsSchema.parse({})),
    // Named one by one so storage keys never reach the browser.
    attachments: (draft.attachments ?? []).map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      bytes: a.bytes,
    })),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export type TicketDraftClient = ReturnType<typeof draftToClient>;

/** Splits the fields into their columns: title and brief, then everything else. */
export function draftToRow(fields: TicketDraftFields) {
  const { title, description, ...rest } = fields;
  return { title, description, fields: rest };
}

/**
 * Turns a submitted draft's files into the new request's brief attachments, and
 * removes the draft. The files stay where they are in storage.
 */
export async function moveDraftToTicket(args: {
  draftId: string;
  ticketId: string;
  userId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const attachments = await tx.ticketDraftAttachment.findMany({
      where: { draftId: args.draftId },
    });
    if (attachments.length > 0) {
      await tx.asset.createMany({
        data: attachments.map((a) => ({
          ticketId: args.ticketId,
          kind: "BRIEF_INPUT" as const,
          storageKey: a.storageKey,
          url: a.url,
          mimeType: a.mimeType,
          bytes: a.bytes,
          width: a.width,
          height: a.height,
          originalName: a.originalName,
          createdById: args.userId,
        })),
      });
    }
    await tx.ticketDraft.delete({ where: { id: args.draftId } });
  });
}
