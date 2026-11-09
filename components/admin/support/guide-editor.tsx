// -----------------------------------------------------------------------------
// @file: components/admin/support/guide-editor.tsx
// @purpose: Edits one Support guide: title, summary, category, search words and
//           sections of blocks (paragraph, steps, list, tip, warning). For a
//           code guide it also shows what code says, and when code changed
//           after an edit, both versions side by side to resolve.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  Field,
  PageHeader,
  SaveBar,
  Select,
  Skeleton,
  TextArea,
  TextInput,
} from "@/components/admin/v2/ui";
import { RichText } from "@/components/support/support-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import type { GuideContent } from "@/lib/support/merge";
import type { GuideBlock, GuideSection } from "@/lib/support/types";

type Role = "customer" | "creative" | "admin";
type Status = "IN_SYNC" | "CODE_CHANGED" | "CODE_REMOVED";
type State = "code" | "edited" | "cms" | "hidden";

type Detail = {
  role: Role;
  slug: string;
  state: State;
  status: Status;
  code: GuideContent | null;
  edit: GuideContent | null;
  hidden: boolean;
  ownerOnly: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  creative: "Creative",
  admin: "Admin",
};

const BLOCK_LABEL: Record<GuideBlock["type"], string> = {
  p: "Paragraph",
  steps: "Numbered steps",
  list: "Bulleted list",
  tip: "Tip",
  warning: "Warning",
};

// --- Blocks as editable text ------------------------------------------------

/** List items with a term are written "Term — text", one per line. */
const TERM_SEPARATOR = " — ";

function blockToText(block: GuideBlock): string {
  if (block.type === "p" || block.type === "tip" || block.type === "warning") return block.text;
  if (block.type === "steps") return block.items.join("\n");
  return block.items
    .map((item) => (typeof item === "string" ? item : `${item.term}${TERM_SEPARATOR}${item.text}`))
    .join("\n");
}

function textToBlock(type: GuideBlock["type"], text: string): GuideBlock {
  if (type === "p" || type === "tip" || type === "warning") return { type, text };
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (type === "steps") return { type, items: lines };
  return {
    type,
    items: lines.map((line) => {
      const at = line.indexOf(TERM_SEPARATOR);
      return at > 0
        ? { term: line.slice(0, at).trim(), text: line.slice(at + TERM_SEPARATOR.length).trim() }
        : line;
    }),
  };
}

type DraftBlock = { type: GuideBlock["type"]; text: string };
type DraftSection = { heading: string; blocks: DraftBlock[] };
type Draft = {
  title: string;
  summary: string;
  category: string;
  keywords: string;
  sections: DraftSection[];
};

function toDraft(content: GuideContent): Draft {
  return {
    title: content.title,
    summary: content.summary,
    category: content.category,
    keywords: content.keywords.join(", "),
    sections: content.sections.map((section) => ({
      heading: section.heading,
      blocks: section.blocks.map((block) => ({ type: block.type, text: blockToText(block) })),
    })),
  };
}

function fromDraft(draft: Draft): GuideContent {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    category: draft.category.trim(),
    keywords: draft.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    sections: draft.sections
      .map(
        (section): GuideSection => ({
          heading: section.heading.trim(),
          blocks: section.blocks
            .filter((block) => block.text.trim())
            .map((block) => textToBlock(block.type, block.text)),
        }),
      )
      .filter((section) => section.heading && section.blocks.length > 0),
  };
}

const EMPTY_DRAFT: Draft = {
  title: "",
  summary: "",
  category: "",
  keywords: "",
  sections: [{ heading: "", blocks: [{ type: "p", text: "" }] }],
};

// --- Read-only rendering, for comparing versions ----------------------------

