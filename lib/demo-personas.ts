// -----------------------------------------------------------------------------
// @file: lib/demo-personas.ts
// @purpose: Central demo personas config (ids, labels, emails, redirects)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import type { AppUserRole } from "./roles";

export type DemoPersonaId =
  | "site-owner"
  | "site-admin"
  | "customer-new"
  | "customer-owner"
  | "customer-pm"
  | "customer-billing"
  | "creative-ada"
  | "creative-liam";

export type DemoPersona = {
  id: DemoPersonaId;
  label: string;
  description: string;
  redirectTo: string;
  email: string;
  role: AppUserRole;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "site-owner",
    label: "Site owner",
    description:
      "Platform-level owner for Brandbite. Full access to admin dashboard, analytics, and all configuration.",
    redirectTo: "/admin",
    email: "owner@brandbite-demo.com",
    role: "SITE_OWNER",
  },
  {
    id: "site-admin",
    label: "Site admin",
    description:
      "Platform admin with similar privileges as the site owner. Manages job types, payouts, and tickets.",
    redirectTo: "/admin",
    email: "admin@brandbite-demo.com",
    role: "SITE_ADMIN",
  },
  {
    id: "customer-new",
    label: "Customer • New (no company)",
    description:
      "A fresh customer with no company yet. Use this persona to test the onboarding wizard.",
    redirectTo: "/onboarding",
    email: "new@customer-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "customer-owner",
    label: "Customer • Company owner",
    description:
      "Owner of the Acme Studio demo workspace. Has full access to settings, billing and tickets.",
    redirectTo: "/customer/tokens",
    email: "owner@acme-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "customer-pm",
    label: "Customer • Project manager",
    description:
      "Project manager for Acme Studio demo projects. Creates and manages tickets.",
    redirectTo: "/customer/tickets",
    email: "pm@acme-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "customer-billing",
    label: "Customer • Billing",
    description:
      "Billing contact for the Acme Studio demo workspace. Has limited access to tickets.",
    redirectTo: "/customer/settings",
    email: "billing@acme-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "creative-ada",
    label: "Creative · Ada",
    description:
      "Creative working on demo tickets such as Website revamp. Used to test creative auto-assignment.",
    redirectTo: "/creative/balance",
    email: "ada.creative@demo.com",
    role: "DESIGNER",
  },
  {
    id: "creative-liam",
    label: "Creative · Liam",
    description:
      "Creative working on demo tickets such as onboarding visuals. Also participates in auto-assign load-balancing.",
    redirectTo: "/creative/balance",
    email: "liam.creative@demo.com",
    role: "DESIGNER",
  },
];

export function isValidDemoPersona(id: string): id is DemoPersonaId {
  return DEMO_PERSONAS.some((persona) => persona.id === id);
}

export function getDemoPersonaById(
  id: DemoPersonaId,
): DemoPersona | undefined {
  return DEMO_PERSONAS.find((persona) => persona.id === id);
}

export function getEmailForDemoPersona(
  id: DemoPersonaId,
): string | null {
  return getDemoPersonaById(id)?.email ?? null;
}
