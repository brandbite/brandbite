// -----------------------------------------------------------------------------
// @file: components/post-preview/post-preview.tsx
// @purpose: Post and ad preview, in three steps (content, preview, export):
//           a phone screen showing your visual as a post
//           in a feed or as a full-screen story, with your account's picture
//           and name, the caption cut where feeds cut it, like and comment
//           counts, and an ad version with a button. Download the screen as
//           a PNG or open it on a 3D phone in Mockup Studio. The screen is
//           drawn in the browser (lib/post-preview/draw.ts); nothing is
//           uploaded.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { DownloadIcon, UploadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  fetchBrandLogo,
  FilePicker,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import { StepHeading } from "@/components/tools/tool-page";
import { INPUT_IMAGE_TYPES, inputImageProblem } from "@/lib/image-tools/fit";
import { saveBlob } from "@/lib/image-tools/render";
import { LOGO_INPUT_TYPES, logoInputProblem } from "@/lib/logo-pack/pack";
import { canvasForHandoff, leaveForMockupStudio } from "@/lib/mockups/handoff";
import { drawPostScreen, SCREEN, type Picture } from "@/lib/post-preview/draw";
import {
  cleanCount,
  CTA_LABELS,
  DEFAULT_ENGAGEMENT,
  handleFrom,
  randomEngagement,
  type Engagement,
} from "@/lib/post-preview/engagement";
import { coveredEdges, fitNote, placements } from "@/lib/post-preview/placements";
import { keepWork, keptWork } from "@/lib/tools/keep";

const PLACEMENTS = placements();

type Loaded = Picture & { name: string; url: string; size?: number };

/** A file as a picture a canvas can draw. Works for SVG too, which has no pixel size of its own. */
function loadPicture(file: Blob, name: string): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        image,
        name,
        url,
        size: file.size,
        width: image.naturalWidth || 512,
        height: image.naturalHeight || 512,
      });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    image.src = url;
  });
}

const KEEP_KEY = "post-preview";

/** The work kept while the visitor is away in Mockup Studio (lib/tools/keep.ts). */
type Kept = {
  picture: Loaded | null;
  avatar: Loaded | null | undefined;
  placementId: string;
  typedName: string | null;
  typedHandle: string | null;
  caption: string;
  engagement: Engagement;
  showComments: boolean;
  kind: "post" | "ad";
  cta: string;
  dark: boolean;
  showCovered: boolean;
};

const COUNTS: { key: keyof Engagement; label: string }[] = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
];

