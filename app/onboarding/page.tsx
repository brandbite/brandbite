// -----------------------------------------------------------------------------
// @file: app/onboarding/page.tsx
// @purpose: Customer onboarding wizard — set up company workspace.
//           Lives outside /customer route group to avoid layout redirect loops.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

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
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
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
      const res = await fetch("/api/customer/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#f0eee9] px-6 py-4">
        <p className="text-lg font-bold text-[#424143]">
          <span className="text-[#f15b2b]">b</span>randbite
        </p>
        <p className="text-xs text-[#9a9892]">Setting up your workspace</p>
      </header>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        {/* Stepper */}
        <div className="mb-10 flex items-center justify-center gap-0">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isCompleted = stepNum < step;
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <div
                    className={`h-0.5 w-8 ${
                      isCompleted || isActive
                        ? "bg-[#f15b2b]"
                        : "bg-[#e3e1dc]"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-[#f15b2b] text-white"
                        : isCompleted
                          ? "bg-[#22C55E] text-white"
                          : "bg-[#f0eee9] text-[#9a9892]"
                    }`}
                  >
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive
                        ? "text-[#f15b2b]"
                        : isCompleted
                          ? "text-[#22C55E]"
                          : "text-[#b1afa9]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ----- Step 1: Company ----- */}
        {step === 1 && (
          <div className="flex flex-col">
            <h1 className="text-center text-2xl font-bold text-[#424143]">
              Welcome to Brandbite
            </h1>
            <p className="mt-1 text-center text-sm font-medium text-[#7a7a7a]">
              Let&apos;s set up your workspace.
            </p>
            <p className="mt-2 text-center text-xs text-[#9a9892]">
              We&apos;ll use these details to tailor your dashboard and assign
              your first creative team.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label htmlFor="onb-company-name" className="mb-1 block text-xs font-semibold text-[#424143]">
                  Company Name <span className="text-[#f15b2b]">*</span>
                </label>
                <input
                  id="onb-company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Nova Labs, Horizon Agency"
                  className="w-full rounded-xl border border-[#e3e1dc] px-3.5 py-2.5 text-sm text-[#424143] outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
              </div>
              <div>
                <label htmlFor="onb-website" className="mb-1 block text-xs font-semibold text-[#424143]">
                  Website
                </label>
                <input
                  id="onb-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.yourcompany.com"
                  className="w-full rounded-xl border border-[#e3e1dc] px-3.5 py-2.5 text-sm text-[#424143] outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-[#9a9892]">
              Don&apos;t worry, you can always update this later from your
              profile settings.
            </p>

            {companyError && (
              <p className="mt-3 text-center text-xs font-medium text-[#b13832]">
                {companyError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={companyLoading}
                onClick={handleCreateCompany}
                className="rounded-xl bg-[#f15b2b] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d94e22] disabled:opacity-60"
              >
                {companyLoading ? "Creating…" : "Create Company"}
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="rounded-xl border border-[#e3e1dc] px-5 py-2.5 text-sm font-medium text-[#7a7a7a] transition-colors hover:border-[#9a9892] hover:text-[#424143]"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ----- Step 2: Invite Team ----- */}
        {step === 2 && (
          <div className="flex flex-col">
            <h1 className="text-center text-2xl font-bold text-[#424143]">
              Invite your team
            </h1>
            <p className="mt-1 text-center text-xs text-[#9a9892]">
              Add team members so they can submit tickets and review creative work.
              You can always invite more people later.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex gap-2">
                <label htmlFor="onb-invite-email" className="sr-only">Email address</label>
                <input
                  id="onb-invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1 rounded-xl border border-[#e3e1dc] px-3.5 py-2.5 text-sm text-[#424143] outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                />
                <label htmlFor="onb-invite-role" className="sr-only">Role</label>
                <select
                  id="onb-invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-xl border border-[#e3e1dc] px-3 py-2.5 text-sm text-[#424143] outline-none focus:border-[#f15b2b]"
                >
                  <option value="MEMBER">Member</option>
                  <option value="PM">Project Manager</option>
                  <option value="BILLING">Billing</option>
                </select>
              </div>

              <button
                type="button"
                disabled={inviteLoading}
                onClick={handleInvite}
                className="w-full rounded-xl border border-[#e3e1dc] py-2.5 text-sm font-medium text-[#424143] transition-colors hover:border-[#f15b2b] hover:text-[#f15b2b] disabled:opacity-60"
              >
                {inviteLoading ? "Sending…" : "+ Send invite"}
              </button>

              {inviteError && (
                <p className="text-xs font-medium text-[#b13832]">
                  {inviteError}
                </p>
              )}

              {invitedEmails.length > 0 && (
                <div className="mt-2 rounded-xl bg-[#f7f5f0] px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1afa9]">
                    Invited ({invitedEmails.length})
                  </p>
                  <div className="space-y-1">
                    {invitedEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-2 text-xs text-[#424143]"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22C55E] text-[9px] text-white">
                          ✓
                        </span>
                        {email}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl bg-[#f15b2b] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d94e22]"
              >
                {invitedEmails.length > 0 ? "Next" : "Skip"}
              </button>
            </div>
          </div>
        )}

        {/* ----- Step 3: Create Project ----- */}
        {step === 3 && (
          <div className="flex flex-col">
            <h1 className="text-center text-2xl font-bold text-[#424143]">
              Create your first project
            </h1>
            <p className="mt-1 text-center text-xs text-[#9a9892]">
              Projects help you organize tickets by brand, campaign, or client.
              You can always create more later.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label htmlFor="onb-project-name" className="mb-1 block text-xs font-semibold text-[#424143]">
                  Project Name
                </label>
                <input
                  id="onb-project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Website Redesign, Social Media Q1"
                  className="w-full rounded-xl border border-[#e3e1dc] px-3.5 py-2.5 text-sm text-[#424143] outline-none placeholder:text-[#b1afa9] focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
              </div>
            </div>

            {projectError && (
              <p className="mt-3 text-center text-xs font-medium text-[#b13832]">
                {projectError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={projectLoading}
                onClick={handleCreateProject}
                className="rounded-xl bg-[#f15b2b] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d94e22] disabled:opacity-60"
              >
                {projectLoading ? "Creating…" : "Create Project"}
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-xl border border-[#e3e1dc] px-5 py-2.5 text-sm font-medium text-[#7a7a7a] transition-colors hover:border-[#9a9892] hover:text-[#424143]"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ----- Step 4: All Set ----- */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E]/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22C55E"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#424143]">
              You&apos;re all set!
            </h1>
            <p className="mt-2 text-sm text-[#7a7a7a]">
              Your workspace is ready. Here&apos;s a summary of what we set up:
            </p>

            <div className="mt-6 w-full max-w-sm space-y-2.5">
              {companyCreated && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f0] px-4 py-3 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-[10px] text-white">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#424143]">
                      Company created
                    </p>
                    <p className="text-[11px] text-[#9a9892]">
                      {companyName}
                    </p>
                  </div>
                </div>
              )}
              {invitedEmails.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f0] px-4 py-3 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-[10px] text-white">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#424143]">
                      {invitedEmails.length} team member
                      {invitedEmails.length > 1 ? "s" : ""} invited
                    </p>
                    <p className="text-[11px] text-[#9a9892]">
                      {invitedEmails.join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {projectCreated && (
                <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f0] px-4 py-3 text-left">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-[10px] text-white">
                    ✓
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#424143]">
                      Project created
                    </p>
                    <p className="text-[11px] text-[#9a9892]">
                      {projectCreated}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={finishLoading}
              onClick={handleFinish}
              className="mt-8 rounded-xl bg-[#f15b2b] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d94e22] disabled:opacity-60"
            >
              {finishLoading ? "Finishing…" : "Go to Dashboard"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#f15b2b] px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-[11px] text-white/70">
          <p>&copy; 2025 Brandbite Inc. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white">
              Terms of Service
            </span>
            <span className="cursor-pointer hover:text-white">
              Privacy Policy
            </span>
            <span className="cursor-pointer hover:text-white">Cookies</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
