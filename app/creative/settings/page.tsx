// -----------------------------------------------------------------------------
// @file: app/creative/settings/page.tsx
// @purpose: Creative settings: skills, availability, payout tiers, notification
//           preferences and account deletion, one tab each.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Card, CardTitle, PageHeader, Skeleton, Tabs } from "@/components/admin/v2/ui";
import { KeptTabPanel, useTabFromUrl } from "@/components/dashboard/account/account-ui";
import {
  AvailabilityPanel,
  AvailabilityStrip,
  useCreativeAvailability,
} from "@/components/dashboard/account/availability";
import { DeleteAccountCard } from "@/components/dashboard/account/delete-account";
import {
  NotificationPreferencesBody,
  useNotificationPreferences,
} from "@/components/dashboard/account/notification-matrix";
import {
  CurrentPayoutCard,
  PayoutTiersCard,
  type PayoutData,
} from "@/components/dashboard/account/payout-tiers";
import {
  SelectionSummary,
  SkillsPicker,
  type SkillJobType,
} from "@/components/dashboard/account/skills-picker";
import { useToast } from "@/components/ui/toast-provider";

type SettingsTab = "skills" | "availability" | "payout" | "notifications" | "account";

const TABS: readonly SettingsTab[] = [
  "skills",
  "availability",
  "payout",
  "notifications",
  "account",
];
const TAB_PREFIX = "creative-settings";

export default function CreativeSettingsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SettingsTab>("skills");
  useTabFromUrl<SettingsTab>(TABS, setTab);

  const [loading, setLoading] = useState(true);
  const notifications = useNotificationPreferences();
  const availability = useCreativeAvailability();

  // Skills state
  const [jobTypes, setJobTypes] = useState<SkillJobType[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [skillsLoadFailed, setSkillsLoadFailed] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const skillSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payout tiers. Null until the API has answered: a rate is never guessed.
  const [payout, setPayout] = useState<PayoutData | null>(null);
  const [payoutFailed, setPayoutFailed] = useState(false);

  // Session email for the delete confirmation. Null disables the action.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { user?: { email?: string } | null };
        if (!cancelled && json?.user?.email) setAccountEmail(json.user.email);
      } catch {
        // Best-effort: delete stays disabled without an email.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load skills + payout tiers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [skillsRes, tierRes] = await Promise.all([
          fetch("/api/creative/skills"),
          fetch("/api/creative/payout-tier"),
        ]);
        const skillsJson = await skillsRes.json().catch(() => null);
        const tierJson = await tierRes.json().catch(() => null);

        if (!cancelled) {
          if (skillsRes.ok && skillsJson?.jobTypes) setJobTypes(skillsJson.jobTypes);
          else setSkillsLoadFailed(true);
          if (skillsJson?.selectedJobTypeIds) setSelectedSkillIds(skillsJson.selectedJobTypeIds);

          if (tierRes.ok && tierJson?.tiers) {
            setPayout({
              tiers: tierJson.tiers,
              currentPayoutPercent: tierJson.currentPayoutPercent,
              currentTierName: tierJson.currentTierName ?? null,
              basePayoutPercent: tierJson.basePayoutPercent,
            });
          } else {
            setPayoutFailed(true);
          }
        }
      } catch {
        if (!cancelled) {
          setSkillsLoadFailed(true);
          setPayoutFailed(true);
        }
        showToast({ type: "error", title: "Failed to load settings" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Save skills (debounced)
  const saveSkills = useCallback(
    (nextIds: string[]) => {
      if (skillSaveTimer.current) clearTimeout(skillSaveTimer.current);
      skillSaveTimer.current = setTimeout(async () => {
        setSavingSkills(true);
        try {
          const res = await fetch("/api/creative/skills", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobTypeIds: nextIds }),
          });
          if (!res.ok) throw new Error();
          const json = await res.json();
          if (json?.selectedJobTypeIds) setSelectedSkillIds(json.selectedJobTypeIds);
        } catch {
          showToast({ type: "error", title: "Failed to save skills" });
        } finally {
          setSavingSkills(false);
        }
      }, 400);
    },
    [showToast],
  );

  // Toggle a skill
  const handleSkillToggle = useCallback(
    (jobTypeId: string) => {
      setSelectedSkillIds((prev) => {
        const next = prev.includes(jobTypeId)
          ? prev.filter((id) => id !== jobTypeId)
          : [...prev, jobTypeId];
        saveSkills(next);
        return next;
      });
    },
    [saveSkills],
  );

  const panel = { idPrefix: TAB_PREFIX, active: tab };

  return (
    <>
      <PageHeader
        title="Creative settings"
        description="Manage your creative account preferences."
      />

      <Tabs<SettingsTab>
        label="Settings sections"
        idPrefix={TAB_PREFIX}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "skills", label: "Skills & expertise" },
          { value: "availability", label: "Availability" },
          { value: "payout", label: "Payout tiers" },
          { value: "notifications", label: "Notifications" },
          { value: "account", label: "Account management" },
        ]}
      />

      <div className="mt-6 space-y-6">
        {tab !== "availability" && (
          <AvailabilityStrip availability={availability} onManage={() => setTab("availability")} />
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading settings" className="space-y-6">
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        ) : (
          <>
            <KeptTabPanel value="skills" {...panel}>
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
                <div className="min-w-0">
                  <SkillsPicker
                    skills={jobTypes}
                    selectedIds={selectedSkillIds}
                    onToggle={handleSkillToggle}
                    saving={savingSkills}
                    loadFailed={skillsLoadFailed}
                    selectedOnly={selectedOnly}
                    onSelectedOnly={setSelectedOnly}
                  />
                </div>
                <div className="min-w-0 space-y-6">
                  <SelectionSummary
                    skills={jobTypes}
                    selectedIds={selectedSkillIds}
                    onShowSelected={() => setSelectedOnly(true)}
                  />
                  <CurrentPayoutCard data={payout} onViewTiers={() => setTab("payout")} />
                </div>
              </div>
            </KeptTabPanel>

            <KeptTabPanel value="availability" {...panel}>
              <AvailabilityPanel availability={availability} />
            </KeptTabPanel>

            <KeptTabPanel value="payout" {...panel}>
              <PayoutTiersCard data={payout} error={payoutFailed} />
            </KeptTabPanel>

            <KeptTabPanel value="notifications" {...panel}>
              <Card>
                <CardTitle description="Pick which events show up in your inbox and which also email you. Changes save instantly, and these are the same choices as under Profile.">
                  Notification preferences
                </CardTitle>
                <div className="mt-4">
                  <NotificationPreferencesBody role="DESIGNER" state={notifications} />
                </div>
              </Card>
            </KeptTabPanel>

            <KeptTabPanel value="account" {...panel}>
              <DeleteAccountCard
                endpoint="/api/creative/account"
                email={accountEmail}
                description="Delete your brandbite account permanently. Completed tickets, ratings, and ledger entries are retained in anonymized form for audit purposes; your email is freed up for future sign-ups."
              />
            </KeptTabPanel>
          </>
        )}
      </div>
    </>
  );
}
