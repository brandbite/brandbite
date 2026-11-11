// -----------------------------------------------------------------------------
// @file: components/engagement/soundtrack-preference.tsx
// @purpose: The creative's own switch for focus-playlist suggestions, in
//           Settings → Notifications. It is the way back after choosing
//           "Don't suggest music" on a soundtrack card. Renders nothing while
//           the owner's switch (ENGAGEMENT_FOCUS_PLAYLIST) is off.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

import { Card, CardTitle, Switch } from "@/components/admin/v2/ui";

export function SoundtrackPreferenceCard() {
  const labelId = useId();
  const hintId = useId();
  const [suggestions, setSuggestions] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/creative/soundtrack-preference", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live && json?.enabled) setSuggestions(json.suggestions !== false);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (suggestions === null) return null;

  const change = async (next: boolean) => {
    const before = suggestions;
    setSuggestions(next);
    setSaving(true);
    try {
      const res = await fetch("/api/creative/soundtrack-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: next }),
      });
      if (!res.ok) setSuggestions(before);
    } catch {
      setSuggestions(before);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle>Music while you work</CardTitle>
      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p id={labelId} className="text-base font-semibold">
            Suggest a playlist when I start work
          </p>
          <p id={hintId} className="mt-1 text-sm text-[var(--av2-text-2)]">
            A soundtrack card appears under the timer with a playlist that fits the request&rsquo;s
            mood. A playlist the customer picked for their brand still shows when this is off.
          </p>
        </div>
        <Switch
          checked={suggestions}
          onChange={change}
          labelledBy={labelId}
          describedBy={hintId}
          disabled={saving}
        />
      </div>
    </Card>
  );
}
