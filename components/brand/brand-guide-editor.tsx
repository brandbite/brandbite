// -----------------------------------------------------------------------------
// @file: components/brand/brand-guide-editor.tsx
// @purpose: The customer's brand guide: who the brand is, how it sounds, its
//           colors and fonts, and its files. Owners and project managers
//           edit; other members read. Text saves with one Save; files upload
//           and change straight away.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { IconImage } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  Field,
  PageHeader,
  SaveBar,
  Select,
  Skeleton,
  TextArea,
  TextInput,
} from "@/components/admin/v2/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import {
  BRAND_COLOR_ROLES,
  BRAND_FONT_ROLES,
  type BrandColor,
  type BrandColorRole,
  type BrandFont,
  type BrandFontRole,
} from "@/lib/brand/brand-data";
import {
  BRAND_ASSET_BACKGROUND_LABELS,
  BRAND_ASSET_BACKGROUNDS,
  BRAND_ASSET_KIND_LABELS,
  BRAND_ASSET_KINDS,
  BRAND_FILE_ACCEPT,
  BRAND_FILE_TYPES_LABEL,
  brandFileProblem,
  fileExtension,
  type BrandAssetBackgroundValue,
  type BrandAssetKindValue,
} from "@/lib/brand/brand-files";
import { BRAND_LIMITS } from "@/lib/brand/brand-schema";
import { parseOpaqueHex } from "@/lib/colors/convert";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Guide = {
  name: string;
  tagline: string;
  description: string;
  audience: string;
  values: string;
  references: string;
  toneWords: string;
  voiceNotes: string;
  voiceDo: string;
  voiceDont: string;
  wordsToUse: string;
  wordsToAvoid: string;
  sampleCopy: string;
  imageryNotes: string;
  colors: BrandColor[];
  fonts: BrandFont[];
};

type BrandFile = {
  id: string;
  kind: BrandAssetKindValue;
  background: BrandAssetBackgroundValue;
  label: string | null;
  name: string;
  sizeBytes: number;
  previewUrl: string | null;
};

const LIST_KEYS = [
  "values",
  "toneWords",
  "voiceDo",
  "voiceDont",
  "wordsToUse",
  "wordsToAvoid",
] as const;
const TEXT_KEYS = [
  "name",
  "tagline",
  "description",
  "audience",
  "references",
  "voiceNotes",
  "sampleCopy",
  "imageryNotes",
] as const;

const ROLE_LABELS: Record<BrandColorRole | BrandFontRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
  heading: "Headings",
  body: "Body text",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** One entry per line in the editor; an array on the server. */
const toLines = (items: unknown): string =>
  Array.isArray(items) ? items.filter((item) => typeof item === "string").join("\n") : "";
const fromLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function toGuide(brand: Record<string, unknown>): Guide {
  const guide = { colors: brand.colors ?? [], fonts: brand.fonts ?? [] } as Guide;
  for (const key of TEXT_KEYS) guide[key] = typeof brand[key] === "string" ? brand[key] : "";
  for (const key of LIST_KEYS) guide[key] = toLines(brand[key]);
  return guide;
}

