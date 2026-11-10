// -----------------------------------------------------------------------------
// @file: lib/role-colors.ts
// @purpose: The rule for telling the three roles apart (decided 2026-11-10).
//           Every role badge, in emails now and in the app later, uses these
//           pairs and nothing else:
//
//             Admin                · peach    #FFE9DF on, text #8F310D
//             Creative Workspace   · lavender #EEE9FF on, text #49368D
//             Customer Workspace   · sage     #E7F3EA on, text #24543A
//
//           Text on its background passes WCAG AA (6.9:1, 8.1:1, 7.7:1).
//           Plain hex values on purpose: email clients don't read CSS
//           variables, so emails import these directly.
// -----------------------------------------------------------------------------

export type RoleKey = "admin" | "creative" | "customer";

export type RoleColor = {
  /** Badge text, e.g. "CREATIVE WORKSPACE". */
  label: string;
  /** Badge background. */
  bg: string;
  /** Badge text colour. */
  text: string;
};

export const ROLE_COLORS: Record<RoleKey, RoleColor> = {
  admin: { label: "Admin", bg: "#FFE9DF", text: "#8F310D" },
  creative: { label: "Creative Workspace", bg: "#EEE9FF", text: "#49368D" },
  customer: { label: "Customer Workspace", bg: "#E7F3EA", text: "#24543A" },
};
