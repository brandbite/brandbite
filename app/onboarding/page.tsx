// -----------------------------------------------------------------------------
// @file: app/onboarding/page.tsx
// @purpose: Customer onboarding wizard — set up company workspace.
//           Lives outside /customer route group to avoid layout redirect loops.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-11-05
// -----------------------------------------------------------------------------

"use client";

import React, { useState, type ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { copyrightLine } from "@/lib/brand";
import { useRouter } from "next/navigation";
import { generateAbbreviation } from "@/lib/abbreviation";
import { IconBuilding, IconUsers } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Eyebrow,
  Field,
  IconTile,
  Select,
  TextInput,
  TextLink,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconMoodboards } from "@/components/navigation/nav-icons";

const CHECK_PATH =
  "M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z";

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d={CHECK_PATH} clipRule="evenodd" />
    </svg>
  );
}

const SETUP_ITEMS: { title: string; text: string; tone: Tone; icon: ReactNode }[] = [
  {
    title: "Add your company",
    text: "Set up your workspace with your company details.",
    tone: "peach",
    icon: <IconBuilding />,
  },
  {
    title: "Invite your team",
    text: "Add team members so they can submit requests and review creative work.",
    tone: "lavender",
    icon: <IconUsers />,
  },
  {
    title: "Create your first project",
    text: "Organize requests by brand, campaign, or client.",
    tone: "green",
    icon: <IconMoodboards width={24} height={24} />,
  },
];

function SummaryRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[var(--av2-bg)] px-4 py-3 text-left">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--av2-success-bg)] text-[var(--av2-text)]">
        <CheckGlyph className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs break-words text-[var(--av2-text-2)]">{detail}</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();

  // Step state — 1: company, 2: invite team, 3: create project, 4: done
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Step 1 — Company
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyCreated, setCompanyCreated] = useState(false);

  // Step 2 — Invite team
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  // Step 3 — Project
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectCodeEdited, setProjectCodeEdited] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectCreated, setProjectCreated] = useState<string | null>(null);

  // Step 4 — finishing
  const [finishLoading, setFinishLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setCompanyError("Company name is required.");
      return;
    }
    setCompanyError(null);
    setCompanyLoading(true);
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName.trim(), website: website.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCompanyError(json?.error || "Failed to create company.");
        return;
      }
      setCompanyCreated(true);
      setStep(2);
    } catch {
      setCompanyError("Something went wrong. Please try again.");
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Email is required.");
      return;
    }
    setInviteError(null);
    setInviteLoading(true);
    try {
      const res = await fetch("/api/customer/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), roleInCompany: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json?.error || "Failed to send invite.");
        return;
      }
      setInvitedEmails((prev) => [...prev, inviteEmail.trim()]);
      setInviteEmail("");
    } catch {
      setInviteError("Something went wrong.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }
    setProjectError(null);
    setProjectLoading(true);
    try {
      const body: { name: string; code?: string } = { name: projectName.trim() };
      if (projectCode.trim().length === 3) {
        body.code = projectCode.trim().toUpperCase();
      }
      const res = await fetch("/api/customer/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setProjectError(json?.error || "Failed to create project.");
        return;
      }
      setProjectCreated(json.project?.name || projectName.trim());
      setStep(4);
    } catch {
      setProjectError("Something went wrong.");
    } finally {
      setProjectLoading(false);
    }
  };

  const handleFinish = async () => {
    setFinishLoading(true);
    try {
      await fetch("/api/customer/onboarding", { method: "PATCH" });
    } catch {
      // Don't block the redirect
    }
    router.push("/customer");
  };

  // ---------------------------------------------------------------------------
  // Stepper
  // ---------------------------------------------------------------------------

  const stepLabels = ["Company", "Team", "Project", "Done"];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const stepActions = (actions: ReactNode) => (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--av2-border)] pt-5">
      <p className="text-sm text-[var(--av2-text-2)]">
        Step {step} of {TOTAL_STEPS}
      </p>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <BrandLogo width={120} className="h-6 w-auto" />
        <p className="text-sm text-[var(--av2-text-2)]">Setting up your workspace</p>
      </header>

      {/* Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8">
        {/* Stepper */}
        <ol aria-label="Setup progress" className="mb-8 flex items-start justify-center">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <li
                    aria-hidden
                    className={`mt-4 h-0.5 w-8 sm:w-16 ${
                      isCompleted || isActive ? "bg-[var(--av2-accent)]" : "bg-[var(--av2-border)]"
                    }`}
                  />
                )}
                <li
                  aria-current={isActive ? "step" : undefined}
                  className="flex w-16 flex-col items-center gap-1.5"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      isActive
                        ? "bg-[var(--av2-accent-strong)] text-white"
                        : isCompleted
                          ? "bg-[var(--av2-success-bg)] text-[var(--av2-text)]"
                          : "bg-[var(--av2-track)] text-[var(--av2-text-2)]"
                    }`}
                  >
                    {isCompleted ? <CheckGlyph className="h-4 w-4" /> : stepNum}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-[var(--av2-link)]" : "text-[var(--av2-text-2)]"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              </React.Fragment>
            );
          })}
        </ol>

        <div className="grid gap-4 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
          {/* What the setup covers. Wide screens only: on a phone the form comes first. */}
          <aside className="hidden flex-col rounded-xl bg-[var(--av2-attention-from)] p-6 lg:flex">
            <Eyebrow>What we&apos;ll set up</Eyebrow>
            <ul className="mt-5 flex-1 space-y-6">
              {SETUP_ITEMS.map((item) => (
                <li key={item.title} className="flex gap-4">
                  <IconTile tone={item.tone}>{item.icon}</IconTile>
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-[var(--av2-attention-border)] pt-4">
              <TextLink href="/faq" external>
                Need help?
              </TextLink>
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-6">
            {/* ----- Step 1: Company ----- */}
            {step === 1 && (
              <div className="flex flex-col">
                <h1 className="text-[32px] leading-10 font-bold tracking-tight">
                  Welcome to brandbite
                </h1>
                <p className="mt-1 text-base font-medium">Let&apos;s set up your workspace.</p>
                <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                  We&apos;ll use these details to tailor your dashboard and assign your first
                  creative team.
                </p>

                <div className="mt-6 space-y-5">
                  <Field
                    htmlFor="onb-company-name"
                    label={
                      <>
                        Company Name <span className="text-[var(--av2-error-text)]">*</span>
                      </>
                    }
                  >
                    <TextInput
                      id="onb-company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Nova Labs, Horizon Agency"
                      autoComplete="organization"
                      aria-required="true"
                      aria-invalid={companyError ? true : undefined}
                    />
                  </Field>
                  <Field
                    htmlFor="onb-website"
                    label="Website"
                    hint="Don't worry, you can always update this later from your profile settings."
                  >
                    <TextInput
                      id="onb-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://www.yourcompany.com"
                    />
                  </Field>
                </div>

                {companyError && (
                  <div className="mt-5">
                    <Callout tone="error" title={companyError} />
                  </div>
                )}

                {stepActions(
                  <Button
                    variant="primary"
                    disabled={companyLoading}
                    aria-busy={companyLoading}
                    onClick={handleCreateCompany}
                  >
                    {companyLoading ? "Creating…" : "Create Company"}
                  </Button>,
                )}
              </div>
            )}

            {/* ----- Step 2: Invite Team ----- */}
            {step === 2 && (
              <div className="flex flex-col">
                <h1 className="text-[32px] leading-10 font-bold tracking-tight">
                  Invite your team
                </h1>
                <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                  Add team members so they can submit requests and review creative work. You can
                  always invite more people later.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                    <Field htmlFor="onb-invite-email" label="Email address">
                      <TextInput
                        id="onb-invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        // Inviting someone ELSE — don't autofill with the signed-in
                        // user's own email. "off" is the right signal.
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleInvite();
                        }}
                      />
                    </Field>
                    <Field htmlFor="onb-invite-role" label="Role">
                      <Select
                        id="onb-invite-role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="dark:[color-scheme:dark]"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="PM">Project Manager</option>
                        <option value="BILLING">Billing</option>
                      </Select>
                    </Field>
                  </div>

                  <Button
                    className="w-full"
                    disabled={inviteLoading}
                    aria-busy={inviteLoading}
                    onClick={handleInvite}
                  >
                    {inviteLoading ? "Sending…" : "+ Send invite"}
                  </Button>

                  {inviteError && <Callout tone="error" title={inviteError} />}

                  {invitedEmails.length > 0 && (
                    <div className="rounded-xl bg-[var(--av2-bg)] px-4 py-3">
                      <Eyebrow>Invited ({invitedEmails.length})</Eyebrow>
                      <ul className="mt-2 space-y-1.5">
                        {invitedEmails.map((email) => (
                          <li key={email} className="flex min-w-0 items-center gap-2 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--av2-success-bg)]">
                              <CheckGlyph className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 break-words">{email}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {stepActions(
                  <Button variant="primary" onClick={() => setStep(3)}>
                    {invitedEmails.length > 0 ? "Next" : "Skip"}
                  </Button>,
                )}
              </div>
            )}

            {/* ----- Step 3: Create Project ----- */}
            {step === 3 && (
              <div className="flex flex-col">
                <h1 className="text-[32px] leading-10 font-bold tracking-tight">
                  Create your first project
                </h1>
                <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                  Projects help you organize requests by brand, campaign, or client. You can always
                  create more later.
                </p>

                <div className="mt-6 space-y-5">
                  <Field htmlFor="onb-project-name" label="Project Name">
                    <TextInput
                      id="onb-project-name"
                      type="text"
                      value={projectName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProjectName(val);
                        if (!projectCodeEdited && val.trim()) {
                          setProjectCode(generateAbbreviation(val));
                        }
                      }}
                      placeholder="e.g. Website Redesign, Social Media Q1"
                      aria-invalid={projectError ? true : undefined}
                    />
                  </Field>

                  <Field
                    htmlFor="onb-project-code"
                    label="Project Code"
                    hint="3-letter code for request IDs (e.g. WEB-101)"
                  >
                    <TextInput
                      id="onb-project-code"
                      type="text"
                      maxLength={3}
                      value={projectCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                        setProjectCode(val);
                        setProjectCodeEdited(true);
                      }}
                      placeholder="e.g. WEB"
                      className="!w-28 tracking-wider uppercase"
                    />
                  </Field>
                </div>

                {projectError && (
                  <div className="mt-5">
                    <Callout tone="error" title={projectError} />
                  </div>
                )}

                {stepActions(
                  <>
                    <Button onClick={() => setStep(4)}>Skip</Button>
                    <Button
                      variant="primary"
                      disabled={projectLoading}
                      aria-busy={projectLoading}
                      onClick={handleCreateProject}
                    >
                      {projectLoading ? "Creating…" : "Create Project"}
                    </Button>
                  </>,
                )}
              </div>
            )}

            {/* ----- Step 4: All Set ----- */}
            {step === 4 && (
              <div className="flex flex-col">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--av2-success-bg)]">
                  <CheckGlyph className="h-7 w-7" />
                </span>

                <h1 className="mt-4 text-[32px] leading-10 font-bold tracking-tight">
                  You&apos;re all set!
                </h1>
                <p className="mt-2 text-base text-[var(--av2-text-2)]">
                  Your workspace is ready. Here&apos;s a summary of what we set up:
                </p>

                <div className="mt-6 space-y-2.5">
                  {companyCreated && <SummaryRow title="Company created" detail={companyName} />}
                  {invitedEmails.length > 0 && (
                    <SummaryRow
                      title={`${invitedEmails.length} team member${
                        invitedEmails.length > 1 ? "s" : ""
                      } invited`}
                      detail={invitedEmails.join(", ")}
                    />
                  )}
                  {projectCreated && <SummaryRow title="Project created" detail={projectCreated} />}
                </div>

                {stepActions(
                  <Button
                    variant="primary"
                    disabled={finishLoading}
                    aria-busy={finishLoading}
                    onClick={handleFinish}
                  >
                    {finishLoading ? "Finishing…" : "Go to Dashboard"}
                  </Button>,
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-4 sm:px-8">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-[var(--av2-text-2)]">
          <p>{copyrightLine()}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-[var(--av2-text)] hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-[var(--av2-text)] hover:underline">
              Privacy Policy
            </Link>
            <Link href="/privacy#cookies" className="hover:text-[var(--av2-text)] hover:underline">
              Cookies
            </Link>
            <Link href="/accessibility" className="hover:text-[var(--av2-text)] hover:underline">
              Accessibility
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
