// -----------------------------------------------------------------------------
// @file: lib/brand-kit/kit-url.ts
// @purpose: A brand kit's state and its URL form, so a copied link reopens the
//           same kit. Invalid values fall back field by field.
// -----------------------------------------------------------------------------

import { normalizeHex } from "@/lib/colors";

import { getPairing, pairingsFor, PERSONALITIES, type Personality } from "./fonts";

export type KitState = {
  name: string;
  tagline: string;
  color: string;
  personality: Personality;
  pairing: string;
  variant: number;
};

export const DEFAULT_KIT: KitState = {
  name: "",
  tagline: "",
  color: "#ff6426",
  personality: "Modern",
  pairing: "space-grotesk-and-inter",
  variant: 0,
};

/** Reads a kit from URL search params, falling back field by field. */
export function kitFromParams(params: URLSearchParams): KitState {
  const personality =
    PERSONALITIES.find((p) => p === params.get("style")) ?? DEFAULT_KIT.personality;
  const pairing = getPairing(params.get("fonts") ?? "")?.slug ?? pairingsFor(personality)[0].slug;
  const variant = Number.parseInt(params.get("v") ?? "0", 10);
  return {
    name: (params.get("name") ?? "").slice(0, 40),
    tagline: (params.get("tagline") ?? "").slice(0, 80),
    color: normalizeHex(params.get("color") ?? "") ?? DEFAULT_KIT.color,
    personality,
    pairing,
    variant: Number.isFinite(variant) && variant >= 0 ? variant % 10 : 0,
  };
}

export function kitToParams(kit: KitState): URLSearchParams {
  const params = new URLSearchParams();
  if (kit.name) params.set("name", kit.name);
  if (kit.tagline) params.set("tagline", kit.tagline);
  params.set("color", kit.color.replace("#", ""));
  params.set("style", kit.personality);
  params.set("fonts", kit.pairing);
  if (kit.variant) params.set("v", String(kit.variant));
  return params;
}
