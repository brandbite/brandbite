// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/ticket-detail-dialog.tsx
// @purpose: Card detail on the customer board: fixed header with tabs, fixed
//           action footer, one scrolling body. The page owns the data, edit state
//           and status changes; this renders them.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { IconChevronDown } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  buttonClass,
  ButtonLink,
  Callout,
  DASH,
  EmptyState,
  Eyebrow,
  Field,
  fmt,
  IconTile,
  plural,
  PRIORITY,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  TextInput,
  TICKET_STATUS,
} from "@/components/admin/v2/ui";
import {
  BriefThumbnailRow,
  DownloadAllButton,
  RevisionImageGrid,
  RevisionImageLarge,
} from "@/components/ui/revision-image";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SafeHtml, stripHtml } from "@/components/ui/safe-html";
import { TagBadge } from "@/components/ui/tag-badge";
import { TagMultiSelect, type TagOption } from "@/components/ui/tag-multi-select";
import {
  formatBoardDate,
  formatDueDateCountdown,
  isDueDateOverdue,
  STATUS_LABELS,
} from "@/lib/board";
import { downloadAssetsAsZip, downloadSingleAsset } from "@/lib/download-helpers";
import type { TagColorKey } from "@/lib/tag-colors";
import { BRIEF_ACCEPT_ATTR } from "@/lib/upload-helpers";

import { BoardDialog } from "./board-dialog";
import { IconCheck, IconDownload, IconExternal, IconPencil, IconTrash } from "./board-icons";
import type {
  BriefAsset,
  CustomerBoardTicket,
  NewTicketMetadata,
  TicketEditForm,
  TicketRevisionEntry,
} from "./board-types";
import { TicketComments } from "./ticket-comments";

type DetailTab = "current" | "brief" | "versions" | "comments";

const SECTION_DIVIDER = "mt-5 border-t border-[var(--av2-border)] pt-5";
const CONTROL_BUTTON = "h-10 !rounded-lg !text-sm";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-[var(--av2-text-2)]">{label}</p>
      <div className="mt-0.5 text-sm font-semibold break-words">{children}</div>
    </div>
  );
}

function RevisionNotes({ revision }: { revision: TicketRevisionEntry }) {
  return (
    <>
      {revision.submittedAt ? (
        <p className="text-sm text-[var(--av2-text-2)]">
          Sent for review on{" "}
          <span className="font-semibold text-[var(--av2-text)]">
            {formatBoardDate(revision.submittedAt)}
          </span>
        </p>
      ) : null}
      {revision.feedbackAt ? (
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          Changes requested on{" "}
          <span className="font-semibold text-[var(--av2-text)]">
            {formatBoardDate(revision.feedbackAt)}
          </span>
        </p>
      ) : null}
      {revision.feedbackMessage ? (
        <blockquote className="mt-2 rounded-lg border border-[var(--av2-attention-border)] bg-[var(--av2-attention-from)] px-3 py-2 text-sm break-words whitespace-pre-wrap">
          {revision.feedbackMessage}
        </blockquote>
      ) : null}
    </>
  );
}

