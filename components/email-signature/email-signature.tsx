// -----------------------------------------------------------------------------
// @file: components/email-signature/email-signature.tsx
// @purpose: Email signature generator: pick one of six templates, fill in
//           your details, adjust color, font, text and logo size, then copy
//           the signature into a mail app or download it as HTML. Built in
//           the browser; nothing is saved or sent.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CopyIcon, DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  ColorChoice,
  Segmented,
  TOOL_ERROR,
  TOOL_FOCUS,
  TOOL_HINT,
  TOOL_INPUT,
  TOOL_LABEL,
  TOOL_PANEL,
  useToolAccess,
} from "@/components/tools/tool-ui";
import {
  EMPTY_SIGNATURE,
  hasContent,
  LOGO_HEIGHTS,
  logoUrlProblem,
  previewLogoSrc,
  SIGNATURE_FONTS,
  SIGNATURE_SIZES,
  SIGNATURE_TEMPLATES,
  signatureHtml,
  signatureText,
  withSampleDetails,
  type SignatureData,
  type SignatureFontId,
  type SignatureSize,
} from "@/lib/email-signature/signature";
import { saveBlob } from "@/lib/image-tools/render";

const ACCENTS = [
  { hex: "#fe5000", name: "Orange" },
  { hex: "#1f3a5f", name: "Navy" },
  { hex: "#292827", name: "Ink" },
];

type TextField = "name" | "title" | "company" | "phone" | "email" | "website" | "extra";

const FIELDS: {
  key: TextField;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}[] = [
  { key: "name", label: "Name", placeholder: "Your name", autoComplete: "name" },
  {
    key: "title",
    label: "Job title",
    placeholder: "e.g. Marketing lead",
    autoComplete: "organization-title",
  },
  { key: "company", label: "Company", placeholder: "Your company", autoComplete: "organization" },
  {
    key: "phone",
    label: "Phone",
    placeholder: "e.g. +1 555 010 0100",
    type: "tel",
    autoComplete: "tel",
  },
  {
    key: "email",
    label: "Email",
    placeholder: "you@yourcompany.com",
    type: "email",
    autoComplete: "email",
  },
  { key: "website", label: "Website", placeholder: "yourcompany.com", autoComplete: "url" },
  {
    key: "extra",
    label: "Extra line (optional)",
    placeholder: "An address, a tagline, your hours",
  },
];

const SOCIALS: { key: "linkedin" | "instagram" | "x"; label: string; placeholder: string }[] = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourbrand" },
  { key: "x", label: "X", placeholder: "x.com/yourbrand" },
];

const HOW_TO = [
  {
    app: "Gmail",
    steps: "Settings → See all settings → General → Signature → Create new, then paste.",
  },
  {
    app: "Outlook",
    steps: "Settings → Mail → Signatures (on the web: Compose and reply), then paste.",
  },
  {
    app: "Apple Mail",
    steps:
      "Mail → Settings → Signatures → +, untick “Always match my default message font”, then paste.",
  },
];

