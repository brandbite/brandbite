// -----------------------------------------------------------------------------
// @file: lib/support/hash.ts
// @purpose: Fingerprint of a code guide's editable content. Stored with an
//           admin's edit; when the code fingerprint later differs, the code
//           changed after the edit and an admin reviews it. Server only.
// -----------------------------------------------------------------------------

import { createHash } from "node:crypto";

import { contentOf, stableStringify } from "./merge";
import type { SupportGuide } from "./types";

export function guideCodeHash(guide: SupportGuide): string {
  return createHash("sha256")
    .update(stableStringify(contentOf(guide)))
    .digest("hex")
    .slice(0, 32);
}