/** Earlier deliveries stay closed until asked for; files load only when opened. */
function VersionRow({
  revision,
  isCurrent,
}: {
  revision: TicketRevisionEntry;
  isCurrent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const assets = revision.assets ?? [];

  return (
    <li className="rounded-xl border border-[var(--av2-border)] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-semibold">Version {revision.version}</span>
        {isCurrent ? <Badge tone="peach">Current</Badge> : null}
        <span className="text-sm text-[var(--av2-text-2)]">
          {assets.length} {plural(assets.length, "file", "files")}
        </span>
        {assets.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DownloadAllButton
              assets={assets}
              zipFilename={`version-${revision.version}.zip`}
              className={CONTROL_BUTTON}
            />
            <Button aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              <IconChevronDown className={open ? "rotate-180" : ""} />
              {open ? "Hide files" : "Show files"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="mt-2">
        <RevisionNotes revision={revision} />
      </div>
      {open && assets.length > 0 ? <RevisionImageGrid assets={assets} pinMode="view" /> : null}
    </li>
  );
}

function BriefSummary({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-xl bg-[var(--av2-bg)] px-4 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded text-left focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
      >
        <span className="text-sm font-semibold">Brief summary</span>
        <IconChevronDown className={`shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <SafeHtml html={html} className="!bg-transparent pb-2 text-sm leading-6" />
      ) : (
        <p className="line-clamp-1 pb-2 text-sm text-[var(--av2-text-2)]">{stripHtml(html)}</p>
      )}
    </div>
  );
}

export function TicketDetailDialog({
  ticket,
  revisions,
  revisionsLoading,
  revisionsError,
  briefAssets,
  briefAssetsLoading,
  uploadingBriefs,
  uploadProgress,
  canEdit,
  canCancel,
  canRequestRevision,
  canApprove,
  canManageTags,
  metadata,
  isEditing,
  editForm,
  setEditForm,
  editSaving,
  editError,
  onClose,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCancelTicket,
  onRequestRevision,
  onApprove,
  onUploadBrief,
  onDeleteBrief,
  onCreateTag,
  onPinRevisionSubmitted,
}: {
  ticket: CustomerBoardTicket;
  revisions: TicketRevisionEntry[] | null;
  revisionsLoading: boolean;
  revisionsError: string | null;
  briefAssets: BriefAsset[];
  briefAssetsLoading: boolean;
  uploadingBriefs: boolean;
  uploadProgress: string | null;
  canEdit: boolean;
  canCancel: boolean;
  canRequestRevision: boolean;
  canApprove: boolean;
  canManageTags: boolean;
  metadata: NewTicketMetadata | null;
  isEditing: boolean;
  editForm: TicketEditForm;
  setEditForm: (update: (form: TicketEditForm) => TicketEditForm) => void;
  editSaving: boolean;
  editError: string | null;
  onClose: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onCancelTicket: () => void;
  onRequestRevision: () => void;
  onApprove: () => void;
  onUploadBrief: (files: FileList | null) => void;
  onDeleteBrief: (asset: { id: string }) => void;
  onCreateTag: (name: string, color: string) => Promise<TagOption | null>;
  onPinRevisionSubmitted: () => void;
}) {
  const formId = useId();
  const tabsId = useId();
  const [selectedTab, setSelectedTab] = useState<DetailTab | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [extras, setExtras] = useState<{
    effectiveCost: number | null;
    updatedAt: string | null;
  } | null>(null);

  // Cost and last-updated only come from the single-ticket endpoint. Changing the
  // job type changes the cost, so that re-reads it too.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/tickets/${ticket.id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.ticket) {
          setExtras({
            effectiveCost: json.ticket.effectiveCost ?? null,
            updatedAt: json.ticket.updatedAt ?? null,
          });
        }
      } catch {
        // Supplementary: the rows just stay empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket.id, ticket.jobTypeId]);

  const defaultTab: DetailTab =
    ticket.status === "TODO" || (revisions && revisions.length === 0) ? "brief" : "current";
  const tab = selectedTab ?? defaultTab;

  const status = TICKET_STATUS[ticket.status] ?? {
    label: STATUS_LABELS[ticket.status],
    tone: "neutral" as const,
  };
  const priority = PRIORITY[ticket.priority];

  const newestFirst = revisions ? [...revisions].reverse() : [];
  const latest = newestFirst[0] ?? null;
  const latestAssets = latest?.assets ?? [];
  const hasCreativeWork = newestFirst.some((rev) => (rev.assets?.length ?? 0) > 0);
  const canAddFiles = ticket.status === "TODO";
  const isDone = ticket.status === "DONE";
  // A finished request can't be late any more.
  const overdue = !isDone && isDueDateOverdue(ticket.dueDate);
  const countdown = isDone ? null : formatDueDateCountdown(ticket.dueDate);
  const updatedAt = ticket.updatedAt ?? extras?.updatedAt ?? null;

  const handleDownload = async () => {
    if (latestAssets.length === 0) return;
    setDownloading(true);
    try {
      if (latestAssets.length === 1) {
        await downloadSingleAsset(latestAssets[0].id, latestAssets[0].originalName || "final-work");
      } else {
        await downloadAssetsAsZip(
          latestAssets.map((asset) => ({ id: asset.id, originalName: asset.originalName })),
          `${ticket.title?.replace(/[^a-zA-Z0-9]/g, "-") || "final-work"}.zip`,
        );
      }
    } catch (err) {
      console.error("[DetailFooter] download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const revisionsState = revisionsLoading ? (
    <div aria-busy="true" aria-label="Loading versions" className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-48" />
    </div>
  ) : revisionsError ? (
    <Callout tone="error" title="We couldn't load the versions">
      {revisionsError}
    </Callout>
  ) : !revisions || revisions.length === 0 ? (
    <EmptyState
      title="No versions yet"
      description="Once your creative sends this request for review, you'll see each version and your feedback here."
    />
  ) : null;

  const footer = (() => {
    if (isEditing) {
      return (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button onClick={onCancelEdit} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSaveEdit} disabled={editSaving}>
            {editSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      );
    }
    if (canEdit || canCancel) {
      return (
        <>
          {canCancel ? (
            <Button variant="danger" onClick={onCancelTicket}>
              <IconTrash />
              Cancel &amp; refund
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              className="ml-auto"
              onClick={() => {
                // Title and brief are edited on this tab.
                setSelectedTab("brief");
                onStartEdit();
              }}
            >
              <IconPencil />
              Edit request
            </Button>
          ) : null}
        </>
      );
    }
    if (isDone) {
      return latestAssets.length > 0 ? (
        <Button
          variant="primary"
          className="ml-auto"
          onClick={handleDownload}
          disabled={downloading}
        >
          <IconDownload />
          {downloading
            ? "Downloading…"
            : `Download final work${latestAssets.length > 1 ? ` (${latestAssets.length} files)` : ""}`}
        </Button>
      ) : null;
    }
    if (ticket.status === "IN_REVIEW") {
      return (
        <>
          {latestAssets.length > 0 ? (
            <Button onClick={handleDownload} disabled={downloading}>
              <IconDownload />
              {downloading
                ? "Downloading…"
                : `Download${latestAssets.length > 1 ? ` (${latestAssets.length})` : ""}`}
            </Button>
          ) : null}
          {canRequestRevision || canApprove ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canRequestRevision ? (
                <Button onClick={onRequestRevision}>Request revision</Button>
              ) : null}
              {canApprove ? (
                <Button variant="primary" onClick={onApprove}>
                  Approve &amp; complete
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      );
    }
    return null;
  })();

  return (
    <BoardDialog
      open
      onClose={onClose}
      width="detail"
      eyebrow="Request"
      title={
        <>
          {ticket.code ? (
            <span className="mr-2 text-[var(--av2-text-2)]">{ticket.code}</span>
          ) : null}
          {ticket.title}
        </>
      }
      headerActions={
        <ButtonLink
          href={`/customer/tickets/${ticket.id}?from=board`}
          className="max-sm:!w-10 max-sm:!px-0"
        >
          <IconExternal />
          <span className="max-sm:sr-only">Open full page</span>
        </ButtonLink>
      }
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {priority ? <Badge tone={priority.tone}>{priority.label}</Badge> : null}
        </div>
      }
      tabs={
        <Tabs<DetailTab>
          idPrefix={tabsId}
          label="Request details"
          value={tab}
          onChange={setSelectedTab}
          tabs={[
            { value: "current", label: "Current version" },
            { value: "brief", label: "Brief & files" },
            {
              value: "versions",
              label: revisions ? `Versions (${revisions.length})` : "Versions",
            },
            { value: "comments", label: "Comments" },
          ]}
        />
      }
      footer={footer}
    >
      {editError ? (
        <div className="mb-5">
          <Callout tone="error" title="We couldn't save your changes">
            {editError}
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <TabPanel idPrefix={tabsId} value={tab}>
            {tab === "current" ? (
              <>
                {revisionsState ??
                  (latest ? (
                    <>
                      <Eyebrow>Current version</Eyebrow>
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--av2-bg)] p-3">
                        <IconTile tone={latest.feedbackAt ? "amber" : "green"} size={28} round>
                          {latest.feedbackAt ? (
                            <IconPencil width={14} height={14} />
                          ) : (
                            <IconCheck width={14} height={14} />
                          )}
                        </IconTile>
                        <span className="text-sm font-semibold">Version {latest.version}</span>
                        <span className="text-sm text-[var(--av2-text-2)]">
                          {latestAssets.length} {plural(latestAssets.length, "file", "files")}
                        </span>
                        <DownloadAllButton
                          assets={latestAssets}
                          zipFilename={`version-${latest.version}.zip`}
                          className={`${CONTROL_BUTTON} sm:ml-auto`}
                        />
                      </div>
                      <div className="mt-3">
                        <RevisionNotes revision={latest} />
                      </div>
                      {latestAssets.length > 0 ? (
                        // Two previews side by side from the shared component's
                        // stacked list; its lightbox still moves between all files.
                        <div
                          className={
                            latestAssets.length > 1
                              ? "sm:[&>div:first-child]:grid sm:[&>div:first-child]:grid-cols-2 sm:[&>div:first-child]:gap-3 sm:[&>div:first-child]:space-y-0"
                              : ""
                          }
                        >
                          <RevisionImageLarge
                            assets={latestAssets}
                            pinMode={ticket.status === "IN_REVIEW" ? "review" : "view"}
                            ticketId={ticket.id}
                            onRevisionSubmitted={onPinRevisionSubmitted}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null)}
                {ticket.description ? <BriefSummary html={ticket.description} /> : null}
              </>
            ) : null}

            {tab === "brief" ? (
              <div className="space-y-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <Field label="Title" htmlFor={`${formId}-title`}>
                      <TextInput
                        id={`${formId}-title`}
                        value={editForm.title}
                        onChange={(event) => {
                          const title = event.target.value;
                          setEditForm((form) => ({ ...form, title }));
                        }}
                        disabled={editSaving}
                      />
                    </Field>
                    <div>
                      <p className="mb-1.5 text-sm font-medium">Description</p>
                      <RichTextEditor
                        value={editForm.description}
                        onChange={(html) => setEditForm((form) => ({ ...form, description: html }))}
                        disabled={editSaving}
                        minHeight="120px"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Eyebrow>Brief</Eyebrow>
                    {ticket.description ? (
                      <SafeHtml
                        html={ticket.description}
                        className="mt-3 rounded-xl !bg-[var(--av2-bg)] p-4 text-sm leading-6"
                      />
                    ) : (
                      <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                        This request has no written brief.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Eyebrow>
                      Brief attachments
                      {briefAssets.length > 0 ? ` (${briefAssets.length})` : ""}
                    </Eyebrow>
                    <div className="flex flex-wrap items-center gap-2">
                      {canAddFiles ? (
                        <label
                          className={`${buttonClass("secondary")} cursor-pointer focus-within:ring-2 focus-within:ring-[var(--av2-accent)] ${uploadingBriefs ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            type="file"
                            accept={BRIEF_ACCEPT_ATTR}
                            multiple
                            className="sr-only"
                            disabled={uploadingBriefs}
                            onChange={(event) => {
                              onUploadBrief(event.target.files);
                              event.currentTarget.value = "";
                            }}
                          />
                          Add files
                        </label>
                      ) : null}
                      <DownloadAllButton
                        assets={briefAssets}
                        zipFilename="brief-attachments.zip"
                        className={CONTROL_BUTTON}
                      />
                    </div>
                  </div>
                  {uploadProgress ? (
                    <p role="status" className="mt-2 text-sm text-[var(--av2-text-2)]">
                      {uploadProgress}
                    </p>
                  ) : null}
                  {briefAssetsLoading ? (
                    <Skeleton className="mt-3 h-24" />
                  ) : briefAssets.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--av2-text-2)]">No files attached.</p>
                  ) : hasCreativeWork ? (
                    <BriefThumbnailRow
                      assets={briefAssets}
                      onDelete={canAddFiles ? onDeleteBrief : undefined}
                    />
                  ) : (
                    <RevisionImageLarge
                      assets={briefAssets}
                      pinMode="view"
                      onDelete={canAddFiles ? onDeleteBrief : undefined}
                    />
                  )}
                </div>
              </div>
            ) : null}

            {tab === "versions"
              ? (revisionsState ?? (
                  <ul className="space-y-3">
                    {newestFirst.map((revision, index) => (
                      <VersionRow
                        key={revision.version}
                        revision={revision}
                        isCurrent={index === 0}
                      />
                    ))}
                  </ul>
                ))
              : null}

            {tab === "comments" ? <TicketComments ticketId={ticket.id} /> : null}
          </TabPanel>
        </div>

        <aside className="h-fit min-w-0 rounded-xl bg-[var(--av2-bg)] p-5">
          <Eyebrow>Details</Eyebrow>
          <div className="mt-3 space-y-3">
            {isEditing ? (
              <>
                <Field label="Priority" htmlFor={`${formId}-priority`}>
                  <Select
                    id={`${formId}-priority`}
                    value={editForm.priority}
                    onChange={(event) => {
                      const nextPriority = event.target.value;
                      setEditForm((form) => ({ ...form, priority: nextPriority }));
                    }}
                    disabled={editSaving}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </Field>
                <Field label="Project" htmlFor={`${formId}-project`}>
                  <Select
                    id={`${formId}-project`}
                    value={editForm.projectId}
                    onChange={(event) => {
                      const projectId = event.target.value;
                      setEditForm((form) => ({ ...form, projectId }));
                    }}
                    disabled={editSaving || !metadata}
                  >
                    <option value="">No specific project</option>
                    {(metadata?.projects ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.code ? ` (${project.code})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Service" htmlFor={`${formId}-job-type`}>
                  <Select
                    id={`${formId}-job-type`}
                    value={editForm.jobTypeId}
                    onChange={(event) => {
                      const jobTypeId = event.target.value;
                      setEditForm((form) => ({ ...form, jobTypeId }));
                    }}
                    disabled={editSaving || !metadata}
                  >
                    <option value="">Choose a service</option>
                    {(metadata?.jobTypes ?? []).map((jobType) => (
                      <option key={jobType.id} value={jobType.id}>
                        {jobType.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : (
              <>
                <DetailRow label="Project">{ticket.projectName || DASH}</DetailRow>
                <DetailRow label="Service">{ticket.jobTypeName || DASH}</DetailRow>
              </>
            )}
            {extras?.effectiveCost != null ? (
              <DetailRow label="Cost">
                {fmt(extras.effectiveCost)} {plural(extras.effectiveCost, "token", "tokens")}
              </DetailRow>
            ) : null}
            {/* Hidden when the TAGS_ENABLED flag is off. Treated as on while the
                metadata is unknown. */}
            <div hidden={metadata?.tagsEnabled === false}>
              {isEditing ? (
                <>
                  <p className="mb-1.5 text-sm font-medium">Tags</p>
                  <TagMultiSelect
                    availableTags={(metadata?.tags ?? []) as TagOption[]}
                    selectedTagIds={editForm.tagIds}
                    onChange={(tagIds) => setEditForm((form) => ({ ...form, tagIds }))}
                    onCreateTag={onCreateTag}
                    canCreate={canManageTags}
                    disabled={editSaving}
                  />
                </>
              ) : (
                <DetailRow label="Tags">
                  {ticket.tags && ticket.tags.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {ticket.tags.map((tag) => (
                        <TagBadge
                          key={tag.id}
                          name={tag.name}
                          color={tag.color as TagColorKey}
                          className="!text-xs"
                        />
                      ))}
                    </span>
                  ) : (
                    DASH
                  )}
                </DetailRow>
              )}
            </div>
          </div>

          <div className={SECTION_DIVIDER}>
            <Eyebrow>People</Eyebrow>
            <div className="mt-3 flex items-center gap-3">
              <IconTile tone={ticket.isAssigned ? "green" : "neutral"} size={36} round>
                {ticket.isAssigned ? <IconCheck /> : <span aria-hidden>{DASH}</span>}
              </IconTile>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Creative team</p>
                <p className="text-sm text-[var(--av2-text-2)]">
                  {ticket.isAssigned ? "Assigned" : "Unassigned"}
                </p>
              </div>
            </div>
          </div>

          <div className={SECTION_DIVIDER}>
            <Eyebrow>Dates</Eyebrow>
            <div className="mt-3 space-y-3">
              <DetailRow label="Created">{formatBoardDate(ticket.createdAt)}</DetailRow>
              <DetailRow label="Updated">{formatBoardDate(updatedAt)}</DetailRow>
              {isEditing ? (
                <Field label="Due date" htmlFor={`${formId}-due`}>
                  <TextInput
                    id={`${formId}-due`}
                    type="date"
                    value={editForm.dueDate}
                    onChange={(event) => {
                      const dueDate = event.target.value;
                      setEditForm((form) => ({ ...form, dueDate }));
                    }}
                    disabled={editSaving}
                  />
                </Field>
              ) : (
                <DetailRow label="Due">
                  <span className={overdue ? "text-[var(--av2-error-text)]" : ""}>
                    {formatBoardDate(ticket.dueDate)}
                  </span>
                  {countdown ? (
                    <span
                      className={`mt-0.5 block text-xs font-medium ${
                        countdown.overdue
                          ? "text-[var(--av2-error-text)]"
                          : "text-[var(--av2-text-2)]"
                      }`}
                    >
                      {countdown.label}
                    </span>
                  ) : null}
                </DetailRow>
              )}
            </div>
          </div>
        </aside>
      </div>
    </BoardDialog>
  );
}