export function EmailSignature() {
  const access = useToolAccess();
  const idBase = useId();
  const [typed, setTyped] = useState<SignatureData>(EMPTY_SIGNATURE);
  const [edited, setEdited] = useState<ReadonlySet<keyof SignatureData>>(new Set());
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = <K extends keyof SignatureData>(key: K, value: SignatureData[K]) => {
    setTyped((current) => ({ ...current, [key]: value }));
    setEdited((current) => (current.has(key) ? current : new Set(current).add(key)));
  };

  // A signed-in customer starts with their company name and first brand color,
  // until they change either one themselves.
  const data: SignatureData = {
    ...typed,
    company: edited.has("company") ? typed.company : (access.companyName ?? ""),
    accent:
      edited.has("accent") || !access.brandColors[0] ? typed.accent : access.brandColors[0].hex,
  };

  const ready = hasContent(data);
  const html = signatureHtml(data);
  const template =
    SIGNATURE_TEMPLATES.find((t) => t.id === data.template) ?? SIGNATURE_TEMPLATES[0];
  const logoProblem = template.logo ? logoUrlProblem(data.logoUrl) : null;
  // Thumbnails and the empty preview show the templates with stand-in details.
  const shown = withSampleDetails(data);

  // The preview asks for the logo only once typing has paused.
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [settledLogoUrl, setSettledLogoUrl] = useState("");
  const [failure, setFailure] = useState<{ url: string; reason: string } | null>(null);
  const wantedLogoUrl = template.logo && !logoProblem ? data.logoUrl.trim() : "";
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledLogoUrl(wantedLogoUrl), 600);
    return () => window.clearTimeout(timer);
  }, [wantedLogoUrl]);
  const logoFailed = failure && failure.url === settledLogoUrl && settledLogoUrl ? failure : null;

  // A picture that fails to load says nothing about why, so ask our address again for its reason.
  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const onError = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement) || !settledLogoUrl) return;
      const url = settledLogoUrl;
      void fetch(previewLogoSrc(url))
        .then(async (res) => (res.ok ? null : ((await res.json()) as { error?: string }).error))
        .catch(() => null)
        .then((reason) =>
          setFailure({ url, reason: reason ?? "We couldn't load a picture from that address." }),
        );
    };
    node.addEventListener("error", onError, true);
    return () => node.removeEventListener("error", onError, true);
  }, [settledLogoUrl]);

  const copyRich = async () => {
    try {
      // As formatted text, so pasting into a mail app keeps the layout.
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([signatureText(data)], { type: "text/plain" }),
        }),
      ]);
      setMessage({ kind: "ok", text: "Copied. Paste it into your mail app's signature box." });
    } catch {
      setMessage({
        kind: "error",
        text: "Your browser didn't allow the copy. Select the preview with your mouse and copy it, or use Copy HTML.",
      });
    }
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setMessage({ kind: "ok", text: "Copied the HTML." });
    } catch {
      setMessage({
        kind: "error",
        text: "Your browser didn't allow the copy. Download the HTML instead.",
      });
    }
  };

  const download = () =>
    saveBlob(
      new Blob(
        [
          `<!doctype html>\n<html><head><meta charset="utf-8"><title>Email signature</title></head><body>\n${html}\n</body></html>\n`,
        ],
        { type: "text/html" },
      ),
      "email-signature.html",
    );

  return (
    <section aria-label="Email signature generator" className="flex flex-col gap-6">
      <fieldset className={TOOL_PANEL}>
        <legend className="sr-only">Template</legend>
        <p aria-hidden className={TOOL_LABEL}>
          Template
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
          {SIGNATURE_TEMPLATES.map((option) => {
            const selected = option.id === data.template;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => set("template", option.id)}
                className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${TOOL_FOCUS} ${
                  selected
                    ? "border-[var(--cs-text)] ring-1 ring-[var(--cs-text)]"
                    : "border-[var(--cs-border)] hover:border-[var(--cs-text)]"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-[92px] items-center overflow-hidden rounded-lg bg-white px-3"
                >
                  <span
                    className="pointer-events-none block origin-left scale-[0.62] whitespace-nowrap"
                    // Built from the fields; every value is escaped in signatureHtml.
                    dangerouslySetInnerHTML={{
                      // No logo in the small pictures: seven copies would load it seven times.
                      __html: signatureHtml({
                        ...shown,
                        logoUrl: "",
                        template: option.id,
                        size: "medium",
                      }),
                    }}
                  />
                </span>
                <span className="text-sm leading-5 font-semibold">{option.label}</span>
                <span className={TOOL_HINT}>{option.note}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-6 max-[1023px]:grid-cols-1">
        <div className={`flex flex-col gap-5 ${TOOL_PANEL}`}>
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`${idBase}-${field.key}`} className={TOOL_LABEL}>
                {field.label}
              </label>
              <input
                id={`${idBase}-${field.key}`}
                type={field.type ?? "text"}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={data[field.key]}
                maxLength={120}
                onChange={(event) => set(field.key, event.target.value)}
                className={`mt-2 ${TOOL_INPUT}`}
              />
            </div>
          ))}

          <fieldset>
            <legend className={TOOL_LABEL}>Social links (optional)</legend>
            <div className="mt-2 flex flex-col gap-2">
              {SOCIALS.map((social) => (
                <input
                  key={social.key}
                  aria-label={`${social.label} address`}
                  type="url"
                  inputMode="url"
                  placeholder={social.placeholder}
                  value={data[social.key]}
                  maxLength={200}
                  onChange={(event) => set(social.key, event.target.value)}
                  className={TOOL_INPUT}
                />
              ))}
            </div>
            <p className={`mt-2 ${TOOL_HINT}`}>
              Shown as short text links. Icons would need hosted image files and are often blocked.
            </p>
          </fieldset>

          {template.logo ? (
            <div>
              <label htmlFor={`${idBase}-logo`} className={TOOL_LABEL}>
                Logo address (optional)
              </label>
              <input
                id={`${idBase}-logo`}
                type="url"
                inputMode="url"
                placeholder="https://yourcompany.com/logo.png"
                value={data.logoUrl}
                maxLength={500}
                aria-describedby={`${idBase}-logo-hint`}
                onChange={(event) => set("logoUrl", event.target.value)}
                className={`mt-2 ${TOOL_INPUT}`}
              />
              <p id={`${idBase}-logo-hint`} className={`mt-2 ${TOOL_HINT}`}>
                Mail apps only show a logo that lives on the web, so paste the address of your logo
                on your own website. A PNG about 300 pixels wide works well.
              </p>
              {logoProblem ? (
                <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
                  {logoProblem}
                </p>
              ) : logoFailed ? (
                <p role="alert" className={`mt-2 ${TOOL_ERROR}`}>
                  {logoFailed.reason} The logo is left out of the preview; check the address opens
                  your logo in a new browser tab.
                </p>
              ) : null}
              {data.logoUrl.trim() && !logoProblem ? (
                <div className="mt-3">
                  <Segmented<SignatureSize>
                    label="Logo size"
                    options={LOGO_HEIGHTS.map((h) => ({ id: h.id, label: h.label }))}
                    value={data.logoSize}
                    onChange={(logoSize) => set("logoSize", logoSize)}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className={TOOL_HINT}>
              The {template.label} template is text only. Pick another template to add a logo.
            </p>
          )}

          <ColorChoice
            label="Accent color"
            value={data.accent}
            onChange={(accent) => set("accent", accent)}
            brandColors={access.brandColors}
            presets={ACCENTS}
          />

          <Segmented<SignatureSize>
            label="Text size"
            options={SIGNATURE_SIZES.map((s) => ({ id: s.id, label: s.label }))}
            value={data.size}
            onChange={(size) => set("size", size)}
          />

          <div>
            <Segmented<SignatureFontId>
              label="Font"
              options={SIGNATURE_FONTS.map((font) => ({ id: font.id, label: font.label }))}
              value={data.font}
              onChange={(font) => set("font", font)}
            />
            <p className={`mt-2 ${TOOL_HINT}`}>
              These four are on every computer and phone. A brand font would be swapped for another
              in most inboxes.
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className={`${TOOL_PANEL} sticky top-6 max-[1023px]:static`}>
            <h2 className={TOOL_LABEL}>Preview</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--cs-border)] bg-white p-6">
              <div aria-hidden className="mb-5 flex flex-col gap-2">
                <span className="h-2.5 w-3/4 rounded bg-[#eeece8]" />
                <span className="h-2.5 w-2/3 rounded bg-[#eeece8]" />
                <span className="h-2.5 w-1/3 rounded bg-[#eeece8]" />
              </div>
              <div
                ref={previewRef}
                className={ready ? undefined : "opacity-50"}
                // Built here from the fields; every value is escaped in signatureHtml.
                // The logo is loaded through our own address, because the site's
                // policy stops the page loading pictures from other websites.
                dangerouslySetInnerHTML={{
                  __html: signatureHtml(
                    { ...shown, logoUrl: logoFailed ? "" : settledLogoUrl },
                    { logoSrc: previewLogoSrc },
                  ),
                }}
              />
            </div>
            {ready ? null : (
              <p className={`mt-2 ${TOOL_HINT}`}>
                These are stand-in details. Fill in your own to copy the signature.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!ready}
                onClick={() => void copyRich()}
                className={studioButtonClasses("primary")}
              >
                <CopyIcon />
                Copy signature
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => void copyHtml()}
                className={studioButtonClasses("secondary")}
              >
                <CopyIcon />
                Copy HTML
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={download}
                className={studioButtonClasses("secondary")}
              >
                <DownloadIcon />
                Download HTML
              </button>
            </div>
            <p
              role="status"
              className={`mt-3 text-sm leading-5 ${message?.kind === "error" ? "font-medium text-[#b42318]" : "text-[#256b3a]"}`}
            >
              {message?.text ?? ""}
            </p>
          </div>

          <div className={TOOL_PANEL}>
            <h2 className={TOOL_LABEL}>Where to paste it</h2>
            <dl className="mt-3 flex flex-col gap-3">
              {HOW_TO.map((item) => (
                <div key={item.app}>
                  <dt className="text-sm leading-5 font-semibold">{item.app}</dt>
                  <dd className={TOOL_HINT}>{item.steps}</dd>
                </div>
              ))}
            </dl>
            <p className={`mt-3 ${TOOL_HINT}`}>
              Menus move between versions; if yours looks different, search its settings for
              “signature”.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
