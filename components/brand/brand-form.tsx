// -----------------------------------------------------------------------------
// @file: components/brand/brand-form.tsx
// @purpose: The public brand form someone fills in from a link, without an
//           account. Every question is optional; one answer is enough.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button, Callout, Field, TextArea, TextInput } from "@/components/admin/v2/ui";
import { BRAND_LIMITS } from "@/lib/brand/brand-schema";
import { linesToList, QUESTIONS, type QuestionKey } from "@/lib/brand/questionnaire";

export function BrandForm({ token, companyName }: { token: string; companyName: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [values, setValues] = useState<Partial<Record<QuestionKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const answered = QUESTIONS.filter((question) => (values[question.key] ?? "").trim()).length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    if (name.trim().length < 2) return setError("Please tell us your name.");
    if (answered === 0) return setError("Please answer at least one question.");

    const answers: Record<string, string | string[]> = {};
    for (const question of QUESTIONS) {
      const value = (values[question.key] ?? "").trim();
      if (!value) continue;
      answers[question.key] = question.kind === "list" ? linesToList(value) : value;
    }

    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/brand-form/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respondentName: name, respondentRole: role, answers }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Your answers couldn't be sent. Please try again.");
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your answers couldn't be sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div role="status">
        <h1 className="text-[32px] leading-10 font-bold tracking-tight">Thank you</h1>
        <p className="mt-2 text-base text-[var(--av2-text-2)]">
          Your answers are with the {companyName} team. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-[32px] leading-10 font-bold tracking-tight">
        About the {companyName} brand
      </h1>
      <p className="mt-2 text-base text-[var(--av2-text-2)]">
        {companyName} asked you to describe the brand, so designers and writers get it right. Answer
        what you can and skip the rest. It takes about ten minutes.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field
          htmlFor="bf-name"
          label={
            <>
              Your name <span className="text-[var(--av2-error-text)]">*</span>
            </>
          }
        >
          <TextInput
            id="bf-name"
            type="text"
            autoComplete="name"
            aria-required="true"
            maxLength={BRAND_LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field htmlFor="bf-role" label="Your role">
          <TextInput
            id="bf-role"
            type="text"
            autoComplete="organization-title"
            maxLength={BRAND_LIMITS.name}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Founder, Head of Marketing"
          />
        </Field>
      </div>

      <div className="mt-8 space-y-6 border-t border-[var(--av2-border)] pt-8">
        {QUESTIONS.map((question) => {
          const id = `bf-${question.key}`;
          const change = (value: string) =>
            setValues((prev) => ({ ...prev, [question.key]: value }));
          return (
            <Field key={question.key} htmlFor={id} label={question.label} hint={question.hint}>
              {question.kind === "short" ? (
                <TextInput
                  id={id}
                  type="text"
                  maxLength={BRAND_LIMITS.short}
                  value={values[question.key] ?? ""}
                  onChange={(e) => change(e.target.value)}
                />
              ) : (
                <TextArea
                  id={id}
                  rows={question.kind === "list" ? 3 : 4}
                  maxLength={BRAND_LIMITS.long}
                  value={values[question.key] ?? ""}
                  onChange={(e) => change(e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </div>

      {error && (
        <div className="mt-6">
          <Callout tone="error" title={error} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--av2-border)] pt-5">
        <p className="text-sm text-[var(--av2-text-2)]">
          {answered} of {QUESTIONS.length} answered. This link can be sent once.
        </p>
        <Button type="submit" variant="primary" disabled={sending} aria-busy={sending}>
          {sending ? "Sending…" : "Send answers"}
        </Button>
      </div>
    </form>
  );
}
