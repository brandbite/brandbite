// -----------------------------------------------------------------------------
// @file: lib/tools/entitlement.ts
// @purpose: Who gets the Pro side of hub tools (for Mockup Studio: 4K export
//           without the brandbite mark). The rule, for now: a customer whose
//           active company is on an active brandbite plan. Buying a tool on
//           its own comes with Stripe; that will be a second way in, here.
// -----------------------------------------------------------------------------

export type ToolEntitlement = {
  signedIn: boolean;
  /** Pro features of hub tools are unlocked. */
  pro: boolean;
  /** Why not, when it isn't; null when it is. */
  reason: "signedOut" | "noPlan" | null;
};

/** The rule itself, apart from where the facts come from. */
export function toolEntitlement(facts: {
  signedIn: boolean;
  plan: { isActive: boolean } | null;
}): ToolEntitlement {
  if (!facts.signedIn) return { signedIn: false, pro: false, reason: "signedOut" };
  if (!facts.plan?.isActive) return { signedIn: true, pro: false, reason: "noPlan" };
  return { signedIn: true, pro: true, reason: null };
}
