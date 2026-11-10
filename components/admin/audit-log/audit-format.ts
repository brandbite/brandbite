// -----------------------------------------------------------------------------
// @file: components/admin/audit-log/audit-format.ts
// @purpose: Labels and formatting for the admin audit log: action names,
//           target types, roles, and an entry's metadata as readable rows.
//           Pure functions, shared by the list and the entry dialog.
// -----------------------------------------------------------------------------

export type AuditOutcome = "SUCCESS" | "BLOCKED" | "ERROR";

export type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  outcome: AuditOutcome;
  actor: { id: string; email: string; name: string | null; role: string };
  target: { type: string; id: string } | null;
  metadata: unknown;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export const ACTION_LABELS: Record<string, string> = {
  WITHDRAWAL_APPROVE: "Withdrawal approved",
  WITHDRAWAL_MARK_PAID: "Withdrawal marked paid",
  WITHDRAWAL_REJECT: "Withdrawal rejected",
  PLAN_CREATE: "Plan created",
  PLAN_EDIT: "Plan edited",
  PLAN_DELETE: "Plan deleted",
  PLAN_ASSIGN: "Plan assigned",
  COMPANY_TOKEN_GRANT: "Company tokens granted/debited",
  PAYOUT_RULE_EDIT: "Payout rule edited",
  TICKET_FINANCIAL_OVERRIDE: "Request financial override",
  USER_PROMOTE_TO_ADMIN: "User role changed (admin)",
  USER_HARD_DELETE: "User hard-deleted",
  AI_PRICING_EDIT: "AI pricing edited",
  CONSULTATION_PRICING_EDIT: "Consultation pricing edited",
  GOOGLE_OAUTH_CONFIG_EDIT: "Google OAuth config changed",
  COMPANY_AUTO_ASSIGN_EDIT: "Company auto-assign changed",
  APP_SETTING_EDIT: "Platform setting changed",
  TICKET_BULK_STATUS_CHANGE: "Request statuses changed in bulk",
  ADMIN_MFA_DISABLE: "Authenticator two-factor turned off",
  TALENT_APPLICATION_ACCEPTED: "Talent application accepted",
  TALENT_APPLICATION_DECLINED: "Talent application declined",
  TALENT_INTERVIEW_HELD: "Talent interview held",
  TALENT_INTERVIEW_MISSED: "Talent interview missed",
  TALENT_HIRED: "Talent applicant hired",
  TALENT_REJECTED_AFTER_INTERVIEW: "Talent declined after interview",
  TALENT_ONBOARDED: "Talent onboarded as creative",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

/** Target types written by the API routes, as people say them. */
const TARGET_LABELS: Record<string, string> = {
  AiToolConfig: "AI tool",
  AppSetting: "Setting",
  ConsultationSettings: "Consultation",
  PayoutRule: "Payout rule",
  Ticket: "Request",
  TalentApplication: "Talent application",
  UserAccount: "User",
};

export function targetLabel(type: string): string {
  return TARGET_LABELS[type] ?? humanize(type);
}

const ROLE_LABELS: Record<string, string> = {
  SITE_OWNER: "Site owner",
  SITE_ADMIN: "Site admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? humanize(role);
}

/**
 * "changedFields" → "Changed fields", "GOOGLE_OAUTH" → "Google oauth",
 * "PayoutRule" → "Payout rule".
 */
export function humanize(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

export type MetadataRow = { label: string; value: string; code?: boolean };

function isPlain(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function plainText(value: string | number | boolean | null): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * An entry's metadata as label/value rows. Flat values read as text, lists of
 * flat values join with commas, anything nested is shown as JSON. Null when
 * there is nothing to show.
 */
export function metadataRows(metadata: unknown): MetadataRow[] | null {
  if (metadata == null) return null;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return [{ label: "Value", value: JSON.stringify(metadata, null, 2), code: true }];
  }
  const rows = Object.entries(metadata as Record<string, unknown>).map(([key, value]) => {
    const label = humanize(key);
    if (isPlain(value)) return { label, value: plainText(value) };
    if (Array.isArray(value) && value.every(isPlain)) {
      return { label, value: value.length ? value.map(plainText).join(", ") : "—" };
    }
    return { label, value: JSON.stringify(value, null, 2), code: true };
  });
  return rows.length ? rows : null;
}

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
