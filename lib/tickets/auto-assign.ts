// -----------------------------------------------------------------------------
// @file: lib/tickets/auto-assign.ts
// @purpose: Auto-assign resolution helpers — compose company-level default
//           and project-level override into a single effective flag.
//
// Extracted from app/api/customer/tickets/route.ts so the rule is
// unit-testable and reusable across any route that needs to decide
// whether a new ticket should be auto-assigned to a creative.
// -----------------------------------------------------------------------------

import { AutoAssignMode } from "@prisma/client";

/**
 * Given a company's default auto-assign flag and a project-level mode,
 * return whether auto-assign is effectively enabled for a ticket that
 * belongs to the project.
 *
 *   - project mode `INHERIT` (or missing) → use company default
 *   - project mode `ON`                   → always on
 *   - project mode `OFF`                  → always off
 */
export function isAutoAssignEnabled(
  companyDefault: boolean,
  projectMode?: AutoAssignMode | null,
): boolean {
  if (!projectMode || projectMode === AutoAssignMode.INHERIT) {
    return companyDefault;
  }
  if (projectMode === AutoAssignMode.ON) return true;
  if (projectMode === AutoAssignMode.OFF) return false;
  return companyDefault;
}
