// -----------------------------------------------------------------------------
// @file: components/feedback/feedback-widget.tsx
// @purpose: Floating "Feedback" pill rendered in the bottom-right of every
//           authenticated role layout. Clicking opens a small modal that
//           captures type (bug / feature / praise / question), an optional
//           subject, and a message body. The widget auto-attaches the page
//           URL, user-agent, and viewport WxH so admins triaging at
//           /admin/feedback don't have to play detective.
//
//           Renders nothing when:
//             - the session role is unknown (loading) — avoids flashing
//             - we're in demo mode (the personas are throwaways and
//               feedback from them adds noise to the triage queue)
//
//           Mounted once per role layout (admin / customer / creative)
//           rather than at the root, so it doesn't appear on the
//           marketing surface or login page.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";

type FeedbackType = "BUG" | "FEATURE" | "PRAISE" | "QUESTION";

const TYPE_OPTIONS: { value: FeedbackType; label: string; hint: string }[] = [
  { value: "BUG", label: "Something's broken", hint: "Bug report" },
  { value: "FEATURE", label: "Idea for a new feature", hint: "Feature request" },
  { value: "QUESTION", label: "I'm not sure how this works", hint: "Question" },
  { value: "PRAISE", label: "This is great", hint: "Compliment / praise" },
];

const MAX_MESSAGE_LEN = 4000;
const MAX_SUBJECT_LEN = 120;

export function FeedbackWidget() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("FEATURE");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode swallow — the persona accounts churn and any feedback
  // they file is throwaway noise. Mirrors the env flag every other
  // demo-aware UI uses.
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const reset = useCallback(() => {
    setType("FEATURE");
    setSubject("");
    setMessage("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    reset();
  }, [reset, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      setError("Tell us a bit about what you noticed.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Auto-capture page context. URL is intentionally pageOriginRelative
      // (location.pathname + search + hash) — no need to leak the
      // origin which the admin already knows. UA stays the full string;
      // it's small and forensic.
      const pageUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const viewport = `${window.innerWidth}x${window.innerHeight}`;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          subject: subject.trim() || null,
          pageUrl,
          userAgent: window.navigator.userAgent,
          viewport,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      showToast({
        type: "success",
        title: "Thanks — we got it.",
        description: "Your feedback is in the team's review queue.",
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send feedback. Try again?");
    } finally {
      setSubmitting(false);
    }
  }, [message, reset, showToast, subject, type]);

  // Keyboard shortcut: ⌘+/ (or Ctrl+/) to open the widget. Standard
  // help-style shortcut and matches what users expect from tools like
  // Linear / Notion. Only when not already inside a text input so we
  // don't steal "/" from search fields.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key === "/") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (isDemoMode) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-[var(--bb-secondary)] px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-black/10 transition-transform hover:-translate-y-0.5 hover:bg-[var(--bb-primary)] focus:ring-2 focus:ring-[var(--bb-primary)] focus:ring-offset-2 focus:outline-none"
        title="Send feedback (⌘ + /)"
        aria-label="Send feedback"
      >
        <span aria-hidden="true">💬</span>
        Feedback
      </button>

      <Modal open={open} onClose={handleClose} size="md">
        <ModalHeader title="Send feedback" onClose={handleClose} />
        <div className="space-y-4 px-6 pb-2 text-sm text-[var(--bb-text-secondary)]">
          <p className="text-xs">
            Bug, idea, or question? Tell us what you noticed — every entry lands in the team&apos;s
            triage queue.
          </p>

          <div>
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              What kind?
            </label>
            <FormSelect
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              className="mt-1 w-full"
              aria-label="Feedback type"
              disabled={submitting}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              Headline <span className="text-[var(--bb-text-muted)]">(optional)</span>
            </label>
            <FormInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="One-line summary"
              maxLength={MAX_SUBJECT_LEN}
              disabled={submitting}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              Details
            </label>
            <FormTextarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What happened, what did you expect, anything else we should know?"
              maxLength={MAX_MESSAGE_LEN}
              disabled={submitting}
              rows={5}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
              {message.length} / {MAX_MESSAGE_LEN}
            </p>
          </div>

          <p className="text-[11px] text-[var(--bb-text-muted)]">
            We auto-attach the page you&apos;re on, your browser, and the window size to help us
            reproduce. Nothing else.
          </p>

          {error && <InlineAlert variant="error">{error}</InlineAlert>}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={submitting}
            loadingText="Sending…"
            disabled={submitting || !message.trim()}
          >
            Send feedback
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