const OUTLINE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--cs-brand)] bg-[var(--cs-surface)] px-4 text-sm leading-5 font-semibold whitespace-nowrap text-[var(--cs-brand-strong)] transition-colors hover:bg-[#FFF1EA]";
/** A row that opens the settings under it. */
const DISCLOSURE = `flex min-h-14 w-full items-center gap-3 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-left hover:border-[var(--cs-text)] ${TOOL_FOCUS}`;
/** A label beside its field. */
const ROW = "grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3";

const SUN =
  "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z";
const MOON = "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z";
const PHONE = "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2";

function Glyph({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
      <Glyph d="M6 9l6 6 6-6" />
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Instagram · Square post" → "Square post". */
function formatLabel(label: string): string {
  return label.split(" · ")[1] ?? label;
}

const PLATFORMS = [...new Set(PLACEMENTS.map((p) => p.platform))];

export function PostPreview() {
  const access = useToolAccess();
  const router = useRouter();
  const ids = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Coming back from Mockup Studio returns to the post as it was left.
  const [kept] = useState(() => keptWork<Kept>(KEEP_KEY));
  const [picture, setPicture] = useState<Loaded | null>(kept?.picture ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  // undefined: nothing chosen yet (a customer's brand logo may fill it); null: removed on purpose.
  const [avatar, setAvatar] = useState<Loaded | null | undefined>(kept ? kept.avatar : undefined);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [placementId, setPlacementId] = useState(kept?.placementId ?? PLACEMENTS[0]?.id ?? "");
  const [typedName, setTypedName] = useState<string | null>(kept?.typedName ?? null);
  const [typedHandle, setTypedHandle] = useState<string | null>(kept?.typedHandle ?? null);
  const [caption, setCaption] = useState(kept?.caption ?? "");
  const [engagement, setEngagement] = useState<Engagement>(kept?.engagement ?? DEFAULT_ENGAGEMENT);
  const [showComments, setShowComments] = useState(kept?.showComments ?? true);
  const [kind, setKind] = useState<"post" | "ad">(kept?.kind ?? "post");
  const [cta, setCta] = useState<string>(kept?.cta ?? CTA_LABELS[0]);
  const [dark, setDark] = useState(kept?.dark ?? false);
  const [showCovered, setShowCovered] = useState(kept?.showCovered ?? true);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);

  // A signed-in customer starts with their company's name and brand guide logo.
  const name = typedName ?? access.companyName ?? "";
  const shownName = name.trim() || "Your Brand";
  const handle = (typedHandle ?? handleFrom(name)).trim().replace(/^@+/, "") || "yourbrand";

  useEffect(() => {
    if (!access.hasBrandLogo || avatar !== undefined) return;
    let cancelled = false;
    void (async () => {
      const file = await fetchBrandLogo("icon");
      if (!file || cancelled) return;
      try {
        const loaded = await loadPicture(file, file.name);
        if (cancelled) URL.revokeObjectURL(loaded.url);
        else setAvatar((current) => (current === undefined ? loaded : current));
      } catch {
        // No logo to show; the avatar falls back to the name's first letter.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [access.hasBrandLogo, avatar]);

  // The pictures' addresses stay valid after leaving the page, so the kept
  // work can be shown again; an address is released when its picture is replaced.
  useEffect(() => {
    keepWork<Kept>(KEEP_KEY, {
      picture,
      avatar,
      placementId,
      typedName,
      typedHandle,
      caption,
      engagement,
      showComments,
      kind,
      cta,
      dark,
      showCovered,
    });
  }, [
    picture,
    avatar,
    placementId,
    typedName,
    typedHandle,
    caption,
    engagement,
    showComments,
    kind,
    cta,
    dark,
    showCovered,
  ]);

  const placement = useMemo(
    () => PLACEMENTS.find((p) => p.id === placementId) ?? PLACEMENTS[0],
    [placementId],
  );

  const screen = useMemo(
    () =>
      placement
        ? {
            placement,
            picture,
            avatar: avatar ?? null,
            name: shownName,
            handle,
            caption,
            engagement,
            showComments,
            ad: kind === "ad",
            cta,
            dark,
            showCovered,
          }
        : null,
    [
      placement,
      picture,
      avatar,
      shownName,
      handle,
      caption,
      engagement,
      showComments,
      kind,
      cta,
      dark,
      showCovered,
    ],
  );

  useEffect(() => {
    if (canvasRef.current && screen) drawPostScreen(canvasRef.current, screen);
  }, [screen]);

  const onPicture = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const problem = inputImageProblem(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    try {
      const loaded = await loadPicture(file, file.name);
      if (picture) URL.revokeObjectURL(picture.url);
      setPicture(loaded);
      setFileError(null);
    } catch {
      setFileError("We couldn't read that image. Try another file.");
    }
  };

  const onAvatar = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const problem = logoInputProblem(file);
    if (problem) {
      setAvatarError(problem);
      return;
    }
    try {
      const loaded = await loadPicture(file, file.name);
      if (avatar) URL.revokeObjectURL(avatar.url);
      setAvatar(loaded);
      setAvatarError(null);
    } catch {
      setAvatarError("We couldn't read that file. Try another one.");
    }
  };

  /** The screen as it should leave the page: without the covered-area shading. */
  const cleanCanvas = (): HTMLCanvasElement | null => {
    if (!screen) return null;
    const canvas = document.createElement("canvas");
    drawPostScreen(canvas, { ...screen, showCovered: false });
    return canvas;
  };

  const download = () => {
    const canvas = cleanCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) saveBlob(blob, "post-preview.png");
      else setExportError("We couldn't make the PNG. Try a smaller image.");
    }, "image/png");
  };

  const openInMockupStudio = () => {
    const canvas = cleanCanvas();
    const dataUrl = canvas ? canvasForHandoff(canvas) : null;
    if (
      !dataUrl ||
      !leaveForMockupStudio({
        dataUrl,
        name: "Post preview",
        device: "phone",
        returnTo: "/post-preview",
      })
    ) {
      setExportError(
        "We couldn't pass the screen to Mockup Studio. Download the PNG and add it there.",
      );
      return;
    }
    router.push("/mockups");
  };

  if (!placement) return null;
  const covered = coveredEdges(placement);
  const story = placement.kind === "story";
  const formats = PLACEMENTS.filter((p) => p.platform === placement.platform);
  const typedHandleValue = typedHandle ?? handleFrom(name);

  const choosePlatform = (platform: string) => {
    const first = PLACEMENTS.find((p) => p.platform === platform);
    if (first) setPlacementId(first.id);
  };

  return (
    <section aria-label="Post and ad preview" className="flex flex-col gap-8">
      <div className="grid grid-cols-[440px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
        <div>
          <StepHeading
            number={1}
            title="Content"
            hint="Add your content and choose how it should appear."
          />
          <div className={`mt-4 flex flex-col gap-5 ${TOOL_PANEL}`}>
            <div>
              {picture ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a file on the visitor's device */}
                  <img
                    src={picture.url}
                    alt=""
                    width={112}
                    height={112}
                    className="h-28 w-28 shrink-0 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base leading-6 font-semibold">{picture.name}</p>
                    <p className={`${TOOL_HINT} tabular-nums`}>
                      {picture.width} × {picture.height}
                      {picture.size ? ` · ${formatSize(picture.size)}` : ""}
                    </p>
                    <p className={TOOL_HINT}>Max 25 MB</p>
                    <div className="mt-2">
                      <FilePicker
                        label="Replace"
                        accept={INPUT_IMAGE_TYPES}
                        onFiles={(files) => void onPicture(files)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor={`${ids}-file`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void onPicture(Array.from(event.dataTransfer.files));
                  }}
                  className={`flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-within:border-[var(--cs-text)] ${
                    dragging
                      ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                      : "border-[#B9B5AE] hover:border-[var(--cs-text)]"
                  }`}
                >
                  <input
                    id={`${ids}-file`}
                    type="file"
                    accept={INPUT_IMAGE_TYPES.join(",")}
                    className="sr-only"
                    onChange={(event) => {
                      void onPicture(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                  />
                  <span
                    aria-hidden
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                  >
                    <UploadIcon />
                  </span>
                  <span className="mt-3 text-base leading-6 font-semibold">
                    Drag and drop your image here
                  </span>
                  <span className={TOOL_HINT}>or click to choose a file</span>
                  <span className={`mt-3 ${TOOL_HINT}`}>
                    PNG, JPG or WebP, up to 25 MB. It stays in your browser.
                  </span>
                </label>
              )}
              {fileError ? (
                <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
                  {fileError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--cs-border)] pt-5">
              <div className={ROW}>
                <label htmlFor={`${ids}-platform`} className={TOOL_LABEL}>
                  Platform
                </label>
                <select
                  id={`${ids}-platform`}
                  value={placement.platform}
                  onChange={(event) => choosePlatform(event.target.value)}
                  className={TOOL_INPUT}
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
              </div>
              <div className={ROW}>
                <label htmlFor={`${ids}-format`} className={TOOL_LABEL}>
                  Format
                </label>
                <select
                  id={`${ids}-format`}
                  value={placement.id}
                  onChange={(event) => setPlacementId(event.target.value)}
                  className={TOOL_INPUT}
                >
                  {formats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {formatLabel(format.label)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={ROW}>
                <label htmlFor={`${ids}-kind`} className={TOOL_LABEL}>
                  Post/Ad
                </label>
                <select
                  id={`${ids}-kind`}
                  value={kind}
                  onChange={(event) => setKind(event.target.value === "ad" ? "ad" : "post")}
                  className={TOOL_INPUT}
                >
                  <option value="post">Post</option>
                  <option value="ad">Ad</option>
                </select>
              </div>
              {kind === "ad" ? (
                <>
                  <div className={ROW}>
                    <label htmlFor={`${ids}-cta`} className={TOOL_LABEL}>
                      Button
                    </label>
                    <select
                      id={`${ids}-cta`}
                      value={cta}
                      onChange={(event) => setCta(event.target.value)}
                      className={TOOL_INPUT}
                    >
                      {CTA_LABELS.map((label) => (
                        <option key={label}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <p className={TOOL_HINT}>
                    An ad shows “Sponsored” under the name and a button with the picture.
                  </p>
                </>
              ) : null}
            </div>

            {story ? null : (
              <div>
                <label htmlFor={`${ids}-caption`} className={TOOL_LABEL}>
                  Caption
                </label>
                <textarea
                  id={`${ids}-caption`}
                  value={caption}
                  rows={3}
                  maxLength={2200}
                  placeholder="Write the caption to see where it gets cut."
                  onChange={(event) => setCaption(event.target.value)}
                  className={`mt-2 ${TOOL_INPUT} h-auto resize-y py-2.5`}
                />
                <p className={`mt-2 ${TOOL_HINT}`}>
                  Feeds show the first lines and hide the rest behind “more”. Put what matters
                  first.
                </p>
              </div>
            )}

            <div>
              <p className={TOOL_LABEL}>Account</p>
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-controls={`${ids}-account`}
                onClick={() => setAccountOpen((open) => !open)}
                className={`mt-2 ${DISCLOSURE}`}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--cs-border)] bg-[#FFE9DF] text-base font-semibold text-[var(--cs-brand-strong)]"
                >
                  {avatar ? (
                    // A local preview of the visitor's own file or their own brand logo.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar.url} alt="" className="max-h-[72%] max-w-[72%]" />
                  ) : (
                    (shownName[0] ?? "Y").toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm leading-5 font-semibold">
                    {shownName}
                  </span>
                  <span className={`block truncate ${TOOL_HINT}`}>@{handle}</span>
                </span>
                <span className="sr-only">Edit account</span>
                <Chevron open={accountOpen} />
              </button>
              <fieldset
                id={`${ids}-account`}
                className={accountOpen ? "mt-3 flex flex-col gap-3" : "hidden"}
              >
                <legend className="sr-only">Account details</legend>
                <div className="flex flex-wrap items-center gap-3">
                  <FilePicker
                    label={avatar ? "Change picture" : "Add a profile picture"}
                    accept={LOGO_INPUT_TYPES}
                    onFiles={(files) => void onAvatar(files)}
                  />
                  {avatar ? (
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(avatar.url);
                        setAvatar(null);
                      }}
                      className={`min-h-11 rounded text-sm font-medium underline underline-offset-2 ${TOOL_FOCUS}`}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                {avatarError ? (
                  <p role="alert" className={TOOL_ERROR}>
                    {avatarError}
                  </p>
                ) : null}
                <div>
                  <label htmlFor={`${ids}-name`} className="text-sm leading-5 font-medium">
                    Name
                  </label>
                  <input
                    id={`${ids}-name`}
                    value={name}
                    maxLength={40}
                    placeholder="Your Brand"
                    onChange={(event) => setTypedName(event.target.value)}
                    className={`mt-1 ${TOOL_INPUT}`}
                  />
                </div>
                <div>
                  <label htmlFor={`${ids}-handle`} className="text-sm leading-5 font-medium">
                    Username
                  </label>
                  <input
                    id={`${ids}-handle`}
                    value={typedHandleValue}
                    maxLength={30}
                    placeholder="yourbrand"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => setTypedHandle(event.target.value)}
                    className={`mt-1 ${TOOL_INPUT}`}
                  />
                </div>
                {access.signedIn && access.companyName ? (
                  <p className={TOOL_HINT}>
                    Filled in from your company
                    {access.hasBrandLogo ? " and your brand guide logo" : ""}. Change anything you
                    like.
                  </p>
                ) : null}
              </fieldset>
            </div>

            {story ? (
              covered ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
                  <input
                    type="checkbox"
                    checked={showCovered}
                    onChange={(event) => setShowCovered(event.target.checked)}
                    className="h-5 w-5 accent-[var(--cs-selected)]"
                  />
                  Show the areas the app covers
                </label>
              ) : null
            ) : (
              <>
                <fieldset>
                  <legend className={TOOL_LABEL}>Appearance</legend>
                  <div className="mt-2 flex gap-1 rounded-[10px] border border-[var(--cs-border)] p-1">
                    {(
                      [
                        { id: false, label: "Light", icon: SUN },
                        { id: true, label: "Dark", icon: MOON },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={dark === option.id}
                        onClick={() => setDark(option.id)}
                        className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${TOOL_FOCUS} ${
                          dark === option.id
                            ? "bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                            : "hover:bg-[var(--cs-background)]"
                        }`}
                      >
                        <Glyph d={option.icon} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <p className={TOOL_LABEL}>Sample engagement</p>
                  <button
                    type="button"
                    aria-expanded={numbersOpen}
                    aria-controls={`${ids}-numbers`}
                    onClick={() => setNumbersOpen((open) => !open)}
                    className={`mt-2 ${DISCLOSURE} !min-h-12 flex-wrap text-sm leading-5 font-medium tabular-nums`}
                  >
                    <span>{engagement.likes.toLocaleString("en-US")} likes</span>
                    <span aria-hidden className="text-[var(--cs-muted)]">
                      ·
                    </span>
                    <span>{engagement.comments.toLocaleString("en-US")} comments</span>
                    <span aria-hidden className="text-[var(--cs-muted)]">
                      ·
                    </span>
                    <span>{engagement.shares.toLocaleString("en-US")} shares</span>
                    <span className="sr-only">Edit the numbers</span>
                    <Chevron open={numbersOpen} />
                  </button>
                  <fieldset id={`${ids}-numbers`} className={numbersOpen ? "mt-3" : "hidden"}>
                    <legend className="sr-only">Sample numbers</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {COUNTS.map((count) => (
                        <div key={count.key}>
                          <label
                            htmlFor={`${ids}-${count.key}`}
                            className="text-sm leading-5 font-medium"
                          >
                            {count.label}
                          </label>
                          <input
                            id={`${ids}-${count.key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={engagement[count.key]}
                            onChange={(event) =>
                              setEngagement((current) => ({
                                ...current,
                                [count.key]: cleanCount(event.target.value),
                              }))
                            }
                            className={`mt-1 ${TOOL_INPUT} tabular-nums`}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEngagement(randomEngagement())}
                      className={`mt-3 ${studioButtonClasses("secondary")}`}
                    >
                      Shuffle the numbers
                    </button>
                    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
                      <input
                        type="checkbox"
                        checked={showComments}
                        onChange={(event) => setShowComments(event.target.checked)}
                        className="h-5 w-5 accent-[var(--cs-selected)]"
                      />
                      Show sample comments
                    </label>
                  </fieldset>
                  <p className={`mt-2 ${TOOL_HINT}`}>
                    Made-up numbers, so the post looks the way it will once people react to it.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="min-[1024px]:sticky min-[1024px]:top-6">
          <StepHeading number={2} title="Preview" hint="See how it sits in the feed." />
          <div
            className={`mt-4 ${TOOL_PANEL} flex flex-col items-center !bg-[var(--cs-background)]`}
          >
            <div className="w-[320px] max-w-full rounded-[44px] bg-[#1c1b1f] p-[10px] shadow-lg">
              <canvas
                ref={canvasRef}
                width={SCREEN.width}
                height={SCREEN.height}
                role="img"
                aria-label={`Preview of your ${kind === "ad" ? "ad" : "post"} as ${placement.label}, from ${shownName}`}
                className="block h-auto w-full rounded-[34px]"
              />
            </div>
            <p className="mt-5 text-center text-sm leading-5 font-semibold tabular-nums">
              {placement.label} · {placement.width} × {placement.height}
            </p>
            <p className={`mt-1 max-w-[420px] text-center ${TOOL_HINT}`}>
              {picture
                ? fitNote(picture.width, picture.height, placement)
                : "Add an image to see how it fits."}
            </p>
            {story && covered ? (
              <p className={`mt-1 max-w-[420px] text-center ${TOOL_HINT}`}>{covered.note}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <StepHeading number={3} title="Export" hint="Save your preview or open it in a mockup." />
        <div className={`mt-4 ${TOOL_PANEL}`}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <button
              type="button"
              onClick={download}
              className={`${studioButtonClasses("primary")} !h-12 !px-6`}
            >
              <DownloadIcon />
              Download PNG
            </button>
            <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-4 min-[1024px]:border-l min-[1024px]:border-[var(--cs-border)] min-[1024px]:pl-8">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
              >
                <Glyph d={PHONE} size={24} />
              </span>
              <div className="min-w-[180px] flex-1">
                <p className="text-base leading-6 font-semibold">Open on a 3D phone</p>
                <p className={TOOL_HINT}>
                  Turn the phone, change the scene and download a picture or a video.
                </p>
              </div>
              <button type="button" onClick={openInMockupStudio} className={OUTLINE}>
                Open Mockup Studio
                <Glyph d="M5 12h14M13 6l6 6-6 6" />
              </button>
            </div>
          </div>
          {exportError ? (
            <p role="alert" className={`mt-3 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}
          <p className={`mt-4 border-t border-[var(--cs-border)] pt-3 ${TOOL_HINT}`}>
            Need the image in this shape?{" "}
            <Link href="/social-resizer" className="font-semibold text-[var(--cs-text)] underline">
              Open the social resizer
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
