// -----------------------------------------------------------------------------
// @file: lib/email-templates/notification.tsx
// @purpose: The email sent alongside an in-app notification (request
//           assigned, revision ready, files expiring, …), on the shared frame.
//           When the notification is about a request, the main card shows
//           its code, title and key facts (company, service, due date,
//           tokens) in the recipient's role colour.
// -----------------------------------------------------------------------------

import * as React from "react";
import type { NotificationType } from "@prisma/client";

import {
  Actions,
  Body16,
  Card,
  EmailFrame,
  FileRow,
  Notice,
  Tiles,
  Title,
  type EmailRole,
  type IconName,
  type Tile,
} from "./frame";

export type NotificationTicketContext = {
  code: string;
  title: string;
  companyName: string | null;
  serviceName: string | null;
  dueDate: Date | null;
  /** Creative: their payout. Customer and admin: the request's token cost. */
  tokens: number | null;
};

export type NotificationSourceFilesContext = {
  deleteAfter: Date;
  files: { name: string; sizeBytes: number | null }[];
};

export type NotificationEmailProps = {
  baseUrl: string;
  recipientName: string | null;
  recipientRole: EmailRole;
  type: NotificationType;
  heading: string;
  title: string;
  message: string;
  actorName: string | null;
  cta: { href: string; label: string };
  secondary: { href: string; label: string } | null;
  preferencesUrl: string;
  ticket: NotificationTicketContext | null;
  sourceFiles: NotificationSourceFilesContext | null;
};

const ICONS: Partial<Record<NotificationType, IconName>> = {
  WITHDRAWAL_UPDATED: "coins",
  CREATIVE_SCHEDULE_UPDATED: "calendar",
  MOODBOARD_SHARED: "palette",
  MOODBOARD_COMMENT: "message",
  SUPPORT_GUIDE_CHANGED: "file-text",
  SOURCE_FILES_EXPIRING: "file",
  THANKS_RECEIVED: "check",
};

const REASONS: Record<NotificationType, string> = {
  REVISION_SUBMITTED: "a creative delivered work on your request",
  FEEDBACK_SUBMITTED: "there's new feedback on a request you work on",
  TICKET_COMPLETED: "a request you follow was marked done",
  TICKET_ASSIGNED: "a request was assigned to you",
  TICKET_STATUS_CHANGED: "a request you follow changed status",
  PIN_RESOLVED: "a feedback note you left was resolved",
  WITHDRAWAL_UPDATED: "your withdrawal request changed",
  CREATIVE_SCHEDULE_UPDATED: "a creative changed their working hours",
  MOODBOARD_SHARED: "a moodboard was shared with you",
  MOODBOARD_COMMENT: "someone commented on a moodboard you follow",
  SUPPORT_GUIDE_CHANGED: "a Support guide you edited changed in code",
  SOURCE_FILES_EXPIRING: "your request includes source files",
  THANKS_RECEIVED: "a customer thanked you for your work",
};

export function formatEmailDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatFileSize(bytes: number | null): string | undefined {
  if (bytes == null) return undefined;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function ticketTiles(ticket: NotificationTicketContext, role: EmailRole): Tile[] {
  const tiles: Tile[] = [];
  if (role !== "customer" && ticket.companyName)
    tiles.push({ label: "Company", value: ticket.companyName });
  if (ticket.serviceName) tiles.push({ label: "Service", value: ticket.serviceName });
  if (ticket.dueDate) tiles.push({ label: "Due", value: formatEmailDate(ticket.dueDate) });
  if (ticket.tokens != null && ticket.tokens > 0) {
    tiles.push({
      label: role === "creative" ? "Payout" : "Tokens",
      value: `${ticket.tokens} ${ticket.tokens === 1 ? "token" : "tokens"}`,
      highlight: role === "creative",
    });
  }
  return tiles;
}

function SourceFilesBody(
  props: NotificationEmailProps & { sourceFiles: NotificationSourceFilesContext },
) {
  const { sourceFiles, ticket, recipientRole } = props;
  const count = sourceFiles.files.length;
  const what = count === 1 ? "1 source file" : `${count} source files`;
  const when = formatEmailDate(sourceFiles.deleteAfter);
  return (
    <>
      <Notice tone="warning">
        {`${what}${ticket ? ` on ${ticket.code}` : ""} will be deleted from brandbite on ${when}.`}
      </Notice>
      <Body16>
        Download them before then, or connect Google Drive or Dropbox: we move these files there,
        future ones land there too, and they stay yours for good.
      </Body16>
      <Card role={recipientRole} icon="file" title="Source files">
        <Tiles
          tiles={[
            ...(ticket ? [{ label: "Request", value: `${ticket.code} ${ticket.title}` }] : []),
            { label: "Kept until", value: when },
          ]}
        />
        {sourceFiles.files.slice(0, 8).map((file, i) => (
          <FileRow
            key={`${file.name}-${i}`}
            name={file.name}
            meta={formatFileSize(file.sizeBytes)}
          />
        ))}
        {count > 8 ? <Body16 muted>…and {count - 8} more.</Body16> : null}
      </Card>
    </>
  );
}

export function NotificationEmail(props: NotificationEmailProps) {
  const { recipientName, recipientRole, type, heading, title, message, actorName, ticket } = props;
  const previewText = ticket ? `${ticket.code} ${ticket.title}` : title || heading;

  return (
    <EmailFrame
      role={recipientRole}
      previewText={previewText}
      reason={`You received this email because ${REASONS[type] ?? "of your notification settings"}.`}
      preferencesUrl={props.preferencesUrl}
    >
      <Title>{heading}</Title>
      {props.sourceFiles ? (
        <SourceFilesBody {...props} sourceFiles={props.sourceFiles} />
      ) : (
        <>
          <Body16>{recipientName ? `Hi ${recipientName},` : "Hi,"}</Body16>
          <Body16>{message}</Body16>
          {actorName ? <Body16 muted>By {actorName}</Body16> : null}
          {ticket ? (
            <Card
              role={recipientRole}
              icon="ticket"
              label="Request"
              title={`${ticket.code} ${ticket.title}`}
            >
              {ticketTiles(ticket, recipientRole).length ? (
                <Tiles tiles={ticketTiles(ticket, recipientRole)} />
              ) : null}
            </Card>
          ) : title ? (
            <Card role={recipientRole} icon={ICONS[type] ?? "info"} title={title} />
          ) : null}
          {type === "TICKET_ASSIGNED" && recipientRole === "creative" ? (
            <Notice title="Getting started">
              Read the brief and press Start work when you begin. Your timer starts on its own.
            </Notice>
          ) : null}
        </>
      )}
      <Actions href={props.cta.href} label={props.cta.label} secondary={props.secondary} />
    </EmailFrame>
  );
}