function toPayload(guide: Guide) {
  const payload: Record<string, unknown> = { colors: guide.colors, fonts: guide.fonts };
  for (const key of TEXT_KEYS) payload[key] = guide[key];
  for (const key of LIST_KEYS) payload[key] = fromLines(guide[key]);
  return payload;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

async function readError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandGuideEditor() {
  const id = useId();
  const { showToast } = useToast();

  const [saved, setSaved] = useState<Guide | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploadKind, setUploadKind] = useState<BrandAssetKindValue>("LOGO_PRIMARY");
  const [uploading, setUploading] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BrandFile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/brand", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Could not load the brand guide."));
      const json = await res.json();
      const next = toGuide(json.brand ?? {});
      setSaved(next);
      setGuide(next);
      setFiles(json.assets ?? []);
      setCanEdit(json.canEdit === true);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the brand guide.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => !!guide && !!saved && JSON.stringify(guide) !== JSON.stringify(saved),
    [guide, saved],
  );

  // Don't lose typed text to a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Guide>(key: K, value: Guide[K]) =>
    setGuide((prev) => (prev ? { ...prev, [key]: value } : prev));

  const badColor = guide?.colors.find((color) => !parseOpaqueHex(color.hex));
  const badFont = guide?.fonts.find((font) => !font.name.trim());

  const save = async () => {
    if (!guide || saving) return;
    if (guide.name.trim().length < 2) return setSaveError("Give the brand a name.");
    if (badColor) return setSaveError("Every color needs a valid hex code, like #1F3A5F.");
    if (badFont)
      return setSaveError("Every font needs a name. Remove the empty row or fill it in.");
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/customer/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(guide)),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not save the brand guide."));
      const next = toGuide((await res.json()).brand ?? {});
      setSaved(next);
      setGuide(next);
      showToast({ type: "success", title: "Brand guide saved" });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the brand guide.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Files ---------------------------------------------------------------

  const upload = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setFileError(null);
    for (const file of Array.from(picked)) {
      const problem = brandFileProblem(file);
      if (problem) {
        setFileError(`${file.name}: ${problem}`);
        continue;
      }
      setUploading(file.name);
      try {
        const start = await fetch("/api/customer/brand/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, sizeBytes: file.size, kind: uploadKind }),
        });
        if (!start.ok) throw new Error(await readError(start, "Could not start the upload."));
        const { assetId, uploadUrl, contentType } = await start.json();

        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!put.ok) throw new Error("The upload didn't go through. Please try again.");

        const done = await fetch(`/api/customer/brand/assets/${assetId}/complete`, {
          method: "POST",
        });
        if (!done.ok) throw new Error(await readError(done, "Could not finish the upload."));
        const { asset } = await done.json();
        setFiles((prev) => [...prev, asset]);
      } catch (error) {
        setFileError(
          `${file.name}: ${error instanceof Error ? error.message : "The upload failed."}`,
        );
      }
    }
    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const updateFile = async (
    file: BrandFile,
    change: Partial<Pick<BrandFile, "kind" | "background">>,
  ) => {
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, ...change } : f)));
    const res = await fetch(`/api/customer/brand/assets/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (!res.ok) {
      setFiles((prev) => prev.map((f) => (f.id === file.id ? file : f)));
      setFileError(await readError(res, "Could not update the file."));
    }
  };

  const download = async (file: BrandFile) => {
    setFileError(null);
    const res = await fetch(`/api/customer/brand/assets/${file.id}/download`, {
      cache: "no-store",
    });
    if (!res.ok) return setFileError(await readError(res, "Could not download the file."));
    const { url } = await res.json();
    window.location.assign(url);
  };

  const remove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    const res = await fetch(`/api/customer/brand/assets/${removing.id}`, { method: "DELETE" });
    setRemoveBusy(false);
    if (!res.ok) {
      setFileError(await readError(res, "Could not remove the file."));
    } else {
      setFiles((prev) => prev.filter((f) => f.id !== removing.id));
    }
    setRemoving(null);
  };

  // ---- Render --------------------------------------------------------------

  const header = (
    <PageHeader
      title="Brand guide"
      description="Your logo files, colors, fonts and the way your brand talks. Your creatives and our AI tools work from this."
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <Callout
          tone="error"
          title="The brand guide didn't load"
          action={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Callout>
      </>
    );
  }

  if (!guide) {
    return (
      <>
        {header}
        <div className="space-y-6" aria-busy="true" aria-label="Loading the brand guide">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  const text = (key: (typeof TEXT_KEYS)[number], max: number) => ({
    id: `${id}-${key}`,
    value: guide[key],
    maxLength: max,
    readOnly: !canEdit,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });
  const lines = (key: (typeof LIST_KEYS)[number]) => ({
    id: `${id}-${key}`,
    value: guide[key],
    readOnly: !canEdit,
    rows: 3,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });
  const ONE_PER_LINE = "One per line.";

  return (
    <>
      {header}

      {!canEdit && (
        <div className="mb-6">
          <Callout title="You can read this guide">
            Company owners and project managers can change it.
          </Callout>
        </div>
      )}

      <div className="space-y-6 pb-28">
        {/* Identity */}
        <Card>
          <CardTitle description="The short version of who you are. It starts every brief.">
            About the brand
          </CardTitle>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Brand name" htmlFor={`${id}-name`}>
              <TextInput {...text("name", BRAND_LIMITS.name)} />
            </Field>
            <Field label="Tagline" htmlFor={`${id}-tagline`}>
              <TextInput {...text("tagline", BRAND_LIMITS.short)} />
            </Field>
            <Field
              label="What you do"
              htmlFor={`${id}-description`}
              hint="Two or three sentences, the way you'd tell a new hire."
              className="md:col-span-2"
            >
              <TextArea {...text("description", BRAND_LIMITS.long)} rows={3} />
            </Field>
            <Field
              label="Who it's for"
              htmlFor={`${id}-audience`}
              hint="Your customers: who they are and what they care about."
            >
              <TextArea {...text("audience", BRAND_LIMITS.long)} rows={3} />
            </Field>
            <Field label="Values" htmlFor={`${id}-values`} hint={ONE_PER_LINE}>
              <TextArea {...lines("values")} />
            </Field>
            <Field
              label="Competitors and brands you like"
              htmlFor={`${id}-references`}
              hint="Names or links, and what you like or don't like about them."
              className="md:col-span-2"
            >
              <TextArea {...text("references", BRAND_LIMITS.long)} rows={3} />
            </Field>
          </div>
        </Card>

        {/* Language */}
        <Card>
          <CardTitle description="How the brand sounds in writing. Copy and briefs follow this.">
            Brand language
          </CardTitle>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field
              label="Tone words"
              htmlFor={`${id}-toneWords`}
              hint="Three to five words, like warm, direct, playful. One per line."
            >
              <TextArea {...lines("toneWords")} />
            </Field>
            <Field
              label="Voice notes"
              htmlFor={`${id}-voiceNotes`}
              hint="Anything else about how you write."
            >
              <TextArea {...text("voiceNotes", BRAND_LIMITS.long)} rows={3} />
            </Field>
            <Field label="Write like this" htmlFor={`${id}-voiceDo`} hint={ONE_PER_LINE}>
              <TextArea {...lines("voiceDo")} />
            </Field>
            <Field label="Never write like this" htmlFor={`${id}-voiceDont`} hint={ONE_PER_LINE}>
              <TextArea {...lines("voiceDont")} />
            </Field>
            <Field label="Words to use" htmlFor={`${id}-wordsToUse`} hint={ONE_PER_LINE}>
              <TextArea {...lines("wordsToUse")} />
            </Field>
            <Field label="Words to avoid" htmlFor={`${id}-wordsToAvoid`} hint={ONE_PER_LINE}>
              <TextArea {...lines("wordsToAvoid")} />
            </Field>
            <Field
              label="Sample copy"
              htmlFor={`${id}-sampleCopy`}
              hint="A few lines that sound exactly right."
              className="md:col-span-2"
            >
              <TextArea {...text("sampleCopy", BRAND_LIMITS.long)} rows={4} />
            </Field>
          </div>
        </Card>

        {/* Colors */}
        <Card>
          <CardTitle
            description="Hex codes, with a name and a role when you have them."
            action={
              canEdit && guide.colors.length < BRAND_LIMITS.colors ? (
                <Button
                  size="sm"
                  onClick={() =>
                    set("colors", [...guide.colors, { id: newId("color"), hex: "#000000" }])
                  }
                >
                  Add color
                </Button>
              ) : undefined
            }
          >
            Colors
          </CardTitle>
          {guide.colors.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--av2-text-2)]">No colors yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {guide.colors.map((color, index) => {
                const valid = parseOpaqueHex(color.hex);
                const change = (patch: Partial<BrandColor>) =>
                  set(
                    "colors",
                    guide.colors.map((c) => (c.id === color.id ? { ...c, ...patch } : c)),
                  );
                return (
                  <li key={color.id} className="flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      aria-label={`Color ${index + 1} picker`}
                      value={valid ?? "#000000"}
                      disabled={!canEdit}
                      onChange={(event) => change({ hex: event.target.value })}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--av2-border)] bg-transparent p-1 disabled:cursor-default"
                    />
                    <TextInput
                      aria-label={`Color ${index + 1} hex code`}
                      aria-invalid={!valid}
                      value={color.hex}
                      readOnly={!canEdit}
                      maxLength={7}
                      onChange={(event) => change({ hex: event.target.value })}
                      className="w-28 font-mono"
                    />
                    <TextInput
                      aria-label={`Color ${index + 1} name`}
                      placeholder="Name (optional)"
                      value={color.name ?? ""}
                      readOnly={!canEdit}
                      maxLength={60}
                      onChange={(event) => change({ name: event.target.value })}
                      className="min-w-40 flex-1"
                    />
                    <div className="w-40">
                      <Select
                        aria-label={`Color ${index + 1} role`}
                        value={color.role ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          change({ role: (event.target.value || undefined) as BrandColorRole })
                        }
                      >
                        <option value="">No role</option>
                        {BRAND_COLOR_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove color ${index + 1}`}
                        onClick={() =>
                          set(
                            "colors",
                            guide.colors.filter((c) => c.id !== color.id),
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Fonts */}
        <Card>
          <CardTitle
            description="Font names and where to get them. Add a link instead of a font file, since most font licences don't allow sharing the file."
            action={
              canEdit && guide.fonts.length < BRAND_LIMITS.fonts ? (
                <Button
                  size="sm"
                  onClick={() => set("fonts", [...guide.fonts, { id: newId("font"), name: "" }])}
                >
                  Add font
                </Button>
              ) : undefined
            }
          >
            Fonts
          </CardTitle>
          {guide.fonts.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--av2-text-2)]">No fonts yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {guide.fonts.map((font, index) => {
                const change = (patch: Partial<BrandFont>) =>
                  set(
                    "fonts",
                    guide.fonts.map((f) => (f.id === font.id ? { ...f, ...patch } : f)),
                  );
                return (
                  <li key={font.id} className="flex flex-wrap items-center gap-3">
                    <TextInput
                      aria-label={`Font ${index + 1} name`}
                      placeholder="Font name"
                      value={font.name}
                      readOnly={!canEdit}
                      maxLength={80}
                      onChange={(event) => change({ name: event.target.value })}
                      className="min-w-40 flex-1"
                    />
                    <div className="w-40">
                      <Select
                        aria-label={`Font ${index + 1} role`}
                        value={font.role ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          change({ role: (event.target.value || undefined) as BrandFontRole })
                        }
                      >
                        <option value="">No role</option>
                        {BRAND_FONT_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <TextInput
                      aria-label={`Font ${index + 1} link`}
                      placeholder="https:// link (optional)"
                      type="url"
                      value={font.url ?? ""}
                      readOnly={!canEdit}
                      maxLength={500}
                      onChange={(event) => change({ url: event.target.value })}
                      className="min-w-40 flex-1"
                    />
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove font ${index + 1}`}
                        onClick={() =>
                          set(
                            "fonts",
                            guide.fonts.filter((f) => f.id !== font.id),
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Imagery */}
        <Card>
          <CardTitle description="The kind of photos and illustrations that fit, and what to stay away from.">
            Imagery
          </CardTitle>
          <div className="mt-5">
            <Field label="Imagery notes" htmlFor={`${id}-imageryNotes`}>
              <TextArea {...text("imageryNotes", BRAND_LIMITS.long)} rows={3} />
            </Field>
          </div>
        </Card>

        {/* Files */}
        <Card>
          <CardTitle description="Logo files and your guidelines document. Creatives download the originals from here, so add vector files (SVG, AI, EPS) when you have them.">
            Brand files
          </CardTitle>

          {canEdit && (
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <Field label="What is it?" htmlFor={`${id}-uploadKind`} className="w-56">
                <Select
                  id={`${id}-uploadKind`}
                  value={uploadKind}
                  onChange={(event) => setUploadKind(event.target.value as BrandAssetKindValue)}
                >
                  {BRAND_ASSET_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {BRAND_ASSET_KIND_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              </Field>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={BRAND_FILE_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => void upload(event.target.files)}
              />
              <Button
                variant="primary"
                disabled={uploading !== null}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? "Uploading…" : "Upload files"}
              </Button>
              <p className="w-full text-xs text-[var(--av2-text-2)]">
                {BRAND_FILE_TYPES_LABEL}. Up to 200 MB each.
              </p>
            </div>
          )}

          <p role="status" className="sr-only">
            {uploading ? `Uploading ${uploading}` : ""}
          </p>

          {fileError && (
            <div className="mt-4">
              <Callout tone="error" title="That didn't work">
                {fileError}
              </Callout>
            </div>
          )}

          {files.length === 0 ? (
            <EmptyState
              icon={<IconImage />}
              title="No brand files yet"
              description={
                canEdit
                  ? "Upload your logo so creatives never have to ask for it."
                  : "Nobody has uploaded logo files yet."
              }
            />
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex min-w-0 flex-col rounded-xl border border-[var(--av2-border)]"
                >
                  <div
                    className={
                      "flex h-36 items-center justify-center rounded-t-xl p-4 " +
                      (file.background === "DARK" ? "bg-[#17171a]" : "bg-[#f4f4f5]")
                    }
                  >
                    {file.previewUrl ? (
                      // Uploaded files are only ever shown through <img>, which never runs scripts.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.previewUrl}
                        alt={`${BRAND_ASSET_KIND_LABELS[file.kind]}: ${file.name}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span
                        className={
                          "rounded-md px-2 py-1 font-mono text-sm font-semibold uppercase " +
                          (file.background === "DARK" ? "text-white" : "text-[#3f3f46]")
                        }
                      >
                        {fileExtension(file.name) || "file"}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-[var(--av2-text-2)]">
                        {canEdit
                          ? formatBytes(file.sizeBytes)
                          : `${BRAND_ASSET_KIND_LABELS[file.kind]} · ${formatBytes(file.sizeBytes)}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="grid gap-2">
                        <Select
                          aria-label={`What ${file.name} is`}
                          value={file.kind}
                          onChange={(event) =>
                            void updateFile(file, {
                              kind: event.target.value as BrandAssetKindValue,
                            })
                          }
                        >
                          {BRAND_ASSET_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {BRAND_ASSET_KIND_LABELS[kind]}
                            </option>
                          ))}
                        </Select>
                        <Select
                          aria-label={`Background ${file.name} is made for`}
                          value={file.background}
                          onChange={(event) =>
                            void updateFile(file, {
                              background: event.target.value as BrandAssetBackgroundValue,
                            })
                          }
                        >
                          {BRAND_ASSET_BACKGROUNDS.map((background) => (
                            <option key={background} value={background}>
                              {BRAND_ASSET_BACKGROUND_LABELS[background]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void download(file)}>
                        Download
                      </Button>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(file)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 py-3 sm:-mx-6 sm:px-6">
          {saveError && (
            <p role="alert" className="mb-2 text-sm text-[var(--av2-error-text)]">
              {saveError}
            </p>
          )}
          <SaveBar dirty={dirty}>
            <Button disabled={!dirty || saving} onClick={() => saved && setGuide(saved)}>
              Discard
            </Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save brand guide"}
            </Button>
          </SaveBar>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
        title="Remove this file?"
        description={
          removing
            ? `${removing.name} will be deleted from the brand guide. Creatives won't be able to download it any more.`
            : undefined
        }
        confirmLabel="Remove"
        loading={removeBusy}
      />
    </>
  );
}