function ContentPreview({ content }: { content: GuideContent }) {
  return (
    <div className="flex flex-col gap-4 text-sm leading-6">
      <div>
        <p className="text-base font-semibold">{content.title}</p>
        <p className="text-[var(--av2-text-2)]">
          <RichText text={content.summary} />
        </p>
      </div>
      {content.sections.map((section, i) => (
        <section key={i}>
          <p className="font-semibold">{section.heading}</p>
          {section.blocks.map((block, j) => (
            <div key={j} className="mt-1">
              {block.type === "steps" ? (
                <ol className="list-decimal pl-5">
                  {block.items.map((item, k) => (
                    <li key={k}>
                      <RichText text={item} />
                    </li>
                  ))}
                </ol>
              ) : block.type === "list" ? (
                <ul className="list-disc pl-5">
                  {block.items.map((item, k) => (
                    <li key={k}>
                      <RichText
                        text={
                          typeof item === "string"
                            ? item
                            : `**${item.term}**${TERM_SEPARATOR}${item.text}`
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {block.type !== "p" ? <strong>{BLOCK_LABEL[block.type]}: </strong> : null}
                  <RichText text={block.text} />
                </p>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// --- Editor -------------------------------------------------------------------

export function GuideEditor({ role, slug }: { role: Role; slug: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isNew = slug === null;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<string>(JSON.stringify(EMPTY_DRAFT));
  const [newSlug, setNewSlug] = useState("");
  const [newRole, setNewRole] = useState<Role>(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "revert" | "delete">(null);

  const dirty = JSON.stringify(draft) !== saved;
  useUnsavedChanges(dirty, "Support guide editor");

  function adopt(next: Detail) {
    setDetail(next);
    const base = next.edit ?? next.code;
    const nextDraft = base ? toDraft(base) : EMPTY_DRAFT;
    setDraft(nextDraft);
    setSaved(JSON.stringify(nextDraft));
  }

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/support-guides/${role}/${slug}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? "This guide couldn't be loaded.");
        if (!cancelled) adopt(json.guide as Detail);
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "This guide couldn't be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, role, slug]);

  async function call(method: "PUT" | "PATCH" | "DELETE", body?: unknown, done?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support-guides/${role}/${slug}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "That didn't work. Try again.");
      if (done) showToast({ type: "success", title: done });
      // Deleting a CMS-only guide (or one removed from code) leaves nothing to show.
      if (!json.guide) {
        setSaved(JSON.stringify(draft));
        router.push("/admin/support-content");
        return;
      }
      adopt(json.guide as Detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support-guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, slug: newSlug.trim(), content: fromDraft(draft) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "The guide couldn't be created.");
      setSaved(JSON.stringify(draft));
      showToast({ type: "success", title: "Guide created" });
      router.push(`/admin/support-content/${newRole}/${newSlug.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The guide couldn't be created.");
    } finally {
      setBusy(false);
    }
  }

  const updateSection = (index: number, patch: Partial<DraftSection>) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  const updateBlock = (si: number, bi: number, patch: Partial<DraftBlock>) =>
    updateSection(si, {
      blocks: draft.sections[si].blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)),
    });
  const moveSection = (index: number, by: -1 | 1) =>
    setDraft((d) => {
      const sections = [...d.sections];
      const [moved] = sections.splice(index, 1);
      sections.splice(index + by, 0, moved);
      return { ...d, sections };
    });

  const siteHref = useMemo(() => `/${role}/support/${slug}`, [role, slug]);

  if (loadError) {
    return (
      <Callout tone="error" title="Couldn't open the guide">
        {loadError}{" "}
        <Link href="/admin/support-content" className="underline">
          Back to Support content
        </Link>
      </Callout>
    );
  }
  if (!isNew && !detail) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isCode = !!detail?.code;
  const edited = !!detail?.edit;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isNew ? "New guide" : draft.title || slug}
        description={
          isNew
            ? "A guide that exists only here. It shows in the Support hub and search."
            : `${ROLE_LABEL[role]} guide · ${isCode ? (edited ? "edited here, written in code" : "written in code") : "added here"}`
        }
        meta={
          !isNew ? (
            <div className="flex flex-wrap items-center gap-2">
              {detail?.hidden ? <Badge tone="amber">Hidden</Badge> : null}
              {detail?.ownerOnly ? <Badge tone="neutral">Owner only</Badge> : null}
              <Link href="/admin/support-content" className="underline">
                All guides
              </Link>
              {!detail?.hidden && detail?.status !== "CODE_REMOVED" ? (
                <Link href={siteHref} className="underline" target="_blank">
                  Open on the site
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />

      {detail?.status === "CODE_CHANGED" && detail.code && detail.edit ? (
        <Card>
          <div className="flex flex-col gap-4 p-5">
            <Callout tone="warning" title="Code updated this guide after it was edited here">
              Your version is still live. Compare the two, then keep yours, take the new code
              version, or start from the new version and add your changes again.
            </Callout>
            <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
              <div className="rounded-lg border border-[var(--av2-border)] p-4">
                <CardTitle>Your version</CardTitle>
                <div className="mt-3">
                  <ContentPreview content={detail.edit} />
                </div>
              </div>
              <div className="rounded-lg border border-[var(--av2-border)] p-4">
                <CardTitle>New code version</CardTitle>
                <div className="mt-3">
                  <ContentPreview content={detail.code} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void call("PATCH", { action: "keep-mine" }, "Kept your version")}
              >
                Keep my version
              </Button>
              <Button disabled={busy} onClick={() => setConfirm("revert")}>
                Use the new code version
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setDraft(toDraft(detail.code!))}
              >
                Start from the new version
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {detail?.status === "CODE_REMOVED" ? (
        <Callout tone="warning" title="This guide was removed from code">
          The feature it described may be gone, so it is hidden on the site. Keep it as a guide
          added here if it still applies, or delete it.
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={busy || !detail.edit}
              onClick={() =>
                void call("PATCH", { action: "keep-as-cms" }, "Kept as a guide added here")
              }
            >
              Keep as a guide added here
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirm("delete")}>
              Delete it
            </Button>
          </div>
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="error" title="Couldn't save">
          {error}
        </Callout>
      ) : null}

      <Card>
        <div className="flex flex-col gap-5 p-5">
          {isNew ? (
            <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
              <Field label="For" htmlFor="guide-role">
                <Select
                  id="guide-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Address"
                htmlFor="guide-slug"
                hint={`Shown as /${newRole}/support/${newSlug || "your-guide"}. Lowercase letters, numbers and dashes.`}
              >
                <TextInput
                  id="guide-slug"
                  value={newSlug}
                  onChange={(e) =>
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                  }
                  maxLength={80}
                />
              </Field>
            </div>
          ) : null}
          <Field label="Title" htmlFor="guide-title">
            <TextInput
              id="guide-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={120}
            />
          </Field>
          <Field
            label="Summary"
            htmlFor="guide-summary"
            hint="One sentence, shown on the hub card."
          >
            <TextInput
              id="guide-summary"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              maxLength={240}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
            <Field
              label="Category"
              htmlFor="guide-category"
              hint="Hub group, e.g. Workspace or Billing."
            >
              <TextInput
                id="guide-category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                maxLength={60}
              />
            </Field>
            <Field
              label="Search words"
              htmlFor="guide-keywords"
              hint="Comma-separated, for search only."
            >
              <TextInput
                id="guide-keywords"
                value={draft.keywords}
                onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Card>

      {draft.sections.map((section, si) => (
        <Card key={si}>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-end gap-2">
              <Field
                label={`Section ${si + 1} heading`}
                htmlFor={`section-${si}`}
                className="min-w-0 flex-1"
              >
                <TextInput
                  id={`section-${si}`}
                  value={section.heading}
                  onChange={(e) => updateSection(si, { heading: e.target.value })}
                  maxLength={120}
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                disabled={si === 0}
                onClick={() => moveSection(si, -1)}
              >
                Move up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={si === draft.sections.length - 1}
                onClick={() => moveSection(si, 1)}
              >
                Move down
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={draft.sections.length === 1}
                onClick={() =>
                  setDraft((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }))
                }
              >
                Remove section
              </Button>
            </div>
            {section.blocks.map((block, bi) => (
              <div
                key={bi}
                className="flex flex-col gap-2 rounded-lg border border-[var(--av2-border)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`block-${si}-${bi}-type`} className="sr-only">
                    Block type
                  </label>
                  <div className="w-48">
                    <Select
                      id={`block-${si}-${bi}-type`}
                      value={block.type}
                      onChange={(e) =>
                        updateBlock(si, bi, { type: e.target.value as GuideBlock["type"] })
                      }
                    >
                      {(Object.keys(BLOCK_LABEL) as GuideBlock["type"][]).map((type) => (
                        <option key={type} value={type}>
                          {BLOCK_LABEL[type]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateSection(si, { blocks: section.blocks.filter((_, i) => i !== bi) })
                    }
                  >
                    Remove block
                  </Button>
                </div>
                <label htmlFor={`block-${si}-${bi}`} className="sr-only">
                  {BLOCK_LABEL[block.type]} text
                </label>
                <TextArea
                  id={`block-${si}-${bi}`}
                  value={block.text}
                  rows={block.type === "p" ? 3 : 5}
                  onChange={(e) => updateBlock(si, bi, { text: e.target.value })}
                />
                <p className="text-xs text-[var(--av2-text-2)]">
                  {block.type === "steps"
                    ? "One step per line."
                    : block.type === "list"
                      ? `One item per line. Write "Term${TERM_SEPARATOR}what it means" for a definition.`
                      : "Use **double asterisks** for bold."}
                </p>
              </div>
            ))}
            <div>
              <Button
                size="sm"
                onClick={() =>
                  updateSection(si, { blocks: [...section.blocks, { type: "p", text: "" }] })
                }
              >
                Add block
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <div>
        <Button
          onClick={() =>
            setDraft((d) => ({
              ...d,
              sections: [...d.sections, { heading: "", blocks: [{ type: "p", text: "" }] }],
            }))
          }
        >
          Add section
        </Button>
      </div>

      {isCode && detail?.code && !edited && detail.status === "IN_SYNC" ? (
        <Callout tone="info" title="Written in code">
          Saving makes your version the one people see. Code changes to this guide will then come to
          you for review instead of showing up directly.
        </Callout>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-3">
        <SaveBar dirty={dirty}>
          {!isNew && detail ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  void call(
                    "PATCH",
                    { action: detail.hidden ? "show" : "hide" },
                    detail.hidden ? "Guide shown" : "Guide hidden",
                  )
                }
              >
                {detail.hidden ? "Show on the site" : "Hide from the site"}
              </Button>
              {isCode && edited ? (
                <Button disabled={busy} onClick={() => setConfirm("revert")}>
                  Go back to the code version
                </Button>
              ) : null}
              {!isCode ? (
                <Button variant="danger" disabled={busy} onClick={() => setConfirm("delete")}>
                  Delete guide
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            variant="primary"
            disabled={busy || (!dirty && !isNew) || (isNew && !newSlug.trim())}
            onClick={() =>
              isNew ? void create() : void call("PUT", { content: fromDraft(draft) }, "Guide saved")
            }
          >
            {isNew ? "Create guide" : "Save"}
          </Button>
        </SaveBar>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          void call(
            "DELETE",
            undefined,
            confirm === "delete" ? "Guide deleted" : "Back to the code version",
          )
        }
        loading={busy}
        title={confirm === "delete" ? "Delete this guide?" : "Go back to the code version?"}
        description={
          confirm === "delete"
            ? "It disappears from the Support hub and search. This can't be undone."
            : "Your edits to this guide are removed and the text written in code shows again. If the guide is hidden, it becomes visible."
        }
        confirmLabel={confirm === "delete" ? "Delete" : "Use the code version"}
      />
    </div>
  );
}
