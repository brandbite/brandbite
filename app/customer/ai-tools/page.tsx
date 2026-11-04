"use client";

import { useState, useEffect, useCallback, useId, useRef, type ReactNode } from "react";

import { IconArrowUpRight, IconCoins, IconDocument } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  buttonClass,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  Eyebrow,
  Field,
  fmt,
  IconTile,
  PageHeader,
  plural,
  Select,
  Skeleton,
  Table,
  Td,
  TextArea,
  TextInput,
  Th,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconColorStudio } from "@/components/navigation/nav-icons";
import { ListPager } from "@/components/dashboard/workspace/list-pager";
import {
  InsufficientTokensModal,
  type InsufficientTokensInfo,
} from "@/components/tokens/insufficient-tokens-modal";
import { isInsufficientTokensBody } from "@/lib/errors/insufficient-tokens";
import { useIdempotencyKey } from "@/lib/hooks/use-idempotency-key";

type OnInsufficient = (info: InsufficientTokensInfo) => void;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolType =
  | "IMAGE_GENERATION"
  | "TEXT_GENERATION"
  | "BACKGROUND_REMOVAL"
  | "DESIGN_SUGGESTION"
  | "UPSCALE_IMAGE";

type Generation = {
  id: string;
  /** BRIEF_PARSING rows come from the request form, not from a card on this page. */
  toolType: ToolType | "BRIEF_PARSING";
  status: string;
  provider: string;
  model: string;
  prompt: string;
  outputText: string | null;
  outputImageUrl: string | null;
  outputParams: Record<string, unknown> | null;
  tokenCost: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type ToolCard = {
  type: ToolType;
  title: string;
  shortTitle: string;
  description: string;
  icon: ReactNode;
  tone: Tone;
};

function ImageGlyph() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5L6 20" />
    </svg>
  );
}

function ScissorsGlyph() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
    </svg>
  );
}

const TOOLS: ToolCard[] = [
  {
    type: "IMAGE_GENERATION",
    title: "Image Generation",
    shortTitle: "Image",
    description: "Generate professional images from text descriptions using AI",
    icon: <ImageGlyph />,
    tone: "peach",
  },
  {
    type: "TEXT_GENERATION",
    title: "Copy Generation",
    shortTitle: "Copy",
    description: "Create marketing copy, taglines, headlines and social posts",
    icon: <IconDocument />,
    tone: "lavender",
  },
  {
    type: "BACKGROUND_REMOVAL",
    title: "Background Removal",
    shortTitle: "Background",
    description: "Remove backgrounds from images instantly",
    icon: <ScissorsGlyph />,
    tone: "peach",
  },
  {
    type: "DESIGN_SUGGESTION",
    title: "Design Suggestions",
    shortTitle: "Design",
    description: "Get AI-powered color, font, and layout recommendations",
    icon: <IconColorStudio width={24} height={24} />,
    tone: "green",
  },
  {
    type: "UPSCALE_IMAGE",
    title: "Image Upscaling",
    shortTitle: "Upscale",
    description: "Upscale an existing image 2x or 4x with Real-ESRGAN",
    icon: <IconArrowUpRight width={24} height={24} />,
    tone: "lavender",
  },
];

const HISTORY_PAGE_SIZE = 10;

const STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  PROCESSING: { label: "Processing", tone: "lavender" },
  PENDING: { label: "Pending", tone: "neutral" },
};

const SELECT_THEME = "dark:[color-scheme:dark]";

// ---------------------------------------------------------------------------
// Shared panel pieces
// ---------------------------------------------------------------------------

function SubmitButton({
  onClick,
  loading,
  loadingText,
  disabled,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  loadingText: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Button variant="primary" onClick={onClick} disabled={loading || disabled} aria-busy={loading}>
      {loading ? loadingText : children}
    </Button>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--av2-accent-strong)]"
      />
      {label}
    </label>
  );
}

