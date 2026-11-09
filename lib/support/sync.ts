// -----------------------------------------------------------------------------
// @file: lib/support/sync.ts
// @purpose: Runs on each production deploy (scripts/sync-support-guides.mjs):
//           compares every admin edit of a code guide with the code that was
//           just deployed, stores whether code changed or removed the guide,
//           and tells the admins once per change. The database and the
//           notifier are passed in, so this is tested without either.
// -----------------------------------------------------------------------------

import type { GuideAudience } from "@prisma/client";

import { guideCodeHash } from "./hash";
import { codeGuidesFor, OWNER_FOR_AUDIENCE } from "./code-sources";
import { codeStatusFor, parseGuideContent, type GuideCodeStatus } from "./merge";

const AUDIENCE_LABEL: Record<GuideAudience, string> = {
  CUSTOMER: "Customer",
  CREATIVE: "Creative",
  ADMIN: "Admin",
  PUBLIC: "Public",
};

export type SyncEntry = {
  id: string;
  audience: GuideAudience;
  slug: string;
  fromCode: boolean;
  content: unknown;
  baseCodeHash: string | null;
  codeStatus: GuideCodeStatus;
  notifiedCodeHash: string | null;
};

export type SyncStore = {
  entries(): Promise<SyncEntry[]>;
  update(
    id: string,
    data: { codeStatus: GuideCodeStatus; notifiedCodeHash?: string },
  ): Promise<void>;
  adminIds(): Promise<string[]>;
};

export type Notify = (input: { userId: string; title: string; message: string }) => Promise<void>;

/** Marker stored in notifiedCodeHash once admins know a guide left the code. */
const REMOVED = "removed";

export type SyncResult = { checked: number; changed: number; notified: number };

export async function syncGuideEntries(store: SyncStore, notify: Notify): Promise<SyncResult> {
  const entries = (await store.entries()).filter((entry) => entry.fromCode);
  const needsReview: string[] = [];

  for (const entry of entries) {
    const code = codeGuidesFor(OWNER_FOR_AUDIENCE[entry.audience]).find(
      (guide) => guide.slug === entry.slug,
    );
    const hash = code ? guideCodeHash(code) : null;
    const status = codeStatusFor(entry, hash);
    const marker = hash ?? REMOVED;
    const announce = status !== "IN_SYNC" && entry.notifiedCodeHash !== marker;

    if (status !== entry.codeStatus || announce) {
      await store.update(entry.id, {
        codeStatus: status,
        ...(announce ? { notifiedCodeHash: marker } : {}),
      });
    }
    if (announce) {
      const title = parseGuideContent(entry.content)?.title ?? code?.title ?? entry.slug;
      const what = status === "CODE_REMOVED" ? "removed from code" : "changed in code";
      needsReview.push(`${title} (${AUDIENCE_LABEL[entry.audience]}): ${what}`);
    }
  }

  if (needsReview.length === 0) {
    return { checked: entries.length, changed: 0, notified: 0 };
  }

  const admins = await store.adminIds();
  const title =
    needsReview.length === 1
      ? "A Support guide you edited needs a look"
      : `${needsReview.length} Support guides you edited need a look`;
  const message = `The latest release updated guides that were edited in the admin panel. Keep your version, use the new one, or merge them. ${needsReview.join("; ")}.`;
  for (const userId of admins) await notify({ userId, title, message });

  return { checked: entries.length, changed: needsReview.length, notified: admins.length };
}
