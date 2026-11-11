// -----------------------------------------------------------------------------
// @file: components/engagement/brand-soundtrack-setting.tsx
// @purpose: "Brand soundtrack" in the customer's company settings: paste a
//           Spotify playlist or album that sounds like the brand; creatives
//           see it on the company's requests. Owners and PMs can change it,
//           other members see it. Renders nothing while the owner's switch
//           (ENGAGEMENT_BRAND_SOUNDTRACK) is off.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

import { Button, Card, CardTitle, TextInput } from "@/components/admin/v2/ui";

type Playlist = { url: string; embedUrl: string; title: string; coverUrl: string | null };

type State =
  | { status: "loading" }
  | { status: "off" }
  | { status: "ready"; canEdit: boolean; soundtrack: Playlist | null };

export function BrandSoundtrackSetting() {
  const inputId = useId();
  const [state, setState] = useState<State>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/customer/brand-soundtrack", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!live) return;
        if (!json?.enabled) return setState({ status: "off" });
        setState({ status: "ready", canEdit: !!json.canEdit, soundtrack: json.soundtrack ?? null });
      })
      .catch(() => live && setState({ status: "off" }));
    return () => {
      live = false;
    };
  }, []);

  if (state.status !== "ready") return null;
  const { canEdit, soundtrack } = state;

  const save = async (url: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/brand-soundtrack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "We couldn't save that. Please try again.");
        return;
      }
      setState({ status: "ready", canEdit, soundtrack: json.soundtrack ?? null });
      setDraft("");
    } catch {
      setError("We couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div id="brand-soundtrack" className="scroll-mt-24">
        <CardTitle description="A Spotify playlist or album that sounds like your brand. Your creative can listen while they work on your requests.">
          Brand soundtrack
        </CardTitle>
      </div>

      {soundtrack ? (
        <div className="mt-4">
          <iframe
            src={soundtrack.embedUrl}
            title={`${soundtrack.title} on Spotify`}
            height={152}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block w-full rounded-xl border-0"
          />
          {canEdit ? (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => save("")} disabled={saving}>
                {saving ? "Removing…" : "Remove soundtrack"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : canEdit ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void save(draft);
          }}
        >
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
            Spotify link
          </label>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[240px] flex-1">
              <TextInput
                id={inputId}
                type="url"
                inputMode="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://open.spotify.com/playlist/…"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
              />
            </div>
            <Button variant="primary" type="submit" disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Add soundtrack"}
            </Button>
          </div>
          {error ? (
            <p
              id={`${inputId}-error`}
              role="alert"
              className="mt-2 text-sm font-medium text-[var(--av2-error-text)]"
            >
              {error}
            </p>
          ) : (
            <p id={`${inputId}-hint`} className="mt-2 text-sm text-[var(--av2-text-2)]">
              In Spotify, open the playlist, choose Share, then Copy link to playlist.
            </p>
          )}
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--av2-text-2)]">
          No soundtrack yet. Owners and project managers can add one.
        </p>
      )}
    </Card>
  );
}
