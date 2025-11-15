// -----------------------------------------------------------------------------
// @file: lib/demo-personas.ts
// @purpose: Central demo personas config (ids, labels, emails, redirects)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import type { AppUserRole } from "./roles";

export type DemoPersonaId =
  | "site-owner"
  | "site-admin"
  | "customer-owner"
  | "customer-pm"
  | "designer-ada"
  | "designer-liam";

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
    description: "Platform-level owner for Brandbite.",
    redirectTo: "/admin/ledger",
    email: "owner@brandbite-demo.com",
    role: "SITE_OWNER",
  },
  {
    id: "site-admin",
    label: "Site admin",
    description: "Platform admin, similar privileges as owner.",
    redirectTo: "/admin/ledger",
    email: "admin@brandbite-demo.com",
    role: "SITE_ADMIN",
  },
  {
    id: "customer-owner",
    label: "Customer • Company owner",
    description: "Owner of Acme Studio (demo company).",
    redirectTo: "/customer/tokens",
    email: "owner@acme-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "customer-pm",
    label: "Customer • Project manager",
    description: "PM for Acme Studio projects.",
    redirectTo: "/customer/tickets",
    email: "pm@acme-demo.com",
    role: "CUSTOMER",
  },
  {
    id: "designer-ada",
    label: "Designer • Ada",
    description: "Designer working on Website revamp.",
    redirectTo: "/designer/balance",
    email: "ada.designer@demo.com",
    role: "DESIGNER",
  },
  {
    id: "designer-liam",
    label: "Designer • Liam",
    description: "Designer working on Onboarding visuals.",
    redirectTo: "/designer/balance",
    email: "liam.designer@demo.com",
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
