// -----------------------------------------------------------------------------
// @file: app/talent/page.tsx
// @purpose: Public talent application form. Anonymous, Turnstile-gated,
//           POSTs to /api/talent/applications. Categories load on mount
//           from /api/talent/categories.
//
//           Conditional fields — kept in sync with the Zod refinements
//           in lib/schemas/talent-application.schemas.ts:
//             - yearsRemote shown only when hasRemoteExp === true
//             - preferredTasksPerWeek shown only when workload === FULL_TIME
//             - toolsOther shown only when "OTHER" is in tools
//
//           Layout chrome: minimal (own slim top bar with brand wordmark
//           linking home), no marketing nav. Same posture as /login —
//           multi-section forms convert better without escape hatches.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { Button } from "@/components/ui/button";
import { CountryCodePicker } from "@/components/ui/country-code-picker";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { COUNTRIES, findCountryByIso } from "@/lib/countries";
import {
  TASKS_PER_WEEK,
  TOOLS,
  TOTAL_YEARS,
  WORKED_WITH,
  WORKLOAD,
  type TasksPerWeek,
  type Tool,
  type TotalYears,
  type WorkedWith,
  type Workload,
} from "@/lib/schemas/talent-application.schemas";

// ---------------------------------------------------------------------------
// Type-safe option labels — colocated with the form so the Zod constants
// stay machine values and the human strings stay copy-editable here.
// ---------------------------------------------------------------------------

const TOTAL_YEARS_LABELS: Record<TotalYears, string> = {
  "0-2": "0–2 years",
  "2-5": "2–5 years",
  "5-10": "5–10 years",
  "10+": "10+ years",
};

const WORKED_WITH_LABELS: Record<WorkedWith, string> = {
  STARTUPS: "Startups",
  AGENCIES: "Agencies",
  CORPORATE: "Corporate",
  FREELANCE: "Freelance",
};

const WORKLOAD_LABELS: Record<Workload, string> = {
  PART_TIME: "Part-time (working hours decided if we agree)",
  FULL_TIME: "Full-time",
};

const TASKS_PER_WEEK_LABELS: Record<TasksPerWeek, string> = {
  "1-2": "1–2 tasks per week",
  "3-5": "3–5 tasks per week",
  "6+": "6+ tasks per week",
};

