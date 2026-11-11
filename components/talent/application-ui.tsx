// -----------------------------------------------------------------------------
// @file: components/talent/application-ui.tsx
// @purpose: Look of the /talent application (2026-11 redesign): page chrome
//           with "Back to home", the lavender progress panel (creative role
//           colour), step card, section headings with icon tiles, fields and
//           choice chips. Pure presentational; the form logic lives in
//           app/talent/page.tsx.
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { copyrightLine } from "@/lib/brand";
import { ROLE_COLORS } from "@/lib/role-colors";

const LAVENDER = ROLE_COLORS.creative.bg; // #EEE9FF
const LAVENDER_INK = ROLE_COLORS.creative.text; // #49368D
const LAVENDER_ACCENT = "#7C5CE0";
const INK = "#2B2D33";
const MUTED = "#5E616E";

export const TALENT_DISPLAY_FONT = "font-[family-name:var(--font-jakarta)]";

/** Text fields and selects. 16px text keeps iPhone Safari from zooming in. */
export const TALENT_INPUT_CLASS =
  "h-11 w-full rounded-lg border border-[#D7D8DD] bg-white px-4 text-base text-[#2B2D33] outline-none placeholder:text-[#9A9CA5] focus:border-[#FF6426] focus:ring-1 focus:ring-[#FF6426] disabled:cursor-not-allowed disabled:bg-[#F4F2EF] disabled:text-[#9A9CA5] aria-[invalid=true]:border-red-500";

/** The orange action button, in the site's CTA colours (same as AUTH_PRIMARY_BUTTON_CLASS). */
export const TALENT_PRIMARY_BUTTON_CLASS =
  "inline-flex h-12 items-center justify-center gap-2.5 rounded-lg bg-[#FF6426] px-6 text-base font-bold text-white transition-colors hover:bg-[#E8561C] focus-visible:ring-2 focus-visible:ring-[#FF6426] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const TALENT_SECONDARY_BUTTON_CLASS =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#D7D8DD] bg-white px-4 text-sm font-semibold text-[#2B2D33] transition-colors hover:border-[#2B2D33] focus-visible:ring-2 focus-visible:ring-[#FF6426] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

