"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormTextarea, FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Badge } from "@/components/ui/badge";

type AiTicketControlsProps = {
  ticketId: string;
  ticketStatus: string;
  hasRevisions: boolean;
  onGenerated: () => void;
};

export function AiTicketControls({
  ticketId,
  ticketStatus,
  hasRevisions,
  onGenerated,
}: AiTicketControlsProps) {
  const [style, setStyle] = useState("vivid");
  const [size, setSize] = useState("1024x1024");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<{
    imageUrl: string;
    revisedPrompt?: string;
  } | null>(null);

  const isFirstGeneration = !hasRevisions;

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setLastResult(null);

    const endpoint = isFirstGeneration
      ? `/api/customer/tickets/${ticketId}/ai-generate`
      : `/api/customer/tickets/${ticketId}/ai-regenerate`;

    const body = isFirstGeneration ? { style, size } : { feedback, style, size };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setLastResult({
        imageUrl: data.generation.imageUrl,
        revisedPrompt: data.generation.revisedPrompt,
      });
      setFeedback("");
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (ticketStatus === "DONE") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">AI Generation</h3>
        <Badge variant="info">AI Mode</Badge>
      </div>

      {isFirstGeneration ? (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--bb-text-muted)]">
            Generate the first AI design for this ticket. The prompt is built from the ticket title
            and description.
          </p>
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
                <option value="1024x1024">Square (1024x1024)</option>
                <option value="1024x1792">Portrait (1024x1792)</option>
                <option value="1792x1024">Landscape (1792x1024)</option>
              </FormSelect>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--bb-text-muted)]">
            Provide feedback to refine the AI output. Each iteration costs 1 token.
          </p>
          <FormTextarea
            placeholder="What would you like changed? Be specific about colors, composition, style..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <FormSelect value={style} onChange={(e) => setStyle(e.target.value)} size="sm">
                <option value="vivid">Vivid</option>
                <option value="natural">Natural</option>
              </FormSelect>
            </div>
            <div className="flex-1">
              <FormSelect value={size} onChange={(e) => setSize(e.target.value)} size="sm">
                <option value="1024x1024">Square</option>
                <option value="1024x1792">Portrait</option>
                <option value="1792x1024">Landscape</option>
              </FormSelect>
            </div>
          </div>
        </div>
      )}

      {error && (
        <InlineAlert variant="error" className="mt-3">
          {error}
        </InlineAlert>
      )}

      <div className="mt-4">
        <Button
          onClick={handleGenerate}
          loading={loading}
          loadingText={isFirstGeneration ? "Generating..." : "Regenerating..."}
          disabled={!isFirstGeneration && !feedback.trim()}
          size="sm"
        >
          {isFirstGeneration ? "Generate with AI" : "Regenerate with Feedback"}
        </Button>
      </div>

      {lastResult && (
        <div className="mt-4 space-y-2">
          <div className="overflow-hidden rounded-xl border border-[var(--bb-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lastResult.imageUrl} alt="AI generated result" className="w-full" />
          </div>
          {lastResult.revisedPrompt && (
            <p className="text-[10px] text-[var(--bb-text-muted)]">
              <span className="font-semibold">Revised prompt:</span> {lastResult.revisedPrompt}
            </p>
          )}
          <p className="text-[11px] text-[var(--bb-success-text)]">
            Image saved to ticket revisions. Refresh to see it in the revision history.
          </p>
        </div>
      )}
    </div>
  );
}
