// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/ticket-detail-dialog.tsx
// @purpose: Card detail on the creative board. The header and footer stay put and
//           the tab content scrolls as one body. The creative can upload work or
//           pull a ticket back; approving stays with the customer, so there is no
//           approve action here.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { IconArrowUpRight, IconDocument } from "@/components/admin/v2/icons";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  DASH,
  EmptyState,
  Eyebrow,
  PRIORITY,
  Skeleton,
  TabPanel,
  Tabs,
  TICKET_STATUS,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconX } from "@/components/navigation/nav-icons";
import { Modal } from "@/components/ui/modal";
import {
  BriefThumbnailRow,
  DownloadAllButton,
  RevisionImageGrid,
  RevisionImageLarge,
} from "@/components/ui/revision-image";
import { SafeHtml } from "@/components/ui/safe-html";
import { formatBoardDate, formatDueDateCountdown } from "@/lib/board";

import { IconUpload } from "./icons";
import { formatPayout, isTicketOverdue, ticketCode } from "./job-card";
import { TicketComments } from "./ticket-comments";
import type { BriefAsset, CreativeTicket, DetailTab, TicketRevisionEntry } from "./types";

/** Which tab a ticket opens on: its latest delivery, or the brief if there is none. */
export function initialDetailTab(ticket: Pick<CreativeTicket, "revisionCount">): DetailTab {
  return ticket.revisionCount > 0 ? "current" : "brief";
}

/** Lays the shared large-preview list out in two columns from the sm breakpoint. */
const PREVIEW_GRID =
  "[&>div:first-child]:grid [&>div:first-child]:gap-3 sm:[&>div:first-child]:grid-cols-2 [&>div:first-child>*]:mb-0!";

function VersionMeta({ revision }: { revision: TicketRevisionEntry }) {
  if (!revision.submittedAt) return null;
  return (
    <p className="mt-1 text-sm text-[var(--av2-text-2)]">
      You sent this for review on{" "}
      <span className="font-medium text-[var(--av2-text)]">
        {formatBoardDate(revision.submittedAt)}
      </span>
    </p>
  );
}

function VersionNotes({ revision }: { revision: TicketRevisionEntry }) {
  const note = typeof revision.creativeMessage === "string" ? revision.creativeMessage.trim() : "";
  return (
    <>
      {(revision.feedbackMessage || revision.feedbackAt) && (
        <div className="mt-4">
          <Callout tone="warning" title="Customer feedback">
            {revision.feedbackMessage && (
              <p className="break-words whitespace-pre-wrap text-[var(--av2-text)] italic">
                &ldquo;{revision.feedbackMessage}&rdquo;
              </p>
            )}
            {revision.feedbackAt && (
              <p className="mt-1 text-xs">
                Changes requested on {formatBoardDate(revision.feedbackAt)}
              </p>
            )}
          </Callout>
        </div>
      )}
      {note && (
        <p className="mt-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4 text-sm break-words whitespace-pre-wrap">
          <span className="font-semibold">Your note:</span> {note}
        </p>
      )}
    </>
  );
}

