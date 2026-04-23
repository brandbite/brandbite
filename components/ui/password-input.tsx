// -----------------------------------------------------------------------------
// @file: components/ui/password-input.tsx
// @purpose: Password <input> with a show/hide eye toggle. Used on /login
//           and /reset-password. Keeps the same visual styling as the
//           other text inputs on those two pages, with an absolute-
//           positioned button over the right edge that flips the input's
//           `type` attribute between "password" and "text".
//
//           Does NOT weaken security — the 12-char + complexity policy
//           shipped in PR #168 is the actual defense. Revealing the
//           masked characters in the browser is a UX nicety, especially
//           for the long passphrases the policy now effectively
//           requires.
// -----------------------------------------------------------------------------

"use client";

import type { InputHTMLAttributes, SVGProps } from "react";
import { useId, useState } from "react";

// Same visual class string used today on the raw password inputs across
// /login and /reset-password. Hardcoded rather than imported from
// form-field.tsx because those pages use raw <input> with this exact
// shape, not FormInput — changing that is out of scope for this PR.
const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] py-2.5 pl-3.5 pr-10 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const fallbackId = useId();
  const inputId = props.id ?? `pwd-${fallbackId}`;

  return (
    <div className="relative">
      <input {...props} id={inputId} type={visible ? "text" : "password"} className={INPUT_CLASS} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={inputId}
        // tabIndex default — the toggle is reachable via keyboard in
        // form order, right after the input. This matters: a keyboard
        // user filling out the form can Tab to the toggle, Space to
        // reveal, Tab again to continue. Removing it from the tab
        // order would hide the affordance from keyboard-only users.
        className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)] focus-visible:rounded-r-xl focus-visible:ring-1 focus-visible:ring-[var(--bb-primary)] focus-visible:outline-none"
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Icons
//
// Inline stroke SVGs matching the existing `components/navigation/nav-icons.tsx`
// convention: 24x24 viewBox, `currentColor` stroke, 1.75 stroke-width,
// round caps + joins. Displayed at 16x16 which matches the sidebar nav
// icons and fits comfortably inside a form input's right-edge button.
// -----------------------------------------------------------------------------

const iconBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = SVGProps<SVGSVGElement>;

function IconEye(props: IconProps) {
  return (
    <svg {...iconBase} aria-hidden="true" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff(props: IconProps) {
  return (
    <svg {...iconBase} aria-hidden="true" {...props}>
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.64 17.64 0 0 1-3.17 4.19" />
      <path d="M6.61 6.61A17.64 17.64 0 0 0 2 12s3.5 7 10 7a10.94 10.94 0 0 0 5.94-1.74" />
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
