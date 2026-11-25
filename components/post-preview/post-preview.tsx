// -----------------------------------------------------------------------------
// @file: components/post-preview/post-preview.tsx
// @purpose: Post and ad preview: a phone screen showing your visual as a post
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
  Segmented,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
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

type Loaded = Picture & { name: string; url: string };

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

  return (
    <section
      aria-label="Post and ad preview"
      className="grid grid-cols-[400px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1"
    >
      <div className={`flex flex-col gap-6 ${TOOL_PANEL}`}>
        <div>
          <p className={TOOL_LABEL}>Visual</p>
          <div className="mt-2">
            <FilePicker
              label={picture ? "Change image" : "Choose an image"}
              accept={INPUT_IMAGE_TYPES}
              onFiles={(files) => void onPicture(files)}
            >
              <UploadIcon />
            </FilePicker>
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            {picture
              ? `${picture.name} · ${picture.width} × ${picture.height}`
              : "PNG, JPG or WebP, up to 25 MB. It stays in your browser."}
          </p>
          {fileError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {fileError}
            </p>
          ) : null}
        </div>

        <Segmented
          label="Where it will appear"
          options={PLACEMENTS.map((p) => ({ id: p.id, label: p.label }))}
          value={placement.id}
          onChange={setPlacementId}
        />

        <div>
          <Segmented<"post" | "ad">
            label="Type"
            options={[
              { id: "post", label: "Post" },
              { id: "ad", label: "Ad" },
            ]}
            value={kind}
            onChange={setKind}
          />
          {kind === "ad" ? (
            <div className="mt-3">
              <label htmlFor={`${ids}-cta`} className={TOOL_LABEL}>
                Button
              </label>
              <select
                id={`${ids}-cta`}
                value={cta}
                onChange={(event) => setCta(event.target.value)}
                className={`mt-2 ${TOOL_INPUT}`}
              >
                {CTA_LABELS.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
              <p className={`mt-2 ${TOOL_HINT}`}>
                An ad shows “Sponsored” under the name and a button with the picture.
              </p>
            </div>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className={TOOL_LABEL}>Account</legend>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--cs-border)] bg-white text-base font-semibold text-[#292827]"
            >
              {avatar ? (
                // A local preview of the visitor's own file or their own brand logo.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar.url} alt="" className="max-h-[72%] max-w-[72%]" />
              ) : (
                (shownName[0] ?? "Y").toUpperCase()
              )}
            </span>
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
              value={typedHandle ?? handleFrom(name)}
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
              Filled in from your company{access.hasBrandLogo ? " and your brand guide logo" : ""}.
              Change anything you like.
            </p>
          ) : null}
        </fieldset>

        {story ? null : (
          <div>
            <label htmlFor={`${ids}-caption`} className={TOOL_LABEL}>
              Caption
            </label>
            <textarea
              id={`${ids}-caption`}
              value={caption}
              rows={4}
              maxLength={2200}
              placeholder="Write the caption to see where it gets cut."
              onChange={(event) => setCaption(event.target.value)}
              className={`mt-2 ${TOOL_INPUT} h-auto resize-y py-2.5`}
            />
            <p className={`mt-2 ${TOOL_HINT}`}>
              Feeds show the first lines and hide the rest behind “more”. Put what matters first.
            </p>
          </div>
        )}

        {story ? (
          covered ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
              <input
                type="checkbox"
                checked={showCovered}
                onChange={(event) => setShowCovered(event.target.checked)}
                className="h-5 w-5 accent-[var(--cs-text)]"
              />
              Show the areas the app covers
            </label>
          ) : null
        ) : (
          <>
            <fieldset>
              <legend className={TOOL_LABEL}>Numbers</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
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
              <p className={`mt-2 ${TOOL_HINT}`}>
                Made-up numbers, so the post looks the way it will once people react to it.
              </p>
            </fieldset>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm leading-5 font-medium">
              <input
                type="checkbox"
                checked={showComments}
                onChange={(event) => setShowComments(event.target.checked)}
                className="h-5 w-5 accent-[var(--cs-text)]"
              />
              Show sample comments
            </label>

            <Segmented<"light" | "dark">
              label="Appearance"
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
              value={dark ? "dark" : "light"}
              onChange={(value) => setDark(value === "dark")}
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className={`${TOOL_PANEL} flex justify-center !bg-[var(--cs-background)]`}>
          <div className="w-[340px] max-w-full rounded-[44px] bg-[#1c1b1f] p-[10px] shadow-lg">
            <canvas
              ref={canvasRef}
              width={SCREEN.width}
              height={SCREEN.height}
              role="img"
              aria-label={`Preview of your ${kind === "ad" ? "ad" : "post"} as ${placement.label}, from ${shownName}`}
              className="block h-auto w-full rounded-[34px]"
            />
          </div>
        </div>

        <div className={TOOL_PANEL}>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={download} className={studioButtonClasses("primary")}>
              <DownloadIcon />
              Download PNG
            </button>
            <button
              type="button"
              onClick={openInMockupStudio}
              className={studioButtonClasses("secondary")}
            >
              Open on a 3D phone
            </button>
          </div>
          <p className={`mt-2 ${TOOL_HINT}`}>
            “Open on a 3D phone” takes this screen to Mockup Studio, where you can turn the phone,
            change the background and download a picture or a video.
          </p>
          {exportError ? (
            <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
              {exportError}
            </p>
          ) : null}

          <p className="mt-5 text-sm leading-5 font-semibold tabular-nums">
            {placement.label} · {placement.width} × {placement.height}
          </p>
          <p className={`mt-1 ${TOOL_HINT}`}>
            {picture
              ? fitNote(picture.width, picture.height, placement)
              : "Choose an image to see how it fits."}
          </p>
          {story && covered ? <p className={`mt-1 ${TOOL_HINT}`}>{covered.note}</p> : null}
          <p className={`mt-3 ${TOOL_HINT}`}>
            The screen follows how feeds lay a post out. It is not a copy of any app, and the
            numbers and comments are made up. Need the image in this shape?{" "}
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
