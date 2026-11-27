// -----------------------------------------------------------------------------
// @file: components/email-signature/email-signature.tsx
// @purpose: Email signature generator in three steps: fill in your details
//           and set the color, font and sizes; pick one of six templates
//           beside a live preview; then copy the signature into a mail app
//           or download it as HTML. Built in the browser; nothing is saved
//           or sent.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
} from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StepHeading } from "@/components/tools/tool-page";
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
  safeColor,
  SAMPLE_SIGNATURE,
  SIGNATURE_FONTS,
  SIGNATURE_SIZES,
  SIGNATURE_TEMPLATES,
  signatureHtml,
  signatureText,
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

/** Stands in for a logo address until the visitor gives their own. Never copied or downloaded. */
const SAMPLE_LOGO_URL = "https://example.com/logo.png";

/** A stand-in logo in the accent color, as a picture the page can show without loading anything. */
function sampleLogo(accent: string): string {
  const color = safeColor(accent);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" rx="24" fill="${color}"/><path d="M56 28 30 84h14l12-28 12 28h14z" fill="#fff"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A signature drawn as large as its box allows, centered: one template's thumbnail. */
function FitSignature({ html }: { html: string }) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [fit, setFit] = useState({ scale: 0.6, x: 0, y: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const measure = () => {
      const room = { width: box.clientWidth - 24, height: box.clientHeight - 20 };
      const size = { width: inner.offsetWidth, height: inner.offsetHeight };
      if (!size.width || !size.height) return;
      const scale = Math.min(1, room.width / size.width, room.height / size.height);
      setFit({
        scale,
        x: (box.clientWidth - size.width * scale) / 2,
        y: (box.clientHeight - size.height * scale) / 2,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [html]);

  return (
    <span
      ref={boxRef}
      aria-hidden
      className="relative block h-[116px] overflow-hidden rounded-lg border border-[var(--cs-border)] bg-white"
    >
      <span
        ref={innerRef}
        className="pointer-events-none absolute top-0 left-0 block origin-top-left text-left whitespace-nowrap"
        style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}
        // Built from the fields; every value is escaped in signatureHtml.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </span>
  );
}

export function EmailSignature() {
  const access = useToolAccess();
  const idBase = useId();
  const [typed, setTyped] = useState<SignatureData>(EMPTY_SIGNATURE);
  const [edited, setEdited] = useState<ReadonlySet<keyof SignatureData>>(new Set());
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [app, setApp] = useState(HOW_TO[0].app);

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

  // Ready once the visitor has typed a detail themselves; a company name
  // filled in from their account is not yet a signature.
  const ready = hasContent(typed);
  const html = signatureHtml(data);
  const template =
    SIGNATURE_TEMPLATES.find((t) => t.id === data.template) ?? SIGNATURE_TEMPLATES[0];
  const logoProblem = template.logo ? logoUrlProblem(data.logoUrl) : null;
  // The same details with a stand-in in every empty field: what the template
  // thumbnails draw, so each one shows a whole signature.
  const filled: SignatureData = { ...data };
  for (const key of Object.keys(SAMPLE_SIGNATURE) as (keyof typeof SAMPLE_SIGNATURE)[]) {
    if (!filled[key].trim()) filled[key] = SAMPLE_SIGNATURE[key];
  }
  // The large preview shows the stand-ins until the visitor starts typing, then only what is theirs.
  const shown = ready ? data : filled;

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

  // What the previews draw: the visitor's own logo once it loads; a stand-in
  // logo in the thumbnails, and in the large preview until they type a detail.
  const ownLogo = settledLogoUrl && !logoFailed ? settledLogoUrl : "";
  const previewLogo = (url: string) =>
    url === SAMPLE_LOGO_URL ? sampleLogo(data.accent) : previewLogoSrc(url);

  const install = HOW_TO.find((item) => item.app === app) ?? HOW_TO[0];
  const outline =
    "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--cs-brand)] bg-[var(--cs-surface)] px-4 text-sm leading-5 font-semibold whitespace-nowrap text-[var(--cs-brand-strong)] transition-colors hover:bg-[#FFF1EA] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--cs-surface)]";

  return (
    <section aria-label="Email signature generator" className="flex flex-col gap-6">
      <div className="grid grid-cols-[400px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
        <div className={`flex flex-col gap-5 ${TOOL_PANEL}`}>
          <StepHeading
            number={1}
            title="Your details"
            hint="Add your information and set your style."
          />

          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`${idBase}-${field.key}`} className={`block ${TOOL_LABEL}`}>
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

          {template.logo ? (
            <div>
              <label htmlFor={`${idBase}-logo`} className={`block ${TOOL_LABEL}`}>
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

          <div className="border-y border-[var(--cs-border)]">
            <button
              type="button"
              aria-expanded={socialsOpen}
              aria-controls={`${idBase}-socials`}
              onClick={() => setSocialsOpen(!socialsOpen)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 text-left ${TOOL_LABEL} ${TOOL_FOCUS}`}
            >
              <span>
                Social links <span className="font-normal">(optional)</span>
              </span>
              <span className={`transition-transform ${socialsOpen ? "rotate-180" : ""}`}>
                <ChevronDownIcon />
              </span>
            </button>
            <div id={`${idBase}-socials`} hidden={!socialsOpen} className="pb-4">
              <div className="flex flex-col gap-2">
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
                Shown as short text links. Icons would need hosted image files and are often
                blocked.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-base leading-6 font-semibold">Style</p>

            <ColorChoice
              label="Accent color"
              value={data.accent}
              onChange={(accent) => set("accent", accent)}
              brandColors={access.brandColors}
              presets={ACCENTS}
            />

            <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <label htmlFor={`${idBase}-font`} className={TOOL_LABEL}>
                Font
              </label>
              <select
                id={`${idBase}-font`}
                value={data.font}
                onChange={(event) => set("font", event.target.value as SignatureFontId)}
                className={TOOL_INPUT}
              >
                {SIGNATURE_FONTS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`${idBase}-size`} className={TOOL_LABEL}>
                Text size
              </label>
              <select
                id={`${idBase}-size`}
                value={data.size}
                onChange={(event) => set("size", event.target.value as SignatureSize)}
                className={TOOL_INPUT}
              >
                {SIGNATURE_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
            <p className={TOOL_HINT}>
              These four fonts are on every computer and phone. A brand font would be swapped for
              another in most inboxes.
            </p>
          </div>
        </div>

        <div
          className={`flex min-w-0 flex-col gap-5 ${TOOL_PANEL} sticky top-6 max-[1023px]:static`}
        >
          <StepHeading
            number={2}
            title="Preview"
            hint="Choose a template and see your signature live."
          />

          <fieldset>
            <legend className="text-base leading-6 font-semibold">Choose template</legend>
            <div className="mt-3 grid grid-cols-3 gap-3 max-[639px]:grid-cols-2">
              {SIGNATURE_TEMPLATES.map((option) => {
                const selected = option.id === data.template;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    title={option.note}
                    onClick={() => set("template", option.id)}
                    className={`relative flex min-w-0 flex-col gap-2 rounded-xl border p-2 text-center transition-colors ${TOOL_FOCUS} ${
                      selected
                        ? "border-[var(--cs-selected)] bg-[var(--cs-soft)] ring-1 ring-[var(--cs-selected)]"
                        : "border-[var(--cs-border)] hover:border-[var(--cs-text)]"
                    }`}
                  >
                    {selected ? (
                      <span
                        aria-hidden
                        className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--cs-selected)] text-white [&_svg]:h-3 [&_svg]:w-3"
                      >
                        <CheckIcon />
                      </span>
                    ) : null}
                    <FitSignature
                      html={signatureHtml(
                        {
                          ...filled,
                          logoUrl: ownLogo || SAMPLE_LOGO_URL,
                          template: option.id,
                          size: "medium",
                        },
                        { logoSrc: previewLogo },
                      )}
                    />
                    <span className="text-sm leading-5 font-semibold">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 ${TOOL_HINT}`}>
              {template.label}: {template.note.toLowerCase()}.
            </p>
          </fieldset>

          <div>
            <h3 className="text-base leading-6 font-semibold">Email preview</h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--cs-border)] bg-white p-6">
              <div aria-hidden className="mb-5 flex flex-col gap-2">
                <span className="h-2.5 w-3/4 rounded bg-[#eeece8]" />
                <span className="h-2.5 w-2/3 rounded bg-[#eeece8]" />
                <span className="h-2.5 w-1/3 rounded bg-[#eeece8]" />
              </div>
              <div
                ref={previewRef}
                // Built here from the fields; every value is escaped in signatureHtml.
                // The logo is loaded through our own address, because the site's
                // policy stops the page loading pictures from other websites.
                dangerouslySetInnerHTML={{
                  __html: signatureHtml(
                    { ...shown, logoUrl: ownLogo || (ready ? "" : SAMPLE_LOGO_URL) },
                    { logoSrc: previewLogo },
                  ),
                }}
              />
            </div>
            {ready ? null : (
              <p className={`mt-2 ${TOOL_HINT}`}>
                These are stand-in details and a stand-in logo. Fill in your own to copy the
                signature.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={TOOL_PANEL}>
        <StepHeading
          number={3}
          title="Copy & install"
          hint="Copy your signature and add it to your email app."
        />
        <div className="mt-5 grid grid-cols-[400px_minmax(0,1fr)] gap-x-10 gap-y-6 max-[1023px]:grid-cols-1">
          <div>
            <button
              type="button"
              disabled={!ready}
              onClick={() => void copyRich()}
              className={`${studioButtonClasses("primary")} w-full`}
            >
              <CopyIcon />
              Copy signature
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3 max-[419px]:grid-cols-1">
              <button
                type="button"
                disabled={!ready}
                onClick={() => void copyHtml()}
                className={outline}
              >
                <CopyIcon />
                Copy HTML
              </button>
              <button type="button" disabled={!ready} onClick={download} className={outline}>
                <DownloadIcon />
                Download HTML
              </button>
            </div>
            <p
              role="status"
              className={`mt-3 text-sm leading-5 ${message?.kind === "error" ? "font-medium text-[#b42318]" : message ? "text-[#256b3a]" : "text-[var(--cs-muted)]"}`}
            >
              {message?.text ?? (ready ? "" : "Fill in your details above to copy the signature.")}
            </p>
          </div>

          <div className="min-w-0">
            <h3 className="text-base leading-6 font-semibold">Install in your email app</h3>
            <p className={TOOL_HINT}>Choose your email app for the steps.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {HOW_TO.map((item) => (
                <button
                  key={item.app}
                  type="button"
                  aria-pressed={item.app === app}
                  onClick={() => setApp(item.app)}
                  className={`flex h-11 items-center rounded-[10px] border px-4 text-sm leading-5 font-semibold transition-colors ${TOOL_FOCUS} ${
                    item.app === app
                      ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {item.app}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="mt-3 text-sm leading-6">
              <span className="font-semibold">{install.app}:</span> {install.steps}
            </p>
            <p className={`mt-2 ${TOOL_HINT}`}>
              Menus move between versions; if yours looks different, search its settings for
              “signature”.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