const TOOLS_LABELS: Record<Tool, string> = {
  FIGMA: "Figma",
  ADOBE: "Adobe (PS / AI / AE / …)",
  WEBFLOW: "Webflow",
  CANVA: "Canva",
  AI_TOOLS: "AI tools (Midjourney, Runway, …)",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Local form state. Keep flat — easier to reason about than nested objects.
// ---------------------------------------------------------------------------

type Category = { id: string; name: string; slug: string; sortOrder: number };

type Status = "idle" | "loading-categories" | "submitting" | "success" | "error";

const MAX_SOCIAL_LINKS = 3;
// Polish round 1: lowered from 3 to 1 — keep in sync with the Zod
// `.min(...)` in lib/schemas/talent-application.schemas.ts. The legend
// + counter copy below also references this value.
const MIN_CATEGORIES = 1;
const TURNAROUND_MAX = 120;

export default function TalentApplicationPage() {
  // -- Categories load -----------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // Kill-switch hint from /api/talent/state — null while loading, then
  // boolean. We render a closed banner + disable submit when false. The
  // server still gates the actual POST so a stale `null` here is safe;
  // the worst case is a candidate sees the form for 100ms and the submit
  // gets a clean 503.
  const [applicationsOpen, setApplicationsOpen] = useState<boolean | null>(null);

  // -- Form fields ---------------------------------------------------------
  const [fullName, setFullName] = useState("");
  // WhatsApp split (PR5): the user picks a country code from a dropdown
  // and types the local number separately. We submit the concatenated
  // E.164 string (e.g. "+90 555 555 5555") in `whatsappNumber` so the
  // schema/DB shape doesn't change.
  const [whatsappCountryIso, setWhatsappCountryIso] = useState("");
  const [whatsappLocal, setWhatsappLocal] = useState("");
  const [email, setEmail] = useState("");
  // Country split (PR5): the dropdown's value is the ISO 3166-1 alpha-2
  // code (stable lookup key into lib/countries.ts). The submitted
  // `country` field is the display name, kept in sync via a derived
  // value below.
  const [countryIso, setCountryIso] = useState("");
  const [timezone, setTimezone] = useState("");

  // Derived: country display name (for submit). Empty until selection.
  const country = useMemo(() => findCountryByIso(countryIso)?.name ?? "", [countryIso]);
  // Derived: WhatsApp dial code from the selected country code dropdown.
  const whatsappDialCode = useMemo(
    () => findCountryByIso(whatsappCountryIso)?.dialCode ?? "",
    [whatsappCountryIso],
  );
  // Derived: full E.164-style number for the API submission.
  const whatsappNumber = useMemo(() => {
    const trimmed = whatsappLocal.trim();
    if (!trimmed || !whatsappDialCode) return trimmed;
    return `${whatsappDialCode} ${trimmed}`;
  }, [whatsappDialCode, whatsappLocal]);

  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState<string[]>([""]);

  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [totalYears, setTotalYears] = useState<TotalYears | "">("");
  const [hasRemoteExp, setHasRemoteExp] = useState<boolean | null>(null);
  const [yearsRemote, setYearsRemote] = useState<TotalYears | "">("");
  const [workedWith, setWorkedWith] = useState<WorkedWith[]>([]);

  const [workload, setWorkload] = useState<Workload | "">("");
  const [preferredTasksPerWeek, setPreferredTasksPerWeek] = useState<TasksPerWeek | "">("");

  const [turnaroundOk, setTurnaroundOk] = useState<boolean | null>(null);
  const [turnaroundComment, setTurnaroundComment] = useState("");

  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsOther, setToolsOther] = useState("");

  const [testTaskOk, setTestTaskOk] = useState<boolean | null>(null);
  const [communicationConfirmed, setCommunicationConfirmed] = useState(false);

  // -- Turnstile -----------------------------------------------------------
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  // -- Submit lifecycle ----------------------------------------------------
  const [status, setStatus] = useState<Status>("loading-categories");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // -- Timezone options (PR5: filtered by selected country) ----------------
  // When a country is selected we constrain the timezone <select> to that
  // country's IANA zones (lib/countries.ts). Single-zone countries get
  // auto-selected by the effect below. Before any country is picked we
  // fall back to the unfiltered Intl list so the field isn't empty.
  const timezoneOptions = useMemo(() => {
    const country = findCountryByIso(countryIso);
    if (country && country.timezones.length > 0) return country.timezones;

    try {
      const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
      const list = intl.supportedValuesOf?.("timeZone");
      if (list && list.length > 0) return list;
    } catch {
      // fall through
    }
    return ["UTC", "Europe/Istanbul", "Europe/London", "America/New_York", "Asia/Singapore"];
  }, [countryIso]);

  // Country-change handler — drives both the timezone <select> and the
  // WhatsApp dial-code default. Lives outside an effect because all the
  // dependent state updates are caused by a user interaction (the
  // <select onChange>), so the cleaner pattern is to do the work
  // synchronously in the handler instead of reacting after the fact.
  function handleCountryChange(nextIso: string) {
    setCountryIso(nextIso);

    const country = findCountryByIso(nextIso);
    if (!country) {
      setTimezone("");
      return;
    }

    // Single-zone country → auto-select. Multi-zone country → clear the
    // timezone if the existing selection isn't valid for the new country
    // so the form can't submit a stale mismatched value.
    if (country.timezones.length === 1) {
      setTimezone(country.timezones[0]!);
    } else if (timezone && !country.timezones.includes(timezone)) {
      setTimezone("");
    }

    // Default the WhatsApp dial code to match (one-shot — only fills if
    // the user hasn't picked one yet).
    if (!whatsappCountryIso) {
      setWhatsappCountryIso(nextIso);
    }
  }

  // -- Category fetch ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    fetch("/api/talent/categories")
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<{ categories: Category[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setCategories(body.categories);
        setStatus("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[talent] failed to load categories", err);
        setCategoriesError("We couldn't load the skill categories. Please refresh the page.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -- Open/closed kill-switch ---------------------------------------------
  // Public read of /api/talent/state. Independent of the categories fetch
  // so a transient state-endpoint failure (which fails open) doesn't
  // poison category loading or vice versa.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/talent/state", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { open: true }))
      .then((body: { open?: boolean }) => {
        if (cancelled) return;
        setApplicationsOpen(body.open !== false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail open — the server is the real gate; a banner failure
        // shouldn't block someone from at least trying to submit.
        setApplicationsOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -- Derived submit-disabled flag ---------------------------------------
  // Mirror the Zod refinements; the server is the source of truth, but a
  // disabled submit + inline counters are kinder than a 400 round-trip.
  const isSubmittable = useMemo(() => {
    if (status === "submitting" || status === "loading-categories") return false;
    if (!fullName.trim() || !email.trim()) return false;
    // PR5: WhatsApp is split into dial-code + local. Require both.
    if (!whatsappCountryIso || !whatsappLocal.trim()) return false;
    if (!countryIso || !timezone) return false;
    if (!portfolioUrl.trim()) return false;
    if (categoryIds.length < MIN_CATEGORIES) return false;
    if (!totalYears) return false;
    if (hasRemoteExp === null) return false;
    if (hasRemoteExp && !yearsRemote) return false;
    if (workedWith.length === 0) return false;
    if (!workload) return false;
    if (workload === "FULL_TIME" && !preferredTasksPerWeek) return false;
    if (turnaroundOk === null) return false;
    if (tools.length === 0) return false;
    if (tools.includes("OTHER") && !toolsOther.trim()) return false;
    if (testTaskOk === null) return false;
    if (!communicationConfirmed) return false;
    if (turnstileSiteKey && !turnstileToken) return false;
    return true;
  }, [
    status,
    fullName,
    whatsappCountryIso,
    whatsappLocal,
    email,
    countryIso,
    timezone,
    portfolioUrl,
    categoryIds,
    totalYears,
    hasRemoteExp,
    yearsRemote,
    workedWith,
    workload,
    preferredTasksPerWeek,
    turnaroundOk,
    tools,
    toolsOther,
    testTaskOk,
    communicationConfirmed,
    turnstileSiteKey,
    turnstileToken,
  ]);

  // -- Toggle helpers ------------------------------------------------------
  function toggleCategoryId(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleWorkedWith(v: WorkedWith) {
    setWorkedWith((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }
  function toggleTool(v: Tool) {
    setTools((prev) => {
      const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
      // When OTHER is removed, clear the free-text field so it doesn't
      // ride along on submit. The schema would reject it anyway but the
      // UX is cleaner.
      if (v === "OTHER" && !next.includes("OTHER")) setToolsOther("");
      return next;
    });
  }
  function updateSocialLink(idx: number, value: string) {
    setSocialLinks((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }
  function addSocialLink() {
    setSocialLinks((prev) => (prev.length < MAX_SOCIAL_LINKS ? [...prev, ""] : prev));
  }
  function removeSocialLink(idx: number) {
    setSocialLinks((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx)));
  }

  // -- Submit --------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubmittable) return;

    setStatus("submitting");
    setSubmitError(null);

    const cleanedSocialLinks = socialLinks.map((s) => s.trim()).filter(Boolean);

    const payload = {
      fullName: fullName.trim(),
      whatsappNumber: whatsappNumber.trim(),
      email: email.trim(),
      country: country.trim(),
      timezone,
      portfolioUrl: portfolioUrl.trim(),
      linkedinUrl: linkedinUrl.trim() || null,
      socialLinks: cleanedSocialLinks,
      categoryIds,
      totalYears,
      hasRemoteExp,
      yearsRemote: hasRemoteExp ? yearsRemote || null : null,
      workedWith,
      workload,
      preferredTasksPerWeek: workload === "FULL_TIME" ? preferredTasksPerWeek || null : null,
      turnaroundOk,
      turnaroundComment: turnaroundComment.trim(),
      tools,
      toolsOther: tools.includes("OTHER") ? toolsOther.trim() : null,
      testTaskOk,
      communicationConfirmed,
      turnstileToken: turnstileToken ?? "",
    };

    try {
      const res = await fetch("/api/talent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setSubmitError(json?.message || json?.error || "Submission failed. Please try again.");
        setStatus("error");
        // Single-use Turnstile token — refresh after every submit attempt.
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        return;
      }
      setStatus("success");
    } catch (err) {
      console.error("[talent] submit failed", err);
      setSubmitError("Something went wrong. Please try again in a moment.");
      setStatus("error");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  // ---------------------------------------------------------------------
  // Success state — replace the whole form to make the outcome obvious.
  // ---------------------------------------------------------------------
  if (status === "success") {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
        <SlimHeader />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12">
          <div
            role="status"
            className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 text-center shadow-sm"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bb-primary)]/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-6 w-6 text-[var(--bb-primary)]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[var(--bb-secondary)]">
              Thanks — application received
            </h1>
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
              We review every application personally and will reply within a few days. Keep an eye
              on your inbox.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] hover:underline"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
      <SlimHeader />

      <main id="main-content" className="mx-auto w-full max-w-2xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">Apply to join Brandbite</h1>
          <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
            Tell us about your work and how you&rsquo;d like to collaborate. The form takes about 4
            minutes. Required fields are marked with an asterisk.
          </p>
        </header>

        {categoriesError && (
          <p
            role="alert"
            className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400"
          >
            {categoriesError}
          </p>
        )}

        {applicationsOpen === false && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <p className="font-semibold">Applications are temporarily closed.</p>
            <p className="mt-0.5 text-xs">
              We&rsquo;re at capacity right now. Follow{" "}
              <a href="https://brandbite.studio" className="underline hover:no-underline">
                brandbite.studio
              </a>{" "}
              and check back soon — we&rsquo;ll re-open intake when we can take new creatives. The
              form below is read-only until then.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10" noValidate>
          {/* ---- 1. Basic info ---- */}
          <Section title="1. Basic info" subtitle="All fields required.">
            <Field label="Full name" required htmlFor="t-fullName">
              <FormInput
                id="t-fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-required
                autoComplete="name"
                maxLength={120}
              />
            </Field>
            <Field label="WhatsApp number" required htmlFor="t-whatsapp-local">
              {/* PR6: replaced the native dial-code <select> with a
                  searchable CountryCodePicker (flag trigger + popover with
                  search + filtered list). The trigger, dial-code prefix
                  label, and local-number input live inside the same
                  rounded container so visually it reads as one combined
                  control. The picker manages no submission state itself
                  — we still own `whatsappCountryIso` + `whatsappLocal`
                  here and derive the E.164 submit string from them. */}
              <div className="flex items-stretch">
                <CountryCodePicker
                  id="t-whatsapp-cc"
                  ariaLabel="WhatsApp country code"
                  value={whatsappCountryIso}
                  onChange={setWhatsappCountryIso}
                />
                {whatsappDialCode && (
                  <span
                    aria-hidden
                    className="flex items-center border-y border-[var(--bb-border)] bg-white px-2 text-sm text-[var(--bb-text-muted)]"
                  >
                    {whatsappDialCode}
                  </span>
                )}
                <input
                  id="t-whatsapp-local"
                  type="text"
                  value={whatsappLocal}
                  onChange={(e) => setWhatsappLocal(e.target.value)}
                  aria-required
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={whatsappDialCode ? "555 555 5555" : "Pick a country first"}
                  maxLength={24}
                  disabled={!whatsappCountryIso}
                  className="h-10 flex-1 rounded-r-xl border border-l-0 border-[var(--bb-border)] bg-white px-3 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] disabled:bg-[var(--bb-bg-warm)] disabled:opacity-60"
                />
              </div>
            </Field>
            <Field label="Email" required htmlFor="t-email">
              <FormInput
                id="t-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required
                autoComplete="email"
                maxLength={320}
              />
            </Field>
            <Field label="Your current country of residence" required htmlFor="t-country">
              <FormSelect
                id="t-country"
                value={countryIso}
                onChange={(e) => handleCountryChange(e.target.value)}
                aria-required
                autoComplete="country-name"
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.name}
                  </option>
                ))}
              </FormSelect>
            </Field>
            <Field label="Timezone" required htmlFor="t-timezone">
              <FormSelect
                id="t-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-required
                disabled={!countryIso}
              >
                <option value="">
                  {countryIso ? "Select your timezone" : "Pick a country first"}
                </option>
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </FormSelect>
            </Field>
          </Section>

          {/* ---- 2. Portfolio & presence ---- */}
          <Section title="2. Portfolio & presence">
            <Field label="Portfolio URL" required htmlFor="t-portfolio">
              <FormInput
                id="t-portfolio"
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                aria-required
                placeholder="https://"
                maxLength={500}
              />
            </Field>
            <Field label="LinkedIn (optional)" htmlFor="t-linkedin">
              <FormInput
                id="t-linkedin"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                maxLength={500}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[var(--bb-secondary)]">
                Other links (optional) — Instagram, Behance, Dribbble, …
              </legend>
              <div className="space-y-2">
                {socialLinks.map((value, idx) => (
                  <div key={idx} className="flex gap-2">
                    <FormInput
                      type="url"
                      value={value}
                      onChange={(e) => updateSocialLink(idx, e.target.value)}
                      placeholder="https://"
                      maxLength={500}
                      aria-label={`Social link ${idx + 1}`}
                    />
                    {socialLinks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSocialLink(idx)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {socialLinks.length < MAX_SOCIAL_LINKS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={addSocialLink}
                >
                  + Add another
                </Button>
              )}
            </fieldset>
          </Section>

          {/* ---- 3. Skills ---- */}
          <Section
            title="3. Skills & expertise"
            subtitle={`Pick at least ${MIN_CATEGORIES} categories.`}
          >
            <fieldset>
              <legend className="sr-only">Skill categories</legend>
              {status === "loading-categories" ? (
                <p className="text-sm text-[var(--bb-text-secondary)]">Loading categories…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categories.map((cat) => {
                      const checked = categoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            checked
                              ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/10 text-[var(--bb-secondary)]"
                              : "border-[var(--bb-border-subtle)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategoryId(cat.id)}
                            className="h-4 w-4 accent-[var(--bb-primary)]"
                          />
                          <span>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p
                    className={`mt-2 text-xs ${
                      categoryIds.length < MIN_CATEGORIES
                        ? "text-[var(--bb-text-muted)]"
                        : "text-[var(--bb-primary)]"
                    }`}
                    aria-live="polite"
                  >
                    {categoryIds.length} of {categories.length} selected — minimum {MIN_CATEGORIES}
                  </p>
                </>
              )}
            </fieldset>
          </Section>

          {/* ---- 4. Experience snapshot ---- */}
          <Section title="4. Experience snapshot">
            <RadioGroup
              legend="Total years of work experience"
              required
              name="totalYears"
              value={totalYears}
              onChange={(v) => setTotalYears(v as TotalYears)}
              options={TOTAL_YEARS.map((y) => ({ value: y, label: TOTAL_YEARS_LABELS[y] }))}
            />
            <RadioGroup
              legend="Do you have remote-work experience?"
              required
              name="hasRemoteExp"
              value={hasRemoteExp === null ? "" : hasRemoteExp ? "yes" : "no"}
              onChange={(v) => {
                const next = v === "yes";
                setHasRemoteExp(next);
                if (!next) setYearsRemote("");
              }}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
            {hasRemoteExp === true && (
              <RadioGroup
                legend="How many years of remote-work experience?"
                required
                name="yearsRemote"
                value={yearsRemote}
                onChange={(v) => setYearsRemote(v as TotalYears)}
                options={TOTAL_YEARS.map((y) => ({
                  value: y,
                  label: TOTAL_YEARS_LABELS[y],
                }))}
              />
            )}
            <CheckboxGroup
              legend="Worked at / with (select all that apply)"
              required
              values={workedWith}
              onToggle={(v) => toggleWorkedWith(v as WorkedWith)}
              options={WORKED_WITH.map((w) => ({ value: w, label: WORKED_WITH_LABELS[w] }))}
            />
          </Section>

          {/* ---- 5. Availability ---- */}
          <Section title="5. Availability & work style">
            <RadioGroup
              legend="Weekly availability"
              required
              name="workload"
              value={workload}
              onChange={(v) => {
                setWorkload(v as Workload);
                if (v !== "FULL_TIME") setPreferredTasksPerWeek("");
              }}
              options={WORKLOAD.map((w) => ({ value: w, label: WORKLOAD_LABELS[w] }))}
            />
            {workload === "FULL_TIME" && (
              <RadioGroup
                legend="Preferred workload"
                required
                name="preferredTasksPerWeek"
                value={preferredTasksPerWeek}
                onChange={(v) => setPreferredTasksPerWeek(v as TasksPerWeek)}
                options={TASKS_PER_WEEK.map((t) => ({
                  value: t,
                  label: TASKS_PER_WEEK_LABELS[t],
                }))}
              />
            )}
          </Section>

          {/* ---- 6. Turnaround reality check ---- */}
          <Section title="6. Turnaround reality check">
            <RadioGroup
              legend="Can you deliver most tasks within 24–48 hours?"
              required
              name="turnaroundOk"
              value={turnaroundOk === null ? "" : turnaroundOk ? "yes" : "no"}
              onChange={(v) => setTurnaroundOk(v === "yes")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
            <Field
              label={`If not, what's your typical turnaround? (${TURNAROUND_MAX - turnaroundComment.length} characters left)`}
              htmlFor="t-turnaround-comment"
            >
              <FormTextarea
                id="t-turnaround-comment"
                value={turnaroundComment}
                onChange={(e) => setTurnaroundComment(e.target.value.slice(0, TURNAROUND_MAX))}
                maxLength={TURNAROUND_MAX}
                rows={3}
                placeholder="Optional"
              />
            </Field>
          </Section>

          {/* ---- 7. Tools & stack ---- */}
          <Section title="7. Tools & stack" subtitle="Select all that apply.">
            <CheckboxGroup
              legend="Tools you regularly use"
              required
              values={tools}
              onToggle={(v) => toggleTool(v as Tool)}
              options={TOOLS.map((t) => ({ value: t, label: TOOLS_LABELS[t] }))}
            />
            {tools.includes("OTHER") && (
              <Field label="Describe your other tools" required htmlFor="t-tools-other">
                <FormInput
                  id="t-tools-other"
                  value={toolsOther}
                  onChange={(e) => setToolsOther(e.target.value)}
                  aria-required
                  maxLength={120}
                  placeholder="Sketch, Affinity Designer, Blender, …"
                />
              </Field>
            )}
          </Section>

          {/* ---- 8. Test task ---- */}
          <Section title="8. Test task">
            <RadioGroup
              legend="We may ask for a short paid test task. Are you open to it?"
              required
              name="testTaskOk"
              value={testTaskOk === null ? "" : testTaskOk ? "yes" : "no"}
              onChange={(v) => setTestTaskOk(v === "yes")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
          </Section>

          {/* ---- 9. Final confirmation ---- */}
          <Section title="9. Final check">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--bb-text-secondary)]">
              <input
                type="checkbox"
                checked={communicationConfirmed}
                onChange={(e) => setCommunicationConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--bb-primary)]"
              />
              <span>
                I confirm I can communicate clearly and respond quickly during active tasks.
              </span>
            </label>
          </Section>

          {/* ---- Turnstile ---- */}
          {turnstileSiteKey && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
                options={{ theme: "light", size: "flexible" }}
              />
            </div>
          )}

          {submitError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!isSubmittable || applicationsOpen === false}
            aria-disabled={!isSubmittable || applicationsOpen === false}
            loading={status === "submitting"}
            loadingText="Submitting…"
          >
            {applicationsOpen === false ? "Applications closed" : "Submit application"}
          </Button>

          <p className="text-center text-xs text-[var(--bb-text-muted)]">
            By submitting you agree we may store and review the information above to evaluate your
            application.
          </p>
        </form>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local presentational helpers — kept inside this file because they're not
// reused elsewhere yet. Extract into components/ui/ if a second form
// adopts the same patterns.
// ---------------------------------------------------------------------------

function SlimHeader() {
  return (
    <header className="flex items-center border-b border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] px-6 py-4">
      <Link
        href="/"
        className="text-lg font-bold text-[var(--bb-secondary)]"
        aria-label="Back to Brandbite home"
      >
        <span className="text-[var(--bb-primary)]">b</span>randbite
      </Link>
    </header>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--bb-secondary)]">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-[var(--bb-text-muted)]">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-[var(--bb-secondary)]"
      >
        {label}
        {required && <span className="ml-0.5 text-[var(--bb-primary)]">*</span>}
      </label>
      {children}
    </div>
  );
}

type RadioOption = { value: string; label: string };

function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
  required,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-[var(--bb-secondary)]">
        {legend}
        {required && <span className="ml-0.5 text-[var(--bb-primary)]">*</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/10 text-[var(--bb-secondary)]"
                  : "border-[var(--bb-border-subtle)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 accent-[var(--bb-primary)]"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function CheckboxGroup({
  legend,
  values,
  onToggle,
  options,
  required,
}: {
  legend: string;
  values: string[];
  onToggle: (v: string) => void;
  options: RadioOption[];
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-[var(--bb-secondary)]">
        {legend}
        {required && <span className="ml-0.5 text-[var(--bb-primary)]">*</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = values.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                checked
                  ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]/10 text-[var(--bb-secondary)]"
                  : "border-[var(--bb-border-subtle)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt.value)}
                className="h-4 w-4 accent-[var(--bb-primary)]"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