function RevisionsStatus({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading versions" className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) {
    return (
      <Callout tone="error" title="We couldn't load the versions">
        {error}
      </Callout>
    );
  }
  if (empty) {
    return (
      <EmptyState
        icon={<IconDocument width={24} height={24} />}
        title="No versions yet."
        description="Once you send this job for review, each version and its feedback will appear here."
      />
    );
  }
  return null;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-[var(--av2-border)] py-4 last:pb-0">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className="mt-1 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

export function TicketDetailDialog({
  ticket,
  tab,
  onTabChange,
  onClose,
  revisions,
  revisionsLoading,
  revisionsError,
  briefAssets,
  briefAssetsLoading,
  updating,
  onUploadWork,
  onPullBack,
}: {
  ticket: CreativeTicket | null;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
  revisions: TicketRevisionEntry[] | null;
  revisionsLoading: boolean;
  revisionsError: string | null;
  briefAssets: BriefAsset[];
  briefAssetsLoading: boolean;
  updating: boolean;
  onUploadWork: () => void;
  onPullBack: () => void;
}) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const tabsId = `${reactId}-job`;
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // One scrolling body shared by the tabs: every tab starts at its top.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab]);

  const newestFirst = revisions ? [...revisions].reverse() : [];
  const latest = newestFirst[0] ?? null;
  const versionCount = revisions?.length ?? ticket?.revisionCount ?? 0;
  const hasCreativeWork = newestFirst.some((r) => r.assets && r.assets.length > 0);

  const status = ticket ? TICKET_STATUS[ticket.status] : null;
  const priority = ticket ? PRIORITY[ticket.priority] : null;
  const overdue = ticket ? isTicketOverdue(ticket) : false;
  const countdown =
    ticket && ticket.status !== "DONE" ? formatDueDateCountdown(ticket.dueDate) : null;
  const fullPageHref = ticket ? `/creative/tickets/${ticket.id}` : "";

  return (
    <Modal
      open={!!ticket}
      onClose={onClose}
      size="full"
      labelledBy={titleId}
      className="border border-[var(--av2-border)] p-0!"
    >
      {ticket && (
        <>
          <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.12em] text-[var(--av2-text-2)] uppercase">
                  {ticketCode(ticket)}
                </p>
                <h2 id={titleId} className="mt-1 text-2xl leading-8 font-bold break-words">
                  {ticket.title}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ButtonLink href={fullPageHref} className="max-sm:px-3">
                  <span className="max-sm:sr-only">Open full page</span>
                  <IconArrowUpRight />
                </ButtonLink>
                <Button aria-label="Close details" onClick={onClose} className="w-10 px-0!">
                  <IconX width={18} height={18} />
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {status && (
                <Badge tone={status.tone as Tone} dot>
                  {status.label}
                </Badge>
              )}
              {priority && <Badge tone={priority.tone as Tone}>{priority.label}</Badge>}
              {ticket.latestRevisionHasFeedback && (
                <Badge tone="amber" dot>
                  Changes requested
                </Badge>
              )}
            </div>

            <div className="mt-4 [&_[role=tab]]:min-h-10">
              <Tabs<DetailTab>
                label="Job details"
                idPrefix={tabsId}
                value={tab}
                onChange={onTabChange}
                tabs={[
                  { value: "current", label: "Current version" },
                  { value: "brief", label: "Brief & files" },
                  { value: "versions", label: `Versions (${versionCount})` },
                  { value: "comments", label: "Comments" },
                ]}
              />
            </div>
          </div>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {ticket.status === "IN_PROGRESS" && ticket.latestRevisionHasFeedback && (
              <div className="mb-4">
                <Callout tone="warning" title="Customer requested changes">
                  {ticket.latestRevisionFeedbackSnippet
                    ? `“${ticket.latestRevisionFeedbackSnippet}”`
                    : undefined}
                </Callout>
              </div>
            )}
            {ticket.status === "IN_REVIEW" && (
              <div className="mb-4">
                <Callout tone="info" title="Waiting for customer feedback" />
              </div>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
              <div className="min-w-0">
                <TabPanel idPrefix={tabsId} value={tab}>
                  <Card padding="sm" className="sm:p-5">
                    {tab === "current" && (
                      <>
                        <h3 className="mb-3 text-xl leading-7 font-semibold">Current version</h3>
                        <RevisionsStatus
                          loading={revisionsLoading}
                          error={revisionsError}
                          empty={!latest}
                        />
                        {!revisionsLoading && !revisionsError && latest && (
                          <>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-base font-semibold">Version {latest.version}</p>
                              {latest.assets && latest.assets.length > 0 && (
                                <DownloadAllButton
                                  assets={latest.assets}
                                  zipFilename={`version-${latest.version}.zip`}
                                  className="h-10 justify-center"
                                />
                              )}
                            </div>
                            <VersionMeta revision={latest} />
                            {latest.assets && latest.assets.length > 0 ? (
                              <div className={PREVIEW_GRID}>
                                <RevisionImageLarge
                                  assets={latest.assets}
                                  pinMode={ticket.status === "IN_PROGRESS" ? "resolve" : "view"}
                                  onUploadWork={
                                    ticket.status === "IN_PROGRESS" ? onUploadWork : undefined
                                  }
                                />
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                                No files are attached to this version.
                              </p>
                            )}
                            <VersionNotes revision={latest} />
                          </>
                        )}
                      </>
                    )}

                    {tab === "brief" && (
                      <>
                        <h3 className="mb-3 text-xl leading-7 font-semibold">Brief</h3>
                        {ticket.description ? (
                          <SafeHtml
                            html={ticket.description}
                            className="rounded-xl border px-4 py-3 text-sm leading-6 break-words"
                          />
                        ) : (
                          <p className="text-sm text-[var(--av2-text-2)]">
                            No description was added to this job.
                          </p>
                        )}

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            Attachments
                            {briefAssets.length > 0 && (
                              <span className="ml-1.5 font-normal text-[var(--av2-text-2)]">
                                ({briefAssets.length})
                              </span>
                            )}
                          </h3>
                          <DownloadAllButton
                            assets={briefAssets}
                            zipFilename="brief-attachments.zip"
                            className="h-10 justify-center"
                          />
                        </div>
                        {briefAssetsLoading ? (
                          <div aria-busy="true" aria-label="Loading attachments" className="mt-3">
                            <Skeleton className="h-16 w-16" />
                          </div>
                        ) : briefAssets.length === 0 ? (
                          <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                            No files were attached to the brief.
                          </p>
                        ) : hasCreativeWork ? (
                          <BriefThumbnailRow assets={briefAssets} />
                        ) : (
                          <div className={PREVIEW_GRID}>
                            <RevisionImageLarge assets={briefAssets} pinMode="view" />
                          </div>
                        )}
                      </>
                    )}

                    {tab === "versions" && (
                      <>
                        <h3 className="mb-3 text-xl leading-7 font-semibold">Versions</h3>
                        <RevisionsStatus
                          loading={revisionsLoading}
                          error={revisionsError}
                          empty={!latest}
                        />
                        {!revisionsLoading && !revisionsError && (
                          <div className="space-y-4">
                            {newestFirst.map((revision, index) => (
                              <div
                                key={revision.version}
                                className="rounded-xl border border-[var(--av2-border)] p-4"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold">
                                    Version {revision.version}
                                  </p>
                                  {index === 0 && <Badge tone="peach">Current</Badge>}
                                  {revision.assets && revision.assets.length > 0 && (
                                    <DownloadAllButton
                                      assets={revision.assets}
                                      zipFilename={`version-${revision.version}.zip`}
                                      className="h-10 justify-center"
                                    />
                                  )}
                                </div>
                                <VersionMeta revision={revision} />
                                <VersionNotes revision={revision} />
                                {revision.assets && revision.assets.length > 0 && (
                                  <RevisionImageGrid assets={revision.assets} pinMode="view" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {tab === "comments" && (
                      <>
                        <h3 className="mb-3 text-xl leading-7 font-semibold">Comments</h3>
                        <TicketComments ticketId={ticket.id} />
                      </>
                    )}
                  </Card>
                </TabPanel>
              </div>

              <Card as="div" padding="sm" className="sm:p-5">
                <dl>
                  <div className="pb-4">
                    <dt>
                      <Eyebrow>Company</Eyebrow>
                    </dt>
                    <dd className="mt-2 flex items-center gap-3">
                      <Avatar name={ticket.company?.name} size={40} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words">
                          {ticket.company?.name || DASH}
                        </p>
                        <p className="text-xs text-[var(--av2-text-2)]">Customer</p>
                      </div>
                    </dd>
                  </div>
                  <Detail label="Project">{ticket.project?.name || DASH}</Detail>
                  <Detail label="Job type">{ticket.jobType?.name || DASH}</Detail>
                  <Detail label="Payout">{formatPayout(ticket.estimatedPayout)}</Detail>
                  <Detail label="Due date">
                    <span className={overdue ? "text-[var(--av2-error-text)]" : ""}>
                      {formatBoardDate(ticket.dueDate)}
                    </span>
                    {countdown && (
                      <span
                        className={`mt-0.5 block text-xs ${
                          countdown.overdue
                            ? "text-[var(--av2-error-text)]"
                            : "text-[var(--av2-text-2)]"
                        }`}
                      >
                        {countdown.label}
                      </span>
                    )}
                  </Detail>
                  <Detail label="Created">{formatBoardDate(ticket.createdAt)}</Detail>
                  <Detail label="Updated">{formatBoardDate(ticket.updatedAt)}</Detail>
                </dl>
              </Card>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--av2-border)] px-4 py-3 sm:px-6 sm:py-4">
            <Button onClick={onClose}>Close</Button>
            {ticket.status === "IN_PROGRESS" ? (
              <Button variant="primary" onClick={onUploadWork}>
                <IconUpload />
                <span>Upload work</span>
              </Button>
            ) : ticket.status === "IN_REVIEW" ? (
              <Button onClick={onPullBack} disabled={updating}>
                {updating ? "Moving…" : "Pull back to In progress"}
              </Button>
            ) : (
              <ButtonLink href={fullPageHref} variant="primary">
                Open job
                <IconArrowUpRight />
              </ButtonLink>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