function ResultImage({ label, src, checker }: { label: string; src: string; checker?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5">
        <Eyebrow>{label}</Eyebrow>
      </div>
      <div
        className={`overflow-hidden rounded-xl border border-[var(--av2-border)] ${
          checker
            ? "bg-[repeating-conic-gradient(var(--av2-track)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
            : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool Panel Components
// ---------------------------------------------------------------------------

function ImageGenerationPanel({
  onGenerated,
  onInsufficient,
}: {
  onGenerated: () => void;
  onInsufficient: OnInsufficient;
}) {
  const id = useId();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("vivid");
  const [size, setSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; revisedPrompt?: string } | null>(null);
  const [error, setError] = useState("");
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ prompt, style, size }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(data)) {
          onInsufficient(data);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }
      rotateIdempotencyKey();
      setResult({
        imageUrl: data.generation.imageUrl,
        revisedPrompt: data.generation.revisedPrompt,
      });
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field htmlFor={`${id}-prompt`} label="Prompt">
        <TextArea
          id={`${id}-prompt`}
          placeholder="Describe the image you want to generate..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor={`${id}-style`} label="Style">
          <Select
            id={`${id}-style`}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className={SELECT_THEME}
          >
            <option value="vivid">Vivid</option>
            <option value="natural">Natural</option>
          </Select>
        </Field>
        <Field htmlFor={`${id}-size`} label="Size">
          <Select
            id={`${id}-size`}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className={SELECT_THEME}
          >
            <option value="1024x1024">Square (1024×1024)</option>
            <option value="1024x1792">Portrait (1024×1792)</option>
            <option value="1792x1024">Landscape (1792×1024)</option>
          </Select>
        </Field>
      </div>
      {error && <Callout tone="error" title={error} />}
      <SubmitButton
        onClick={generate}
        loading={loading}
        loadingText="Generating..."
        disabled={!prompt.trim()}
      >
        Generate Image
      </SubmitButton>
      {result && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-[var(--av2-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageUrl} alt="AI generated" className="w-full" />
          </div>
          {result.revisedPrompt && (
            <p className="text-xs text-[var(--av2-text-2)]">
              <span className="font-semibold">Revised prompt:</span> {result.revisedPrompt}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={result.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary")}
            >
              Download
            </a>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setPrompt("");
              }}
            >
              New Generation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Delimiter used between variations in the streaming response. Kept in sync
 * with STREAM_VARIATION_DELIMITER in lib/ai/prompts.ts.
 */
const STREAM_VARIATION_DELIMITER = "---NEXT---";

/**
 * Splits the accumulated streaming text into an array of in-progress
 * variations. The final segment is still growing — we don't trim the
 * trailing entry so the user can see characters landing in real time.
 */
function splitStreamingVariations(fullText: string): string[] {
  if (!fullText) return [];
  return fullText.split(STREAM_VARIATION_DELIMITER).map((s) => s.replace(/^\n+/, ""));
}

/**
 * Parses a single SSE line buffer into complete events. Each event has the
 * form `event: <name>\ndata: <json>\n\n`. Partial events at the tail are
 * returned as a leftover buffer to be prepended to the next chunk.
 */
function consumeSseBuffer(buf: string): {
  events: { event: string; data: unknown }[];
  rest: string;
} {
  const events: { event: string; data: unknown }[] = [];
  let rest = buf;
  while (true) {
    const boundary = rest.indexOf("\n\n");
    if (boundary === -1) break;
    const raw = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);

    let eventName = "message";
    let dataLine = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLine += line.slice(5).trim();
      }
    }
    try {
      events.push({ event: eventName, data: dataLine ? JSON.parse(dataLine) : null });
    } catch {
      // Malformed chunk — skip.
    }
  }
  return { events, rest };
}

function TextGenerationPanel({
  onGenerated,
  onInsufficient,
}: {
  onGenerated: () => void;
  onInsufficient: OnInsufficient;
}) {
  const id = useId();
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("tagline");
  const [tone, setTone] = useState("professional");
  const [variations, setVariations] = useState(3);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();

  const inFlightVariations = splitStreamingVariations(streamingText);

  const generate = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    setStreamingText("");

    try {
      const res = await fetch("/api/ai/generate/text/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ prompt, format, tone, variations }),
      });

      // Pre-stream errors arrive as JSON, not SSE.
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        if (res.status === 402 && isInsufficientTokensBody(data)) {
          onInsufficient(data);
          return;
        }
        throw new Error(data.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming is not supported in this browser");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let finalVariations: string[] | null = null;
      let streamError: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = consumeSseBuffer(buffer);
          buffer = rest;
          for (const ev of events) {
            if (ev.event === "delta") {
              const d = ev.data as { text?: string } | null;
              if (d?.text) {
                accumulated += d.text;
                setStreamingText(accumulated);
              }
            } else if (ev.event === "done") {
              const d = ev.data as { variations?: string[]; outputText?: string } | null;
              finalVariations =
                d?.variations && d.variations.length > 0
                  ? d.variations
                  : splitStreamingVariations(d?.outputText ?? accumulated)
                      .map((s) => s.trim())
                      .filter(Boolean);
            } else if (ev.event === "error") {
              const d = ev.data as { message?: string } | null;
              streamError = d?.message || "Text generation failed";
            }
          }
        }
        if (done) break;
      }

      if (streamError) {
        rotateIdempotencyKey();
        throw new Error(streamError);
      }

      rotateIdempotencyKey();
      setResults(finalVariations ?? []);
      setStreamingText("");
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Field htmlFor={`${id}-prompt`} label="Prompt">
        <TextArea
          id={`${id}-prompt`}
          placeholder="Describe what you need copy for..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_112px]">
        <Field htmlFor={`${id}-format`} label="Format">
          <Select
            id={`${id}-format`}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={SELECT_THEME}
          >
            <option value="tagline">Tagline</option>
            <option value="headline">Headline</option>
            <option value="social_post">Social Post</option>
            <option value="email_subject">Email Subject</option>
            <option value="ad_copy">Ad Copy</option>
            <option value="custom">Custom</option>
          </Select>
        </Field>
        <Field htmlFor={`${id}-tone`} label="Tone">
          <Select
            id={`${id}-tone`}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={SELECT_THEME}
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="playful">Playful</option>
            <option value="bold">Bold</option>
            <option value="elegant">Elegant</option>
            <option value="technical">Technical</option>
          </Select>
        </Field>
        <Field htmlFor={`${id}-variations`} label="Variations">
          <TextInput
            id={`${id}-variations`}
            type="number"
            min={1}
            max={5}
            value={variations}
            onChange={(e) => setVariations(Number(e.target.value))}
          />
        </Field>
      </div>
      {error && <Callout tone="error" title={error} />}
      <SubmitButton
        onClick={generate}
        loading={loading}
        loadingText="Streaming..."
        disabled={!prompt.trim()}
      >
        Generate Copy
      </SubmitButton>

      {loading && inFlightVariations.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>Streaming…</Eyebrow>
          {inFlightVariations.map((text, i) => (
            <div
              key={`stream-${i}`}
              className="rounded-xl border border-dashed border-[var(--av2-accent)]/40 bg-[var(--av2-bg)] px-4 py-3"
            >
              <p className="text-sm whitespace-pre-wrap">
                {text}
                <span className="-mb-0.5 ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[var(--av2-accent)]" />
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((text, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-3"
            >
              <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">{text}</p>
              <Button onClick={() => copyToClipboard(text, i)} className="shrink-0">
                {copied === i ? "Copied!" : "Copy"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackgroundRemovalPanel({
  onGenerated,
  onInsufficient,
}: {
  onGenerated: () => void;
  onInsufficient: OnInsufficient;
}) {
  const id = useId();
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate/background-removal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(data)) {
          onInsufficient(data);
          return;
        }
        throw new Error(data.error || "Background removal failed");
      }
      rotateIdempotencyKey();
      setResult(data.generation.imageUrl);
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field htmlFor={`${id}-url`} label="Image URL">
        <TextInput
          id={`${id}-url`}
          placeholder="Paste the URL of the image..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </Field>
      {error && <Callout tone="error" title={error} />}
      <SubmitButton
        onClick={generate}
        loading={loading}
        loadingText="Processing..."
        disabled={!imageUrl.trim()}
      >
        Remove Background
      </SubmitButton>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ResultImage label="Original" src={imageUrl} />
            <ResultImage label="Result" src={result} checker />
          </div>
          <a
            href={result}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary")}
          >
            Download PNG
          </a>
        </div>
      )}
    </div>
  );
}

function DesignSuggestionsPanel({
  onGenerated,
  onInsufficient,
}: {
  onGenerated: () => void;
  onInsufficient: OnInsufficient;
}) {
  const id = useId();
  const [brief, setBrief] = useState("");
  const [includeColors, setIncludeColors] = useState(true);
  const [includeFonts, setIncludeFonts] = useState(true);
  const [includeLayout, setIncludeLayout] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    colors: { hex: string; name: string; usage: string }[];
    fonts: { heading: string; body: string; rationale: string };
    layoutTips: string[];
    overallDirection: string;
  } | null>(null);
  const [error, setError] = useState("");
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate/design-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ brief, includeColors, includeFonts, includeLayout }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(data)) {
          onInsufficient(data);
          return;
        }
        throw new Error(data.error || "Failed to get suggestions");
      }
      rotateIdempotencyKey();
      setResult(data.generation.suggestions);
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field htmlFor={`${id}-brief`} label="Brief">
        <TextArea
          id={`${id}-brief`}
          placeholder="Describe your project or brand..."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
        />
      </Field>
      <div className="flex flex-wrap gap-x-5">
        {[
          { label: "Colors", checked: includeColors, set: setIncludeColors },
          { label: "Fonts", checked: includeFonts, set: setIncludeFonts },
          { label: "Layout", checked: includeLayout, set: setIncludeLayout },
        ].map((opt) => (
          <CheckOption key={opt.label} label={opt.label} checked={opt.checked} onChange={opt.set} />
        ))}
      </div>
      {error && <Callout tone="error" title={error} />}
      <SubmitButton
        onClick={generate}
        loading={loading}
        loadingText="Analyzing..."
        disabled={!brief.trim()}
      >
        Get Suggestions
      </SubmitButton>
      {result && (
        <div className="space-y-5">
          {result.overallDirection && (
            <div className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-3">
              <div className="mb-1">
                <Eyebrow>Creative Direction</Eyebrow>
              </div>
              <p className="text-sm">{result.overallDirection}</p>
            </div>
          )}

          {result.colors.length > 0 && (
            <div>
              <div className="mb-2">
                <Eyebrow>Color Palette</Eyebrow>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.colors.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] px-3 py-2"
                  >
                    <div
                      className="h-6 w-6 shrink-0 rounded-full border border-[var(--av2-border)]"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-[var(--av2-text-2)]">
                        {c.hex} — {c.usage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.fonts.heading && (
            <div className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-3">
              <div className="mb-2">
                <Eyebrow>Font Pairing</Eyebrow>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-xs text-[var(--av2-text-2)]">Heading:</span>
                  <p className="font-semibold">{result.fonts.heading}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--av2-text-2)]">Body:</span>
                  <p className="font-semibold">{result.fonts.body}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--av2-text-2)]">{result.fonts.rationale}</p>
            </div>
          )}

          {result.layoutTips.length > 0 && (
            <div>
              <div className="mb-2">
                <Eyebrow>Layout Tips</Eyebrow>
              </div>
              <ul className="space-y-1.5">
                {result.layoutTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--av2-accent)]" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UpscaleImagePanel({
  onGenerated,
  onInsufficient,
}: {
  onGenerated: () => void;
  onInsufficient: OnInsufficient;
}) {
  const id = useId();
  const [imageUrl, setImageUrl] = useState("");
  const [scale, setScale] = useState<2 | 4>(4);
  const [faceEnhance, setFaceEnhance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; scale: number } | null>(null);
  const [error, setError] = useState("");
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate/upscale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ imageUrl, scale, faceEnhance }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(data)) {
          onInsufficient(data);
          return;
        }
        throw new Error(data.error || "Upscaling failed");
      }
      rotateIdempotencyKey();
      setResult({ imageUrl: data.generation.imageUrl, scale: data.generation.scale });
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field htmlFor={`${id}-url`} label="Image URL">
        <TextInput
          id={`${id}-url`}
          placeholder="Paste the URL of the image you want to upscale..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <Field htmlFor={`${id}-scale`} label="Scale" className="w-32">
          <Select
            id={`${id}-scale`}
            value={String(scale)}
            onChange={(e) => setScale((Number(e.target.value) === 2 ? 2 : 4) as 2 | 4)}
            className={SELECT_THEME}
          >
            <option value="2">2x</option>
            <option value="4">4x</option>
          </Select>
        </Field>
        <CheckOption label="Face enhance" checked={faceEnhance} onChange={setFaceEnhance} />
      </div>
      {error && <Callout tone="error" title={error} />}
      <SubmitButton
        onClick={generate}
        loading={loading}
        loadingText="Upscaling..."
        disabled={!imageUrl.trim()}
      >
        Upscale Image
      </SubmitButton>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ResultImage label="Original" src={imageUrl} />
            <ResultImage label={`Upscaled (${result.scale}x)`} src={result.imageUrl} />
          </div>
          <a
            href={result.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary")}
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const TOOL_LABEL: Record<string, string> = {
  BRIEF_PARSING: "Brief",
  ...Object.fromEntries(TOOLS.map((t) => [t.type, t.shortTitle])),
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HistoryTokens({ gen }: { gen: Generation }) {
  return (
    <>
      {gen.tokenCost} {plural(gen.tokenCost, "token", "tokens")}
      {gen.status === "FAILED" ? " · Refunded" : ""}
    </>
  );
}

export default function AiToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [toolFilter, setToolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenError, setTokenError] = useState<InsufficientTokensInfo | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const latestHistoryRequest = useRef(0);

  const loadHistory = useCallback(async () => {
    const request = ++latestHistoryRequest.current;
    const params = new URLSearchParams({
      limit: String(HISTORY_PAGE_SIZE),
      offset: String((page - 1) * HISTORY_PAGE_SIZE),
    });
    if (toolFilter) params.set("toolType", toolFilter);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/ai/generations?${params}`);
      if (request !== latestHistoryRequest.current) return;
      if (res.ok) {
        const data = await res.json();
        if (request !== latestHistoryRequest.current) return;
        setGenerations(data.generations);
        setTotal(typeof data.total === "number" ? data.total : data.generations.length);
        setHistoryError(false);
      } else {
        setHistoryError(true);
      }
    } catch {
      if (request === latestHistoryRequest.current) setHistoryError(true);
    } finally {
      if (request === latestHistoryRequest.current) setLoadingHistory(false);
    }
  }, [page, toolFilter, statusFilter]);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/tokens");
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.company?.tokenBalance ?? data.balance ?? data.tokenBalance ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // The panel opens below all five cards: on small screens that's off-screen.
  useEffect(() => {
    if (activeTool) panelRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeTool]);

  const onGenerated = () => {
    if (page !== 1) setPage(1);
    else loadHistory();
    loadBalance();
  };

  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
    setLoadingHistory(true);
  };

  const clearFilters = () => {
    setToolFilter("");
    setStatusFilter("");
    setPage(1);
    setLoadingHistory(true);
  };

  const filtering = Boolean(toolFilter || statusFilter);
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const firstShown = (page - 1) * HISTORY_PAGE_SIZE + 1;
  const activeToolData = TOOLS.find((t) => t.type === activeTool);

  return (
    <>
      <PageHeader
        title="Create with AI"
        description="Generate images, copy, remove backgrounds, and get design suggestions instantly."
        actions={
          tokenBalance !== null ? (
            <Card padding="sm" className="flex items-center gap-3 px-5" as="div">
              <IconTile tone="green" size={44} round>
                <IconCoins />
              </IconTile>
              <div>
                <Eyebrow>Token balance</Eyebrow>
                <p className="text-xl leading-7 font-bold tabular-nums">
                  {fmt(tokenBalance)} {plural(tokenBalance, "token", "tokens")}
                </p>
              </div>
            </Card>
          ) : null
        }
      />

      <div className="space-y-6">
        {/* Tool Cards Grid */}
        <section aria-label="AI tools" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((tool) => {
            const active = activeTool === tool.type;
            return (
              <button
                key={tool.type}
                type="button"
                aria-expanded={active}
                aria-controls="ai-tool-panel"
                onClick={() => setActiveTool(active ? null : tool.type)}
                className={`flex gap-4 rounded-2xl border p-5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
                  active
                    ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                    : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:border-[var(--av2-accent)]/50"
                }`}
              >
                <IconTile tone={tool.tone} round>
                  {tool.icon}
                </IconTile>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg leading-6 font-semibold">{tool.title}</span>
                  <span className="mt-1.5 flex-1 text-sm leading-5 text-[var(--av2-text-2)]">
                    {tool.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--av2-link)]">
                    <span>{active ? "Close tool" : "Open tool"}</span>
                    <IconArrowUpRight aria-hidden />
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        {/* Active Tool Panel */}
        <div id="ai-tool-panel" ref={panelRef} className="scroll-mt-24 empty:hidden">
          {activeTool && activeToolData && (
            <Card>
              <div className="mb-5">
                <CardTitle
                  action={
                    <Button variant="ghost" onClick={() => setActiveTool(null)}>
                      Close
                    </Button>
                  }
                >
                  {activeToolData.title}
                </CardTitle>
              </div>
              {activeTool === "IMAGE_GENERATION" && (
                <ImageGenerationPanel onGenerated={onGenerated} onInsufficient={setTokenError} />
              )}
              {activeTool === "TEXT_GENERATION" && (
                <TextGenerationPanel onGenerated={onGenerated} onInsufficient={setTokenError} />
              )}
              {activeTool === "BACKGROUND_REMOVAL" && (
                <BackgroundRemovalPanel onGenerated={onGenerated} onInsufficient={setTokenError} />
              )}
              {activeTool === "DESIGN_SUGGESTION" && (
                <DesignSuggestionsPanel onGenerated={onGenerated} onInsufficient={setTokenError} />
              )}
              {activeTool === "UPSCALE_IMAGE" && (
                <UpscaleImagePanel onGenerated={onGenerated} onInsufficient={setTokenError} />
              )}
            </Card>
          )}
        </div>

        {/* Recent Generations */}
        <Card padding="none">
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="min-w-[220px] flex-1">
              <CardTitle description="Your AI generation requests and their status.">
                Recent Generations
              </CardTitle>
            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
              <div className="sm:w-44">
                <Select
                  aria-label="Filter by tool"
                  value={toolFilter}
                  onChange={(e) => changeFilter(setToolFilter, e.target.value)}
                  className={SELECT_THEME}
                >
                  <option value="">All tools</option>
                  {TOOLS.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.title}
                    </option>
                  ))}
                  <option value="BRIEF_PARSING">Brief parsing</option>
                </Select>
              </div>
              <div className="sm:w-44">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => changeFilter(setStatusFilter, e.target.value)}
                  className={SELECT_THEME}
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_BADGE).map(([value, s]) => (
                    <option key={value} value={value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {loadingHistory ? (
            <div aria-busy="true" aria-label="Loading history" className="space-y-3 px-6 pb-6">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : historyError ? (
            <div className="px-6 pb-6">
              <Callout tone="error" title="We couldn't load your generation history">
                Please refresh the page to try again.
              </Callout>
            </div>
          ) : generations.length === 0 ? (
            filtering ? (
              <EmptyState
                title="No generations match these filters"
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState title="No generations yet" description="Try one of the tools above!" />
            )
          ) : (
            <>
              <Table label="Recent generations">
                <thead>
                  <tr>
                    <Th>Tool</Th>
                    <Th>Request</Th>
                    <Th className="max-md:hidden">Date</Th>
                    <Th>Status</Th>
                    <Th className="max-md:hidden">Tokens</Th>
                  </tr>
                </thead>
                <tbody>
                  {generations.map((gen) => {
                    const status = STATUS_BADGE[gen.status] ?? {
                      label: gen.status,
                      tone: "neutral" as Tone,
                    };
                    return (
                      <tr
                        key={gen.id}
                        className="border-b border-[var(--av2-border)] last:border-b-0"
                      >
                        <Td className="whitespace-nowrap">
                          {TOOL_LABEL[gen.toolType] ?? gen.toolType}
                        </Td>
                        <Td className="max-w-[32rem]">
                          <p title={gen.prompt} className="line-clamp-2 break-words">
                            {gen.prompt.length > 80 ? gen.prompt.slice(0, 80) + "..." : gen.prompt}
                          </p>
                          {gen.provider && gen.model && (
                            <p className="mt-0.5 text-xs break-all text-[var(--av2-text-2)]">
                              {gen.provider}/{gen.model}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-[var(--av2-text-2)] md:hidden">
                            {formatDate(gen.createdAt)} · <HistoryTokens gen={gen} />
                          </p>
                        </Td>
                        <Td className="whitespace-nowrap max-md:hidden">
                          {formatDate(gen.createdAt)}
                        </Td>
                        <Td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </Td>
                        <Td className="whitespace-nowrap max-md:hidden">
                          <HistoryTokens gen={gen} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--av2-border)] px-6 py-4 text-sm text-[var(--av2-text-2)]">
                <p role="status">
                  Showing {fmt(firstShown)}–{fmt(firstShown + generations.length - 1)} of{" "}
                  {fmt(total)}
                </p>
                <ListPager
                  label="Generation history pages"
                  page={page}
                  pageCount={pageCount}
                  onPage={(p) => {
                    setPage(p);
                    setLoadingHistory(true);
                  }}
                />
              </div>
            </>
          )}
        </Card>
      </div>

      <InsufficientTokensModal info={tokenError} onClose={() => setTokenError(null)} />
    </>
  );
}
