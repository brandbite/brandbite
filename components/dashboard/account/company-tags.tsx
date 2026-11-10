// -----------------------------------------------------------------------------
// @file: components/dashboard/account/company-tags.tsx
// @purpose: Tag management on customer settings: OWNER + PM only, and hidden
//           entirely while the global TAGS_ENABLED flag is off (existing rows
//           are kept). Renders nothing for other roles and does not fetch.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import { Button, Card, CardTitle, Skeleton, TextInput } from "@/components/admin/v2/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TagBadge } from "@/components/ui/tag-badge";
import { useToast } from "@/components/ui/toast-provider";
import { TAG_COLORS, TAG_COLOR_KEYS, type TagColorKey } from "@/lib/tag-colors";

type SettingsTag = { id: string; name: string; color: TagColorKey };

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: TagColorKey;
  onChange: (color: TagColorKey) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap">
      {TAG_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          aria-label={TAG_COLORS[key].label}
          title={TAG_COLORS[key].label}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
        >
          <span
            className={`h-6 w-6 rounded-full border-2 ${
              value === key ? "border-[var(--av2-text)]" : "border-transparent"
            }`}
            style={{ backgroundColor: TAG_COLORS[key].dot }}
          />
        </button>
      ))}
    </div>
  );
}

export function CompanyTagsCard({ canManage }: { canManage: boolean }) {
  const { showToast } = useToast();
  const [tags, setTags] = useState<SettingsTag[]>([]);
  const [loading, setLoading] = useState(true);
  // Mirrors the global TAGS_ENABLED AppSetting via the GET response. Missing
  // counts as enabled so older deploys keep working.
  const [enabled, setEnabled] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColorKey>("BLUE");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColorKey>("BLUE");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const editing = tags.find((t) => t.id === editingId);
  const dirty =
    newName.trim() !== "" ||
    (!!editing && (editName.trim() !== editing.name || editColor !== editing.color));
  useUnsavedChanges(dirty, "Tags");

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer/tags");
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.tags) setTags(json.tags as SettingsTag[]);
        if (!cancelled && typeof json?.tagsEnabled === "boolean") setEnabled(json.tagsEnabled);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const handleAdd = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch("/api/customer/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: newColor }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({ type: "error", title: json?.error || "Failed to create tag" });
        return;
      }
      setTags((prev) =>
        [...prev, json.tag as SettingsTag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setNewColor("BLUE");
      showToast({ type: "success", title: `Tag "${trimmed}" created` });
    } catch {
      showToast({ type: "error", title: "Failed to create tag" });
    } finally {
      setAdding(false);
    }
  }, [newName, newColor, showToast]);

  const handleSave = useCallback(async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customer/tags/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: editColor }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({ type: "error", title: json?.error || "Failed to update tag" });
        return;
      }
      setTags((prev) => prev.map((t) => (t.id === editingId ? (json.tag as SettingsTag) : t)));
      setEditingId(null);
      showToast({ type: "success", title: "Tag updated" });
    } catch {
      showToast({ type: "error", title: "Failed to update tag" });
    } finally {
      setSaving(false);
    }
  }, [editingId, editName, editColor, showToast]);

  const handleDelete = useCallback(
    async (tagId: string) => {
      setDeletingId(tagId);
      try {
        const res = await fetch(`/api/customer/tags/${tagId}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          showToast({ type: "error", title: json?.error || "Failed to delete tag" });
          return;
        }
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        showToast({ type: "success", title: "Tag deleted" });
      } catch {
        showToast({ type: "error", title: "Failed to delete tag" });
      } finally {
        setDeletingId(null);
      }
    },
    [showToast],
  );

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("BLUE");
  };

  if (!canManage || !enabled) return null;

  return (
    <Card>
      <CardTitle description="Manage tags used to categorize creative requests across your company.">
        Tags
      </CardTitle>

      {loading ? (
        <div aria-busy="true" aria-label="Loading tags" className="mt-4 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <>
          {tags.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--av2-text-2)]">
              No tags yet. Create your first tag below.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--av2-border)]">
              {tags.map((tag) => (
                <li key={tag.id} className="py-2">
                  {editingId === tag.id ? (
                    <div className="space-y-2">
                      <TextInput
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={30}
                        aria-label={`Edit tag ${tag.name}`}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSave();
                          }
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <ColorPicker
                        value={editColor}
                        onChange={setEditColor}
                        label={`Color for ${tag.name}`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          onClick={() => void handleSave()}
                          disabled={saving || !editName.trim()}
                          aria-busy={saving || undefined}
                        >
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="ghost" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <TagBadge name={tag.name} color={tag.color} />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          aria-label={`Edit tag ${tag.name}`}
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditName(tag.name);
                            setEditColor(tag.color);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Delete tag ${tag.name}`}
                          onClick={() => setToDelete(tag.id)}
                          disabled={deletingId === tag.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-[var(--av2-border)] pt-4">
            <h3 className="mb-2 text-sm font-semibold">Add a new tag</h3>
            <div className="space-y-2">
              <TextInput
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name"
                maxLength={30}
                aria-label="New tag name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              <ColorPicker value={newColor} onChange={setNewColor} label="New tag color" />
              <Button
                onClick={() => void handleAdd()}
                disabled={adding || !newName.trim()}
                aria-busy={adding || undefined}
              >
                {adding ? "Adding…" : "Add tag"}
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await handleDelete(toDelete);
          setToDelete(null);
        }}
        title="Delete tag"
        description="This tag will be removed from all requests. This can't be undone."
        confirmLabel="Delete"
        loading={deletingId === toDelete}
      />
    </Card>
  );
}