export function TalentShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F7F4F1] text-[#2B2D33]">
      <header className="flex items-center justify-between border-b border-[#E6E2DD] px-10 py-4 max-[1023px]:px-6 max-[767px]:px-4">
        <Link href="/" className="flex shrink-0" aria-label="brandbite home">
          <Image
            src="/brandbite-logo.svg"
            alt="brandbite"
            width={148}
            height={30}
            priority
            className="max-[767px]:h-6 max-[767px]:w-auto"
          />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-medium text-[#2B2D33] transition-colors hover:text-[#FF6426] max-[767px]:text-sm"
        >
          <ArrowIcon direction="left" />
          Back to home
        </Link>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1480px] flex-1 px-14 py-8 max-[1279px]:px-10 max-[1023px]:px-6 max-[1023px]:py-6 max-[767px]:px-4"
      >
        {children}
      </main>
      <footer className="border-t border-[#E6E2DD] px-10 py-3 text-xs leading-5 font-medium text-[#5E616E] max-[1023px]:px-6 max-[1023px]:text-center max-[767px]:px-4">
        <p>
          {copyrightLine()} ·{" "}
          <Link href="/privacy" className="hover:text-[#2B2D33]">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress panel
// ---------------------------------------------------------------------------

export type StepState = "done" | "current" | "todo";

export function ProgressPanel({
  steps,
  current,
  reached,
  onGoTo,
}: {
  steps: readonly string[];
  current: number;
  /** Furthest step the applicant has opened; steps up to it can be revisited. */
  reached: number;
  onGoTo: (index: number) => void;
}) {
  return (
    <aside
      className="relative rounded-2xl p-8 max-[1023px]:p-5"
      style={{ background: `linear-gradient(160deg, ${LAVENDER} 0%, #E9E2FC 100%)` }}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
          style={{ backgroundColor: "#E1D8FB", color: LAVENDER_INK }}
        >
          Creative application
        </span>
        <SparkIcon />
      </div>

      <h1
        className={`${TALENT_DISPLAY_FONT} mt-6 text-[44px] leading-[1.08] font-extrabold tracking-tight max-[1023px]:mt-4 max-[1023px]:text-[30px]`}
        style={{ color: INK }}
      >
        Apply to join brandbite
      </h1>
      <p
        className="mt-4 text-lg leading-7 max-[1023px]:mt-2 max-[1023px]:text-base"
        style={{ color: INK }}
      >
        Tell us about your work and how you&rsquo;d like to collaborate.
      </p>
      <p
        className="mt-5 flex items-center gap-2.5 text-base max-[1023px]:mt-3"
        style={{ color: INK }}
      >
        <ClockIcon />
        About 4 minutes
      </p>

      {/* Desktop: the full list of steps. */}
      <ol className="mt-10 max-[1023px]:hidden" aria-label="Application steps">
        {steps.map((title, i) => {
          const state: StepState = i < current ? "done" : i === current ? "current" : "todo";
          const canGo = i <= reached && i !== current;
          const row = (
            <>
              <StepDot index={i} state={state} />
              <span className={`text-lg ${state === "current" ? "font-bold" : "font-medium"}`}>
                {title}
              </span>
            </>
          );
          return (
            <li key={title} className="relative">
              {i > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-6 left-[39px] h-6 w-px"
                  style={{ backgroundColor: "#8E86A8" }}
                />
              )}
              {canGo ? (
                <button
                  type="button"
                  onClick={() => onGoTo(i)}
                  className="flex w-full items-center gap-4 rounded-xl px-5 py-3 text-left transition-colors hover:bg-white/50 focus-visible:ring-2 focus-visible:ring-[#7C5CE0] focus-visible:outline-none"
                  style={{ color: INK }}
                >
                  {row}
                  <span className="sr-only">(go back to this step)</span>
                </button>
              ) : (
                <div
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex items-center gap-4 rounded-xl px-5 py-3"
                  style={{
                    color: INK,
                    backgroundColor: state === "current" ? "#E1D8FB" : undefined,
                  }}
                >
                  {row}
                </div>
              )}
              {i < steps.length - 1 && <div className="h-6" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {/* Phone / tablet: a slim progress bar instead of the list. */}
      <div className="mt-5 hidden max-[1023px]:block">
        <p className="sr-only">
          Step {current + 1} of {steps.length} · {steps[current]}
        </p>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
        >
          {steps.map((title, i) => (
            <span
              key={title}
              aria-hidden
              className="h-1.5 rounded-full"
              style={{ backgroundColor: i <= current ? LAVENDER_INK : "#D5CCF2" }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function StepDot({ index, state }: { index: number; state: StepState }) {
  if (state === "done") {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: LAVENDER_INK, color: "#fff" }}
        aria-label="Done"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12.5 10 17 19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold"
      style={
        state === "current"
          ? { backgroundColor: LAVENDER_INK, color: "#fff" }
          : { backgroundColor: "#fff", color: INK, border: `1.5px solid ${INK}` }
      }
    >
      {index + 1}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

export function StepCard({
  index,
  total,
  title,
  children,
  footer,
}: {
  index: number;
  total: number;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E6E2DD] bg-white p-10 max-[1023px]:p-6 max-[767px]:p-5">
      <p className="text-sm font-bold tracking-[0.14em] uppercase" style={{ color: MUTED }}>
        Step {index + 1} of {total}
      </p>
      <h2
        tabIndex={-1}
        data-step-heading
        className={`${TALENT_DISPLAY_FONT} mt-2 text-[40px] leading-[1.1] font-extrabold tracking-tight outline-none max-[767px]:text-[30px]`}
        style={{ color: INK }}
      >
        {title}
      </h2>
      <p className="mt-2 text-base" style={{ color: MUTED }}>
        Fields marked with <span className="text-[#E8561C]">*</span> are required.
      </p>
      <div className="mt-8 space-y-10">{children}</div>
      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#E6E2DD] pt-6">
        {footer}
      </div>
    </section>
  );
}

/** One group of fields inside a step, with its lavender icon tile. */
export function FieldGroup({
  icon,
  title,
  hint,
  children,
  divider = false,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: ReactNode;
  divider?: boolean;
}) {
  return (
    <div className={divider ? "border-t border-[#E6E2DD] pt-10" : undefined}>
      <div className="mb-5 flex items-center gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: LAVENDER, color: LAVENDER_INK }}
        >
          <GroupIcon name={icon} />
        </span>
        <div>
          <h3 className={`${TALENT_DISPLAY_FONT} text-2xl font-bold`} style={{ color: INK }}>
            {title}
          </h3>
          {hint && (
            <p className="text-sm" style={{ color: MUTED }}>
              {hint}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-base font-medium" style={{ color: INK }}>
        {label}
        {required && <span className="ml-1 text-[#E8561C]">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-sm" style={{ color: MUTED }}>
          {hint}
        </p>
      )}
      <FieldError id={`${htmlFor}-error`} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

/** Native select with our chevron. */
export function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <div className="relative">
      <select {...rest} className={`${TALENT_INPUT_CLASS} appearance-none pr-11 ${className}`}>
        {children}
      </select>
      <svg
        aria-hidden
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
        style={{ color: rest.disabled ? "#9A9CA5" : INK }}
      >
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

type ChoiceOption = { value: string; label: string };

/** Radio buttons or checkboxes drawn as chips. */
export function ChoiceGroup({
  id,
  legend,
  hint,
  type,
  name,
  options,
  selected,
  onToggle,
  required,
  error,
  columns = false,
}: {
  id: string;
  legend: string;
  hint?: string;
  type: "radio" | "checkbox";
  name: string;
  options: ChoiceOption[];
  selected: string[];
  onToggle: (value: string) => void;
  required?: boolean;
  error?: string;
  /** Two columns on wider screens (long lists like skill categories). */
  columns?: boolean;
}) {
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className="outline-none"
    >
      <legend className="mb-2 block text-base font-medium" style={{ color: INK }}>
        {legend}
        {required && <span className="ml-1 text-[#E8561C]">*</span>}
      </legend>
      {hint && (
        <p className="-mt-1 mb-3 text-sm" style={{ color: MUTED }}>
          {hint}
        </p>
      )}
      <div
        className={columns ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : "flex flex-wrap gap-2.5"}
      >
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-base transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#FF6426] ${
                checked
                  ? "border-[#FF6426] bg-[#FFF3EC] text-[#2B2D33]"
                  : error
                    ? "border-red-300 bg-white text-[#2B2D33] hover:border-[#FF6426]"
                    : "border-[#D7D8DD] bg-white text-[#2B2D33] hover:border-[#FF6426]"
              }`}
            >
              <input
                type={type}
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onToggle(opt.value)}
                className="h-4 w-4 shrink-0 accent-[#FF6426]"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Icons (24px line icons, currentColor)
// ---------------------------------------------------------------------------

export type IconName =
  | "user"
  | "link"
  | "spark"
  | "briefcase"
  | "calendar"
  | "clock"
  | "tools"
  | "task"
  | "check";

const ICON_PATHS: Record<IconName, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>
  ),
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  tools: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.3-.3-2.4z" />
    </>
  ),
  task: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11h6M9 15h4" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16.5 9.5" />
    </>
  ),
};

function GroupIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      aria-hidden
      className="shrink-0 max-[1023px]:h-9 max-[1023px]:w-9"
    >
      <g stroke={LAVENDER_ACCENT} strokeWidth="5" strokeLinecap="round">
        <path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19" />
      </g>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d={direction === "left" ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
