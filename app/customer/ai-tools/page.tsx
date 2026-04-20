"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FormTextarea, FormSelect, FormInput } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
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
  toolType: ToolType;
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
  description: string;
  icon: string;
};

const TOOLS: ToolCard[] = [
  {
    type: "IMAGE_GENERATION",
    title: "Image Generation",
    description: "Generate professional images from text descriptions using AI",
    icon: "🎨",
  },
  {
    type: "TEXT_GENERATION",
    title: "Copy Generation",
    description: "Create marketing copy, taglines, headlines and social posts",
    icon: "✍️",
  },
  {
    type: "BACKGROUND_REMOVAL",
    title: "Background Removal",
    description: "Remove backgrounds from images instantly",
    icon: "✂️",
  },
  {
    type: "DESIGN_SUGGESTION",
    title: "Design Suggestions",
    description: "Get AI-powered color, font, and layout recommendations",
    icon: "💡",
  },
  {
    type: "UPSCALE_IMAGE",
    title: "Image Upscaling",
    description: "Upscale an existing image 2x or 4x with Real-ESRGAN",
    icon: "🔍",
  },
];

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
      <FormTextarea
        placeholder="Describe the image you want to generate..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Style
          </label>
          <FormSelect value={style} onChange={(e) => setStyle(e.target.value)} size="sm">
            <option value="vivid">Vivid</option>
            <option value="natural">Natural</option>
          </FormSelect>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Size
          </label>
          <FormSelect value={size} onChange={(e) => setSize(e.target.value)} size="sm">
            <option value="1024x1024">Square (1024×1024)</option>
            <option value="1024x1792">Portrait (1024×1792)</option>
            <option value="1792x1024">Landscape (1792×1024)</option>
          </FormSelect>
        </div>
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      <Button
        onClick={generate}
        loading={loading}
        loadingText="Generating..."
        disabled={!prompt.trim()}
      >
        Generate Image
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-[var(--bb-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageUrl} alt="AI generated" className="w-full" />
          </div>
          {result.revisedPrompt && (
            <p className="text-[11px] text-[var(--bb-text-muted)]">
              <span className="font-semibold">Revised prompt:</span> {result.revisedPrompt}
            </p>
          )}
          <div className="flex gap-2">
            <a
              href={result.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-[var(--bb-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
            >
              Download
            </a>
            <Button
              variant="ghost"
              size="sm"
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
      <FormTextarea
        placeholder="Describe what you need copy for..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Format
          </label>
          <FormSelect value={format} onChange={(e) => setFormat(e.target.value)} size="sm">
            <option value="tagline">Tagline</option>
            <option value="headline">Headline</option>
            <option value="social_post">Social Post</option>
            <option value="email_subject">Email Subject</option>
            <option value="ad_copy">Ad Copy</option>
            <option value="custom">Custom</option>
          </FormSelect>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Tone
          </label>
          <FormSelect value={tone} onChange={(e) => setTone(e.target.value)} size="sm">
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="playful">Playful</option>
            <option value="bold">Bold</option>
            <option value="elegant">Elegant</option>
            <option value="technical">Technical</option>
          </FormSelect>
        </div>
        <div className="w-24">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Variations
          </label>
          <FormInput
            type="number"
            min={1}
            max={5}
            value={variations}
            onChange={(e) => setVariations(Number(e.target.value))}
            size="sm"
          />
        </div>
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      <Button
        onClick={generate}
        loading={loading}
        loadingText="Streaming..."
        disabled={!prompt.trim()}
      >
        Generate Copy
      </Button>

      {loading && inFlightVariations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Streaming…
          </p>
          {inFlightVariations.map((text, i) => (
            <div
              key={`stream-${i}`}
              className="rounded-xl border border-dashed border-[var(--bb-primary)]/40 bg-[var(--bb-bg-page)] px-4 py-3"
            >
              <p className="text-sm whitespace-pre-wrap text-[var(--bb-secondary)]">
                {text}
                <span className="-mb-0.5 ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[var(--bb-primary)]" />
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
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3"
            >
              <p className="flex-1 text-sm whitespace-pre-wrap text-[var(--bb-secondary)]">
                {text}
              </p>
              <button
                onClick={() => copyToClipboard(text, i)}
                className="shrink-0 rounded-full border border-[var(--bb-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--bb-text-tertiary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
              >
                {copied === i ? "Copied!" : "Copy"}
              </button>
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
      <div>
        <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
          Image URL
        </label>
        <FormInput
          placeholder="Paste the URL of the image..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      <Button
        onClick={generate}
        loading={loading}
        loadingText="Processing..."
        disabled={!imageUrl.trim()}
      >
        Remove Background
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Original
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--bb-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Original" className="w-full" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Result
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--bb-border)] bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result} alt="Background removed" className="w-full" />
              </div>
            </div>
          </div>
          <a
            href={result}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-[var(--bb-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
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
      <FormTextarea
        placeholder="Describe your project or brand..."
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={3}
      />
      <div className="flex gap-4">
        {[
          { label: "Colors", checked: includeColors, set: setIncludeColors },
          { label: "Fonts", checked: includeFonts, set: setIncludeFonts },
          { label: "Layout", checked: includeLayout, set: setIncludeLayout },
        ].map((opt) => (
          <label
            key={opt.label}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)]"
          >
            <input
              type="checkbox"
              checked={opt.checked}
              onChange={(e) => opt.set(e.target.checked)}
              className="rounded border-[var(--bb-border)]"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      <Button
        onClick={generate}
        loading={loading}
        loadingText="Analyzing..."
        disabled={!brief.trim()}
      >
        Get Suggestions
      </Button>
      {result && (
        <div className="space-y-5">
          {result.overallDirection && (
            <div className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Creative Direction
              </p>
              <p className="text-sm text-[var(--bb-secondary)]">{result.overallDirection}</p>
            </div>
          )}

          {result.colors.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Color Palette
              </p>
              <div className="flex flex-wrap gap-2">
                {result.colors.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2"
                  >
                    <div
                      className="h-6 w-6 rounded-full border border-[var(--bb-border)]"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--bb-secondary)]">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-[var(--bb-text-muted)]">
                        {c.hex} — {c.usage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.fonts.heading && (
            <div className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Font Pairing
              </p>
              <div className="flex gap-6 text-sm text-[var(--bb-secondary)]">
                <div>
                  <span className="text-[11px] text-[var(--bb-text-muted)]">Heading:</span>
                  <p className="font-semibold">{result.fonts.heading}</p>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--bb-text-muted)]">Body:</span>
                  <p className="font-semibold">{result.fonts.body}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--bb-text-muted)]">
                {result.fonts.rationale}
              </p>
            </div>
          )}

          {result.layoutTips.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Layout Tips
              </p>
              <ul className="space-y-1.5">
                {result.layoutTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--bb-secondary)]">
                    <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bb-primary)]" />
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
      <div>
        <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
          Image URL
        </label>
        <FormInput
          placeholder="Paste the URL of the image you want to upscale..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
            Scale
          </label>
          <FormSelect
            value={String(scale)}
            onChange={(e) => setScale((Number(e.target.value) === 2 ? 2 : 4) as 2 | 4)}
            size="sm"
          >
            <option value="2">2x</option>
            <option value="4">4x</option>
          </FormSelect>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)]">
          <input
            type="checkbox"
            checked={faceEnhance}
            onChange={(e) => setFaceEnhance(e.target.checked)}
            className="rounded border-[var(--bb-border)]"
          />
          Face enhance
        </label>
      </div>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
      <Button
        onClick={generate}
        loading={loading}
        loadingText="Upscaling..."
        disabled={!imageUrl.trim()}
      >
        Upscale Image
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Original
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--bb-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Original" className="w-full" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Upscaled ({result.scale}x)
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--bb-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.imageUrl} alt="Upscaled" className="w-full" />
              </div>
            </div>
          </div>
          <a
            href={result.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border border-[var(--bb-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
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

export default function AiToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [tokenError, setTokenError] = useState<InsufficientTokensInfo | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/generations?limit=10");
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/tokens");
      if (res.ok) {
        const data = await res.json();
        setTokenBalance(data.balance ?? data.tokenBalance ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadBalance();
  }, [loadHistory, loadBalance]);

  const onGenerated = () => {
    loadHistory();
    loadBalance();
  };

  const activeToolData = TOOLS.find((t) => t.type === activeTool);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
            AI Design Tools
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            Create with AI
          </h1>
          <p className="mt-1 text-sm text-[var(--bb-text-muted)]">
            Generate images, copy, remove backgrounds, and get design suggestions instantly.
          </p>
        </div>
        {tokenBalance !== null && (
          <div className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-2.5 text-right">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Token Balance
            </p>
            <p className="text-lg font-semibold text-[var(--bb-secondary)]">{tokenBalance}</p>
          </div>
        )}
      </div>

      {/* Tool Cards Grid */}
      <section className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => setActiveTool(activeTool === tool.type ? null : tool.type)}
            className={`rounded-2xl border px-5 py-5 text-left transition-all ${
              activeTool === tool.type
                ? "border-[var(--bb-primary)] bg-[var(--bb-primary-light)] shadow-md"
                : "border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm hover:border-[var(--bb-primary)] hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{tool.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">{tool.title}</h3>
                <p className="text-[11px] text-[var(--bb-text-muted)]">{tool.description}</p>
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* Active Tool Panel */}
      {activeTool && activeToolData && (
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">
              {activeToolData.icon} {activeToolData.title}
            </h2>
            <button
              onClick={() => setActiveTool(null)}
              className="text-[11px] font-semibold text-[var(--bb-text-tertiary)] hover:text-[var(--bb-secondary)]"
            >
              Close
            </button>
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
        </section>
      )}

      {/* Recent Generations */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
          Recent Generations
        </h2>
        {loadingHistory ? (
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-8 text-center">
            <p className="text-sm text-[var(--bb-text-muted)]">Loading history...</p>
          </div>
        ) : generations.length === 0 ? (
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-8 text-center">
            <p className="text-sm text-[var(--bb-text-muted)]">
              No generations yet. Try one of the tools above!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="flex items-center gap-4 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm"
              >
                <span className="text-lg">
                  {gen.toolType === "IMAGE_GENERATION" && "🎨"}
                  {gen.toolType === "TEXT_GENERATION" && "✍️"}
                  {gen.toolType === "BACKGROUND_REMOVAL" && "✂️"}
                  {gen.toolType === "DESIGN_SUGGESTION" && "💡"}
                  {gen.toolType === "UPSCALE_IMAGE" && "🔍"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--bb-secondary)]">
                    {gen.prompt.length > 80 ? gen.prompt.slice(0, 80) + "..." : gen.prompt}
                  </p>
                  <p className="text-[10px] text-[var(--bb-text-muted)]">
                    {gen.provider}/{gen.model} — {new Date(gen.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={
                    gen.status === "COMPLETED"
                      ? "success"
                      : gen.status === "FAILED"
                        ? "danger"
                        : gen.status === "PROCESSING"
                          ? "info"
                          : "neutral"
                  }
                >
                  {gen.status}
                </Badge>
                <span className="text-[11px] font-semibold text-[var(--bb-text-tertiary)]">
                  {gen.tokenCost} tokens
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <InsufficientTokensModal info={tokenError} onClose={() => setTokenError(null)} />
    </div>
  );
}
