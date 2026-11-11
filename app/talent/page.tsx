// -----------------------------------------------------------------------------
// @file: app/talent/page.tsx
// @purpose: Public talent application form. Anonymous, Turnstile-gated,
//           POSTs to /api/talent/applications. Categories load on mount
//           from /api/talent/categories.
//
//           2026-11 redesign: the nine sections are grouped into four steps
//           (Profile & portfolio → Skills & experience → Availability &
//           tools → Final check), with a lavender progress panel. Each
//           step is checked before Continue moves on, so nobody reaches
//           the end to find an error on step one. Look lives in
//           components/talent/application-ui.tsx.
//
//           Conditional fields — kept in sync with the Zod refinements
//           in lib/schemas/talent-application.schemas.ts:
//             - yearsRemote shown only when hasRemoteExp === true
//             - preferredTasksPerWeek shown only when workload === FULL_TIME
//             - toolsOther shown only when "OTHER" is in tools
//
//           Layout chrome: minimal (logo + "Back to home"), no marketing
//           nav. Same posture as /login — multi-step forms convert better
//           without escape hatches.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import {
  ArrowIcon,
  ChoiceGroup,
  Field,
  FieldGroup,
  PlusIcon,
  ProgressPanel,
  SelectField,
  StepCard,
  TALENT_DISPLAY_FONT,
  TALENT_INPUT_CLASS,
  TALENT_PRIMARY_BUTTON_CLASS,
  TALENT_SECONDARY_BUTTON_CLASS,
  TalentShell,
} from "@/components/talent/application-ui";
import { CountryCodePicker } from "@/components/ui/country-code-picker";
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

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const STEPS = [
  "Profile & portfolio",
  "Skills & experience",
  "Availability & tools",
  "Final check",
] as const;

// ---------------------------------------------------------------------------
// Local form state. Keep flat — easier to reason about than nested objects.
// ---------------------------------------------------------------------------

type Category = { id: string; name: string; slug: string; sortOrder: number };

type Status = "idle" | "loading-categories" | "submitting" | "success" | "error";

/** Field id → message, for one step. The id is also what gets focus. */
type StepErrors = Record<string, string>;

