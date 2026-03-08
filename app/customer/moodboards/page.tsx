// -----------------------------------------------------------------------------
// @file: app/customer/moodboards/page.tsx
// @purpose: Customer-facing moodboard list page
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { MoodboardCard } from "@/components/moodboard/moodboard-card";

type MoodboardListItem = {
  id: string;
  title: string;
  description: string | null;
  project: { id: string; name: string } | null;
  _count: { items: number };
  thumbnails: { data: { url?: string } }[];
  createdAt: string;
};

export default function MoodboardsPage() {
  const router = useRouter();
  const [moodboards, setMoodboards] = useState<MoodboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMoodboards();
  }, []);

  async function fetchMoodboards() {
    try {
      const res = await fetch("/api/customer/moodboards");
      if (!res.ok) throw new Error("Failed to fetch moodboards");
      const data = await res.json();
      setMoodboards(data.moodboards ?? []);
    } catch {
      setError("Could not load moodboards");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/customer/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Moodboard" }),
      });
      if (!res.ok) throw new Error("Failed to create moodboard");
      const data = await res.json();
      router.push(`/customer/moodboards/${data.moodboard.id}`);
    } catch {
      setError("Could not create moodboard");
      setCreating(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold text-[var(--bb-secondary)]">Moodboards</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Collect inspiration, colors, and references for your design projects.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          {creating ? "Creating..." : "+ New Moodboard"}
        </button>
      </div>

      {error && (
        <InlineAlert variant="error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Grid */}
      {moodboards.length === 0 ? (
        <EmptyState
          title="No moodboards yet"
          description="Create your first moodboard to start collecting design inspiration."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {moodboards.map((mb) => (
            <MoodboardCard key={mb.id} moodboard={mb} />
          ))}
        </div>
      )}
    </div>
  );
}
