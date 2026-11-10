// -----------------------------------------------------------------------------
// @file: lib/email-templates/previews/design-samples.tsx
// @purpose: The three emails from the 2026-11 design, built on the new frame,
//           for previewing the frame against the design (react-email preview
//           and scripts). Sample data only; never sent.
// -----------------------------------------------------------------------------

import * as React from "react";

import {
  Actions,
  Body16,
  Card,
  DetailRows,
  EmailFrame,
  FileRow,
  Notice,
  Pill,
  Tiles,
  Title,
} from "../frame";

const APP = "https://brandbite.studio";

export function CreativeSample() {
  return (
    <EmailFrame
      role="creative"
      previewText="WEB-101 Logo redesign · due Nov 19, 2026"
      reason="You received this email because a request was assigned to you."
      preferencesUrl={`${APP}/creative/settings`}
    >
      <Title>New request assigned</Title>
      <Body16>Hi Ada,</Body16>
      <Body16>A new request was assigned to you.</Body16>
      <Card role="creative" icon="ticket" label="Request" title="WEB-101 Logo redesign">
        <Tiles
          tiles={[
            { label: "Company", value: "Acme Studio" },
            { label: "Service", value: "Logo" },
            { label: "Due", value: "Nov 19, 2026" },
            { label: "Payout", value: "18 tokens", highlight: true },
          ]}
        />
      </Card>
      <Notice title="Getting started">Read the brief and press Start work when you begin.</Notice>
      <Actions
        href={`${APP}/creative/tickets/x`}
        label="View request"
        secondary={{ href: `${APP}/creative/board`, label: "Open your board" }}
      />
    </EmailFrame>
  );
}

export function CustomerSample() {
  return (
    <EmailFrame
      role="customer"
      previewText="2 source files on WEB-101 will be deleted on Feb 8, 2027"
      reason="You received this email because your request includes source files."
      preferencesUrl={`${APP}/customer/settings`}
    >
      <Title>Your source files will be deleted soon</Title>
      <Notice tone="warning">
        2 source files on WEB-101 will be deleted from brandbite on Feb 8, 2027.
      </Notice>
      <Body16>
        Download them before then, or connect Google Drive or Dropbox so future source files land in
        your own storage and stay yours for good.
      </Body16>
      <Card role="customer" icon="file" title="Source files">
        <Tiles
          tiles={[
            { label: "Request", value: "WEB-101 Logo redesign" },
            { label: "Kept until", value: "Feb 8, 2027" },
          ]}
        />
        <FileRow name="Logo-master.ai" meta="46 MB" />
        <FileRow name="Poster-print.psd" meta="2.0 GB" />
      </Card>
      <Actions
        href={`${APP}/customer/tickets/x`}
        label="Download your files"
        secondary={{
          href: `${APP}/customer/settings?tab=integrations`,
          label: "Connect Google Drive or Dropbox",
        }}
      />
    </EmailFrame>
  );
}

export function AdminSample() {
  return (
    <EmailFrame
      role="admin"
      previewText="A site owner added 80 tokens to Acme Studio."
      reason="You received this email because you're a brandbite site owner."
    >
      <Title>Company token balance adjusted</Title>
      <Body16>A site owner added 80 tokens to Acme Studio.</Body16>
      <Card
        role="admin"
        icon="coins"
        label="Balance change"
        title="+80 tokens"
        aside={<Pill>Success</Pill>}
        filled
      >
        <Tiles
          tiles={[
            { label: "Previous balance", value: "0 tokens" },
            { label: "New balance", value: "80 tokens" },
          ]}
        />
      </Card>
      <Card role="admin" tone="neutral" icon="file-text" title="Audit details">
        <DetailRows
          rows={[
            { label: "Company", value: "Acme Studio" },
            { label: "Actor", value: "Brandbite Studio · Site owner" },
            { label: "Action", value: "COMPANY_TOKEN_GRANT" },
            { label: "Recorded at", value: "Nov 10, 2026 · 13:31 UTC" },
            { label: "IP address", value: "203.0.113.24" },
          ]}
        />
      </Card>
      <Notice title="Adjustment note">For Google Drive and other feature tests.</Notice>
      <Actions
        href={`${APP}/admin/audit-log`}
        label="View audit log"
        note="If you didn't expect this change, review the full entry."
      />
    </EmailFrame>
  );
}