const MAX_SOCIAL_LINKS = 3;
// Polish round 1: lowered from 3 to 1 — keep in sync with the Zod
// `.min(...)` in lib/schemas/talent-application.schemas.ts. The legend
// + counter copy below also references this value.
const MIN_CATEGORIES = 1;
const TURNAROUND_MAX = 120;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "behance.net/me" → "https://behance.net/me", so a missing scheme isn't an error. */
function withScheme(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function isUrl(value: string): boolean {
  try {
    const u = new URL(withScheme(value));
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

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

  // -- Steps ---------------------------------------------------------------
  const [step, setStep] = useState(0);
  /** Furthest step opened, so the panel can jump back to any of them. */
  const [reached, setReached] = useState(0);
  /** Steps where Continue was pressed: their errors show from then on. */
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(() => new Set());
  const cardRef = useRef<HTMLDivElement | null>(null);

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
  // auto-selected by the handler below. Before any country is picked we
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

  // -- Per-step checks -------------------------------------------------------
  // Mirror the Zod refinements; the server is the source of truth, but
  // catching a gap on the step it belongs to is kinder than a 400 at the end.
  const errorsByStep = useMemo((): StepErrors[] => {
    const profile: StepErrors = {};
    if (fullName.trim().length < 2) profile["t-fullName"] = "Enter your full name.";
    if (!EMAIL_RE.test(email.trim())) profile["t-email"] = "Enter a valid email address.";
    if (!countryIso) profile["t-country"] = "Select your country.";
    if (!timezone) profile["t-timezone"] = "Select your timezone.";
    if (!whatsappCountryIso) profile["t-whatsapp-cc"] = "Pick your country code.";
    else if (whatsappLocal.replace(/\D/g, "").length < 4)
      profile["t-whatsapp-local"] = "Enter your WhatsApp number.";
    if (!isUrl(portfolioUrl)) profile["t-portfolio"] = "Enter a link to your portfolio.";
    if (linkedinUrl.trim() && !isUrl(linkedinUrl))
      profile["t-linkedin"] = "This doesn't look like a link.";
    socialLinks.forEach((link, i) => {
      if (link.trim() && !isUrl(link)) profile[`t-social-${i}`] = "This doesn't look like a link.";
    });

    const skills: StepErrors = {};
    if (categoryIds.length < MIN_CATEGORIES)
      skills["t-categories"] =
        MIN_CATEGORIES === 1 ? "Pick at least one." : `Pick at least ${MIN_CATEGORIES}.`;
    if (!totalYears) skills["t-totalYears"] = "Choose one.";
    if (hasRemoteExp === null) skills["t-hasRemoteExp"] = "Choose one.";
    if (hasRemoteExp && !yearsRemote) skills["t-yearsRemote"] = "Choose one.";
    if (workedWith.length === 0) skills["t-workedWith"] = "Pick at least one.";

    const availability: StepErrors = {};
    if (!workload) availability["t-workload"] = "Choose one.";
    if (workload === "FULL_TIME" && !preferredTasksPerWeek)
      availability["t-preferredTasksPerWeek"] = "Choose one.";
    if (turnaroundOk === null) availability["t-turnaroundOk"] = "Choose one.";
    if (tools.length === 0) availability["t-tools"] = "Pick at least one.";
    if (tools.includes("OTHER") && !toolsOther.trim())
      availability["t-tools-other"] = "Tell us which other tools you use.";

    const final: StepErrors = {};
    if (testTaskOk === null) final["t-testTaskOk"] = "Choose one.";
    if (!communicationConfirmed) final["t-communication"] = "Please confirm to continue.";
    if (turnstileSiteKey && !turnstileToken)
      final["t-turnstile"] = "Please wait for the check above to finish.";

    return [profile, skills, availability, final];
  }, [
    fullName,
    email,
    countryIso,
    timezone,
    whatsappCountryIso,
    whatsappLocal,
    portfolioUrl,
    linkedinUrl,
    socialLinks,
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

  /** The message for a field, once its step has been checked. */
  function err(stepIndex: number, fieldId: string): string | undefined {
    return checkedSteps.has(stepIndex) ? errorsByStep[stepIndex]![fieldId] : undefined;
  }

  /** aria wiring for a text field. */
  function invalidProps(stepIndex: number, fieldId: string) {
    const message = err(stepIndex, fieldId);
    return message ? { "aria-invalid": true as const, "aria-describedby": `${fieldId}-error` } : {};
  }

  function focusFirstError(errors: StepErrors) {
    const first = Object.keys(errors)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  }

  function goTo(index: number) {
    setStep(index);
    setReached((r) => Math.max(r, index));
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      cardRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({
        preventScroll: true,
      });
    });
  }

  function handleContinue() {
    setCheckedSteps((prev) => new Set(prev).add(step));
    const errors = errorsByStep[step]!;
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }
    goTo(step + 1);
  }

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
    if (step < STEPS.length - 1) {
      // Enter in a field on steps 1–3 means Continue, not submit.
      handleContinue();
      return;
    }
    if (status === "submitting" || applicationsOpen === false) return;

    setCheckedSteps(new Set(STEPS.map((_, i) => i)));
    const broken = errorsByStep.findIndex((errors) => Object.keys(errors).length > 0);
    if (broken !== -1) {
      if (broken !== step) goTo(broken);
      focusFirstError(errorsByStep[broken]!);
      return;
    }

    setStatus("submitting");
    setSubmitError(null);

    const cleanedSocialLinks = socialLinks.map((s) => withScheme(s)).filter(Boolean);

    const payload = {
      fullName: fullName.trim(),
      whatsappNumber: whatsappNumber.trim(),
      email: email.trim(),
      country: country.trim(),
      timezone,
      portfolioUrl: withScheme(portfolioUrl),
      linkedinUrl: withScheme(linkedinUrl) || null,
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
      window.scrollTo({ top: 0 });
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
      <TalentShell>
        <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center max-[767px]:py-8">
          <div
            role="status"
            className="w-full rounded-2xl border border-[#E6E2DD] bg-white p-10 max-[767px]:p-6"
          >
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEE9FF] text-[#49368D]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5 10 17 19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h1
              className={`${TALENT_DISPLAY_FONT} text-[32px] leading-tight font-extrabold tracking-tight`}
            >
              Application received
            </h1>
            <p className="mt-3 text-base leading-7 text-[#5E616E]">
              Thanks, {fullName.trim().split(/\s+/)[0] || "there"}. We review every application
              personally and reply within a few days. Keep an eye on your inbox at{" "}
              <strong className="text-[#2B2D33]">{email.trim()}</strong>.
            </p>
            <Link href="/" className={`${TALENT_SECONDARY_BUTTON_CLASS} mt-8`}>
              Back to home
            </Link>
          </div>
        </div>
      </TalentShell>
    );
  }

  const closed = applicationsOpen === false;
  const lastStep = step === STEPS.length - 1;

  // ---------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------
  return (
    <TalentShell>
      <div className="grid grid-cols-[minmax(320px,400px)_1fr] items-stretch gap-6 max-[1023px]:grid-cols-1">
        <div className="max-[1023px]:static [&>aside]:h-full">
          <ProgressPanel steps={STEPS} current={step} reached={reached} onGoTo={goTo} />
        </div>

        <div ref={cardRef} className="min-w-0 scroll-mt-6">
          {categoriesError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {categoriesError}
            </p>
          )}

          {closed && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-semibold">Applications are temporarily closed.</p>
              <p className="mt-0.5">
                We&rsquo;re at capacity right now. Check back soon. We&rsquo;ll reopen when we can
                take on new creatives.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <StepCard
              index={step}
              total={STEPS.length}
              title={STEPS[step]}
              footer={
                <>
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goTo(step - 1)}
                      className={TALENT_SECONDARY_BUTTON_CLASS}
                    >
                      <ArrowIcon direction="left" />
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {lastStep ? (
                    <button
                      type="submit"
                      className={TALENT_PRIMARY_BUTTON_CLASS}
                      disabled={status === "submitting" || closed}
                    >
                      {closed
                        ? "Applications closed"
                        : status === "submitting"
                          ? "Submitting…"
                          : "Submit application"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleContinue}
                      className={TALENT_PRIMARY_BUTTON_CLASS}
                    >
                      Continue
                      <ArrowIcon direction="right" />
                    </button>
                  )}
                </>
              }
            >
              {step === 0 && (
                <>
                  <FieldGroup icon="user" title="Basic info">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                      <Field
                        label="Full name"
                        required
                        htmlFor="t-fullName"
                        error={err(0, "t-fullName")}
                      >
                        <input
                          id="t-fullName"
                          className={TALENT_INPUT_CLASS}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          aria-required
                          autoComplete="name"
                          maxLength={120}
                          placeholder="Your full name"
                          {...invalidProps(0, "t-fullName")}
                        />
                      </Field>
                      <Field label="Email" required htmlFor="t-email" error={err(0, "t-email")}>
                        <input
                          id="t-email"
                          type="email"
                          className={TALENT_INPUT_CLASS}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-required
                          autoComplete="email"
                          maxLength={320}
                          placeholder="you@example.com"
                          {...invalidProps(0, "t-email")}
                        />
                      </Field>
                      <Field
                        label="Country of residence"
                        required
                        htmlFor="t-country"
                        error={err(0, "t-country")}
                      >
                        <SelectField
                          id="t-country"
                          value={countryIso}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          aria-required
                          autoComplete="country-name"
                          {...invalidProps(0, "t-country")}
                        >
                          <option value="">Select your country</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.iso2} value={c.iso2}>
                              {c.name}
                            </option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field
                        label="Timezone"
                        required
                        htmlFor="t-timezone"
                        error={err(0, "t-timezone")}
                      >
                        <SelectField
                          id="t-timezone"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          aria-required
                          disabled={!countryIso}
                          {...invalidProps(0, "t-timezone")}
                        >
                          <option value="">
                            {countryIso ? "Select your timezone" : "Pick a country first"}
                          </option>
                          {timezoneOptions.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz.replace(/_/g, " ")}
                            </option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field
                        label="WhatsApp number"
                        required
                        htmlFor="t-whatsapp-local"
                        className="md:col-span-2"
                        hint="We use WhatsApp for quick questions while a request is live."
                        error={err(0, "t-whatsapp-cc") ?? err(0, "t-whatsapp-local")}
                      >
                        {/* Country code picker, dial code and local number read as
                            one control. We own the state and derive the E.164
                            submit string from it. */}
                        <div
                          className={`flex items-stretch rounded-lg ${
                            err(0, "t-whatsapp-cc") || err(0, "t-whatsapp-local")
                              ? "ring-1 ring-red-500"
                              : ""
                          }`}
                        >
                          <CountryCodePicker
                            id="t-whatsapp-cc"
                            ariaLabel="WhatsApp country code"
                            value={whatsappCountryIso}
                            onChange={setWhatsappCountryIso}
                          />
                          {whatsappDialCode && (
                            <span
                              aria-hidden
                              className="flex items-center border-y border-[#D7D8DD] bg-white pl-3 text-base text-[#5E616E]"
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
                            {...(err(0, "t-whatsapp-cc") || err(0, "t-whatsapp-local")
                              ? { "aria-describedby": "t-whatsapp-local-error" }
                              : {})}
                            className="h-11 min-w-0 flex-1 rounded-r-lg border border-l-0 border-[#D7D8DD] bg-white px-3 text-base text-[#2B2D33] outline-none placeholder:text-[#9A9CA5] focus:border-[#FF6426] disabled:cursor-not-allowed disabled:bg-[#F4F2EF]"
                          />
                        </div>
                      </Field>
                    </div>
                  </FieldGroup>

                  <FieldGroup icon="link" title="Portfolio & presence" divider>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                      <Field
                        label="Portfolio URL"
                        required
                        htmlFor="t-portfolio"
                        error={err(0, "t-portfolio")}
                      >
                        <input
                          id="t-portfolio"
                          type="url"
                          inputMode="url"
                          className={TALENT_INPUT_CLASS}
                          value={portfolioUrl}
                          onChange={(e) => setPortfolioUrl(e.target.value)}
                          aria-required
                          placeholder="https://yourportfolio.com"
                          maxLength={500}
                          {...invalidProps(0, "t-portfolio")}
                        />
                      </Field>
                      <Field
                        label="LinkedIn (optional)"
                        htmlFor="t-linkedin"
                        error={err(0, "t-linkedin")}
                      >
                        <input
                          id="t-linkedin"
                          type="url"
                          inputMode="url"
                          className={TALENT_INPUT_CLASS}
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/…"
                          maxLength={500}
                          {...invalidProps(0, "t-linkedin")}
                        />
                      </Field>
                    </div>

                    <fieldset>
                      <legend className="mb-2 block text-base font-medium">
                        Other links (optional)
                      </legend>
                      <div className="space-y-3">
                        {socialLinks.map((value, idx) => {
                          const isLast = idx === socialLinks.length - 1;
                          const id = `t-social-${idx}`;
                          return (
                            <div key={idx}>
                              <div className="flex gap-3 max-[479px]:flex-col">
                                <input
                                  id={id}
                                  type="url"
                                  inputMode="url"
                                  className={TALENT_INPUT_CLASS}
                                  value={value}
                                  onChange={(e) => updateSocialLink(idx, e.target.value)}
                                  placeholder="Instagram, Behance, Dribbble…"
                                  maxLength={500}
                                  aria-label={`Other link ${idx + 1}`}
                                  {...invalidProps(0, id)}
                                />
                                {socialLinks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSocialLink(idx)}
                                    className={`${TALENT_SECONDARY_BUTTON_CLASS} shrink-0`}
                                    aria-label={`Remove link ${idx + 1}`}
                                  >
                                    Remove
                                  </button>
                                )}
                                {isLast && socialLinks.length < MAX_SOCIAL_LINKS && (
                                  <button
                                    type="button"
                                    onClick={addSocialLink}
                                    className={`${TALENT_SECONDARY_BUTTON_CLASS} shrink-0`}
                                  >
                                    <PlusIcon />
                                    Add another
                                  </button>
                                )}
                              </div>
                              {err(0, id) && (
                                <p
                                  id={`${id}-error`}
                                  className="mt-1.5 text-sm font-medium text-red-700"
                                >
                                  {err(0, id)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  </FieldGroup>
                </>
              )}

              {step === 1 && (
                <>
                  <FieldGroup icon="spark" title="Skills & expertise">
                    {status === "loading-categories" ? (
                      <p className="text-base text-[#5E616E]">Loading categories…</p>
                    ) : (
                      <>
                        <ChoiceGroup
                          id="t-categories"
                          legend="What do you do best?"
                          hint="Pick every area you'd take requests in."
                          type="checkbox"
                          name="categoryIds"
                          required
                          columns
                          options={categories.map((c) => ({ value: c.id, label: c.name }))}
                          selected={categoryIds}
                          onToggle={toggleCategoryId}
                          error={err(1, "t-categories")}
                        />
                        <p className="text-sm text-[#5E616E]" aria-live="polite">
                          {categoryIds.length} of {categories.length} selected
                        </p>
                      </>
                    )}
                  </FieldGroup>

                  <FieldGroup icon="briefcase" title="Experience" divider>
                    <ChoiceGroup
                      id="t-totalYears"
                      legend="Total years of work experience"
                      type="radio"
                      name="totalYears"
                      required
                      options={TOTAL_YEARS.map((y) => ({ value: y, label: TOTAL_YEARS_LABELS[y] }))}
                      selected={totalYears ? [totalYears] : []}
                      onToggle={(v) => setTotalYears(v as TotalYears)}
                      error={err(1, "t-totalYears")}
                    />
                    <ChoiceGroup
                      id="t-hasRemoteExp"
                      legend="Have you worked remotely before?"
                      type="radio"
                      name="hasRemoteExp"
                      required
                      options={YES_NO}
                      selected={hasRemoteExp === null ? [] : [hasRemoteExp ? "yes" : "no"]}
                      onToggle={(v) => {
                        const next = v === "yes";
                        setHasRemoteExp(next);
                        if (!next) setYearsRemote("");
                      }}
                      error={err(1, "t-hasRemoteExp")}
                    />
                    {hasRemoteExp === true && (
                      <ChoiceGroup
                        id="t-yearsRemote"
                        legend="How many years of remote work?"
                        type="radio"
                        name="yearsRemote"
                        required
                        options={TOTAL_YEARS.map((y) => ({
                          value: y,
                          label: TOTAL_YEARS_LABELS[y],
                        }))}
                        selected={yearsRemote ? [yearsRemote] : []}
                        onToggle={(v) => setYearsRemote(v as TotalYears)}
                        error={err(1, "t-yearsRemote")}
                      />
                    )}
                    <ChoiceGroup
                      id="t-workedWith"
                      legend="Who have you worked with?"
                      hint="Select all that apply."
                      type="checkbox"
                      name="workedWith"
                      required
                      options={WORKED_WITH.map((w) => ({ value: w, label: WORKED_WITH_LABELS[w] }))}
                      selected={workedWith}
                      onToggle={(v) => toggleWorkedWith(v as WorkedWith)}
                      error={err(1, "t-workedWith")}
                    />
                  </FieldGroup>
                </>
              )}

              {step === 2 && (
                <>
                  <FieldGroup icon="calendar" title="Availability">
                    <ChoiceGroup
                      id="t-workload"
                      legend="Weekly availability"
                      type="radio"
                      name="workload"
                      required
                      options={WORKLOAD.map((w) => ({ value: w, label: WORKLOAD_LABELS[w] }))}
                      selected={workload ? [workload] : []}
                      onToggle={(v) => {
                        setWorkload(v as Workload);
                        if (v !== "FULL_TIME") setPreferredTasksPerWeek("");
                      }}
                      error={err(2, "t-workload")}
                    />
                    {workload === "FULL_TIME" && (
                      <ChoiceGroup
                        id="t-preferredTasksPerWeek"
                        legend="Preferred workload"
                        type="radio"
                        name="preferredTasksPerWeek"
                        required
                        options={TASKS_PER_WEEK.map((t) => ({
                          value: t,
                          label: TASKS_PER_WEEK_LABELS[t],
                        }))}
                        selected={preferredTasksPerWeek ? [preferredTasksPerWeek] : []}
                        onToggle={(v) => setPreferredTasksPerWeek(v as TasksPerWeek)}
                        error={err(2, "t-preferredTasksPerWeek")}
                      />
                    )}
                  </FieldGroup>

                  <FieldGroup icon="clock" title="Turnaround" divider>
                    <ChoiceGroup
                      id="t-turnaroundOk"
                      legend="Can you deliver most tasks within 24 to 48 hours?"
                      type="radio"
                      name="turnaroundOk"
                      required
                      options={YES_NO}
                      selected={turnaroundOk === null ? [] : [turnaroundOk ? "yes" : "no"]}
                      onToggle={(v) => setTurnaroundOk(v === "yes")}
                      error={err(2, "t-turnaroundOk")}
                    />
                    {turnaroundOk === false && (
                      <Field
                        label="What's your typical turnaround? (optional)"
                        htmlFor="t-turnaround-comment"
                        hint={`${TURNAROUND_MAX - turnaroundComment.length} characters left`}
                      >
                        <textarea
                          id="t-turnaround-comment"
                          value={turnaroundComment}
                          onChange={(e) =>
                            setTurnaroundComment(e.target.value.slice(0, TURNAROUND_MAX))
                          }
                          maxLength={TURNAROUND_MAX}
                          rows={3}
                          className={`${TALENT_INPUT_CLASS} h-auto py-3`}
                        />
                      </Field>
                    )}
                  </FieldGroup>

                  <FieldGroup icon="tools" title="Tools & stack" divider>
                    <ChoiceGroup
                      id="t-tools"
                      legend="Tools you use regularly"
                      hint="Select all that apply."
                      type="checkbox"
                      name="tools"
                      required
                      options={TOOLS.map((t) => ({ value: t, label: TOOLS_LABELS[t] }))}
                      selected={tools}
                      onToggle={(v) => toggleTool(v as Tool)}
                      error={err(2, "t-tools")}
                    />
                    {tools.includes("OTHER") && (
                      <Field
                        label="Which other tools?"
                        required
                        htmlFor="t-tools-other"
                        error={err(2, "t-tools-other")}
                      >
                        <input
                          id="t-tools-other"
                          className={TALENT_INPUT_CLASS}
                          value={toolsOther}
                          onChange={(e) => setToolsOther(e.target.value)}
                          aria-required
                          maxLength={120}
                          placeholder="Sketch, Affinity Designer, Blender…"
                          {...invalidProps(2, "t-tools-other")}
                        />
                      </Field>
                    )}
                  </FieldGroup>
                </>
              )}

              {step === 3 && (
                <>
                  <FieldGroup icon="task" title="Test task">
                    <ChoiceGroup
                      id="t-testTaskOk"
                      legend="We may ask for a short paid test task. Are you open to it?"
                      type="radio"
                      name="testTaskOk"
                      required
                      options={YES_NO}
                      selected={testTaskOk === null ? [] : [testTaskOk ? "yes" : "no"]}
                      onToggle={(v) => setTestTaskOk(v === "yes")}
                      error={err(3, "t-testTaskOk")}
                    />
                  </FieldGroup>

                  <FieldGroup icon="check" title="Confirm and send" divider>
                    <div>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 text-base ${
                          communicationConfirmed
                            ? "border-[#FF6426] bg-[#FFF3EC]"
                            : err(3, "t-communication")
                              ? "border-red-300 bg-white"
                              : "border-[#D7D8DD] bg-white"
                        }`}
                      >
                        <input
                          id="t-communication"
                          type="checkbox"
                          checked={communicationConfirmed}
                          onChange={(e) => setCommunicationConfirmed(e.target.checked)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#FF6426]"
                          {...invalidProps(3, "t-communication")}
                        />
                        <span>
                          I can communicate clearly and reply quickly while I&rsquo;m working on a
                          request.
                          <span className="ml-1 text-[#E8561C]">*</span>
                        </span>
                      </label>
                      {err(3, "t-communication") && (
                        <p
                          id="t-communication-error"
                          className="mt-1.5 text-sm font-medium text-red-700"
                        >
                          {err(3, "t-communication")}
                        </p>
                      )}
                    </div>

                    {turnstileSiteKey && (
                      <div id="t-turnstile" tabIndex={-1} className="outline-none">
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={turnstileSiteKey}
                          onSuccess={(token) => setTurnstileToken(token)}
                          onError={() => setTurnstileToken(null)}
                          onExpire={() => setTurnstileToken(null)}
                          options={{ theme: "light", size: "flexible" }}
                        />
                        {err(3, "t-turnstile") && (
                          <p className="mt-1.5 text-sm font-medium text-red-700">
                            {err(3, "t-turnstile")}
                          </p>
                        )}
                      </div>
                    )}

                    {submitError && (
                      <p
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                      >
                        {submitError}
                      </p>
                    )}

                    <p className="text-sm text-[#5E616E]">
                      By sending this you agree we may store and review your answers to evaluate
                      your application. See our{" "}
                      <Link href="/privacy" className="font-semibold text-[#2B2D33] underline">
                        privacy policy
                      </Link>
                      .
                    </p>
                  </FieldGroup>
                </>
              )}
            </StepCard>
          </form>
        </div>
      </div>
    </TalentShell>
  );
}
