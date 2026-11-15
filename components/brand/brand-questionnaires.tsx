// -----------------------------------------------------------------------------
// @file: components/brand/brand-questionnaires.tsx
// @purpose: On the brand guide page: send the brand form by link to someone
//           at the company, then read their answers and add them to the
//           guide or set them aside. Owners and project managers only.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useId, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  Field,
  TextInput,
} from "@/components/admin/v2/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  QUESTIONNAIRE_LINK_DAYS,
  QUESTIONS,
  type QuestionnaireAnswers,
} from "@/lib/brand/questionnaire";

type Form = {
  id: string;
  status: "OPEN" | "SUBMITTED" | "APPLIED" | "EXPIRED";
  recipientNote: string | null;
  respondentName: string | null;
  respondentRole: string | null;
  answers: QuestionnaireAnswers;
  url: string | null;
  createdAt: string;
  submittedAt: string | null;
  expiresAt: string;
};

const STATUS: Record<Form["status"], { label: string; tone: "amber" | "green" | "neutral" }> = {
  OPEN: { label: "Waiting for answers", tone: "amber" },
  SUBMITTED: { label: "Answered", tone: "green" },
  APPLIED: { label: "Added to the guide", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function readError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

export function BrandQuestionnaires({
  guideDirty,
  onApplied,
}: {
  /** Unsaved edits in the guide: adding answers would overwrite what's on screen. */
  guideDirty: boolean;
  /** The guide changed on the server; the page should load it again. */
  onApplied: () => void;
}) {
  const id = useId();
  const [forms, setForms] = useState<Form[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [applying, setApplying] = useState<Form | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/brand/questionnaires", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Could not load the brand forms."));
      setForms((await res.json()).forms ?? []);
    } catch (err) {
      setForms([]);
      setError(err instanceof Error ? err.message : "Could not load the brand forms.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (form: Form) => {
    if (!form.url) return;
    try {
      await navigator.clipboard.writeText(form.url);
      setCopied(form.id);
      window.setTimeout(() => setCopied((current) => (current === form.id ? null : current)), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand.
    }
  };

  const create = async () => {
    setError(null);
    setBusy("create");
    try {
      const res = await fetch("/api/customer/brand/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientNote: note }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not make the link."));
      const { form } = (await res.json()) as { form: Form };
      setForms((prev) => [form, ...(prev ?? [])]);
      setNote("");
      void copy(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make the link.");
    } finally {
      setBusy(null);
    }
  };

  const close = async (form: Form) => {
    setError(null);
    setBusy(form.id);
    const res = await fetch(`/api/customer/brand/questionnaires/${form.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError(await readError(res, "Could not close the form."));
    setForms((prev) => (prev ?? []).filter((f) => f.id !== form.id));
  };

  const apply = async () => {
    if (!applying) return;
    setError(null);
    setBusy(applying.id);
    const res = await fetch(`/api/customer/brand/questionnaires/${applying.id}`, {
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      setError(await readError(res, "Could not add the answers."));
    } else {
      setForms((prev) =>
        (prev ?? []).map((f) => (f.id === applying.id ? { ...f, status: "APPLIED" } : f)),
      );
      onApplied();
    }
    setApplying(null);
  };

  return (
    <Card>
      <CardTitle description="Send a short form to someone who knows the brand, like a founder or your marketing lead. They don't need an account. You read their answers here before anything changes in the guide.">
        Ask a colleague
      </CardTitle>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Field
          label="Who is it for? (optional)"
          htmlFor={`${id}-note`}
          hint={`Only you see this. Each link takes one set of answers and works for ${QUESTIONNAIRE_LINK_DAYS} days.`}
          className="min-w-56 flex-1"
        >
          <TextInput
            id={`${id}-note`}
            type="text"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Dana, Head of Marketing"
          />
        </Field>
        <Button variant="primary" disabled={busy !== null} onClick={() => void create()}>
          {busy === "create" ? "Making link…" : "Create form link"}
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <Callout tone="error" title="That didn't work">
            {error}
          </Callout>
        </div>
      )}

      {forms && forms.length > 0 && (
        <ul className="mt-5 space-y-3">
          {forms.map((form) => {
            const status = STATUS[form.status];
            const who =
              form.respondentName ??
              form.recipientNote ??
              (form.status === "OPEN" ? "Form link" : "Brand form");
            const answered = QUESTIONS.filter((question) => form.answers[question.key]);
            const expanded = open === form.id;
            return (
              <li key={form.id} className="rounded-xl border border-[var(--av2-border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="break-words">
                        {who}
                        {form.respondentRole ? `, ${form.respondentRole}` : ""}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                      {form.submittedAt
                        ? `Answered ${day(form.submittedAt)} · ${answered.length} of ${QUESTIONS.length} questions`
                        : form.status === "OPEN"
                          ? `Created ${day(form.createdAt)} · works until ${day(form.expiresAt)}`
                          : `Created ${day(form.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.url && (
                      <Button size="sm" onClick={() => void copy(form)}>
                        {copied === form.id ? "Link copied" : "Copy link"}
                      </Button>
                    )}
                    {answered.length > 0 && (
                      <Button
                        size="sm"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : form.id)}
                      >
                        {expanded ? "Hide answers" : "Read answers"}
                      </Button>
                    )}
                    {form.status === "SUBMITTED" && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy !== null || guideDirty}
                        onClick={() => setApplying(form)}
                      >
                        Add to brand guide
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void close(form)}
                    >
                      {form.status === "OPEN" ? "Close link" : "Remove"}
                    </Button>
                  </div>
                </div>

                {form.url && (
                  <p className="mt-2 font-mono text-xs break-all text-[var(--av2-text-2)]">
                    {form.url}
                  </p>
                )}
                {form.status === "SUBMITTED" && guideDirty && (
                  <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                    Save or discard your changes to the guide before adding these answers.
                  </p>
                )}

                {expanded && (
                  <dl className="mt-4 space-y-3 border-t border-[var(--av2-border)] pt-4">
                    {answered.map((question) => {
                      const answer = form.answers[question.key];
                      return (
                        <div key={question.key}>
                          <dt className="text-xs font-medium text-[var(--av2-text-2)]">
                            {question.label}
                          </dt>
                          <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                            {Array.isArray(answer) ? answer.join("\n") : answer}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={applying !== null}
        onClose={() => setApplying(null)}
        onConfirm={() => void apply()}
        title="Add these answers to the brand guide?"
        description="Each question they answered replaces that part of your brand guide. Parts they left blank stay as they are."
        confirmLabel="Add answers"
        variant="warning"
        loading={applying !== null && busy === applying.id}
      />
    </Card>
  );
}
