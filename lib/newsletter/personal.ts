// -----------------------------------------------------------------------------
// @file: lib/newsletter/personal.ts
// @purpose: Personal fields in a newsletter ("Hi {{first_name}}"). In the
//           builder a field is written one way, whichever service will send
//           the newsletter; when the HTML is made, each field becomes the tag
//           that service fills in for every reader. In the preview and in a
//           test email it becomes a sample value instead. Pure.
// -----------------------------------------------------------------------------

import type { NewsletterService } from "./newsletter";

export const PERSONAL_FIELDS = [
  { id: "first_name", label: "First name", sample: "Alex" },
  { id: "last_name", label: "Last name", sample: "Morgan" },
  { id: "email", label: "Email address", sample: "alex@example.com" },
] as const;

export type PersonalFieldId = (typeof PERSONAL_FIELDS)[number]["id"];

/** How a field is written in the builder. */
export const personalToken = (id: PersonalFieldId) => `{{${id}}}`;

/** The tag each service swaps for the reader's own value. */
const SERVICE_TAGS: Record<Exclude<NewsletterService, "other">, Record<PersonalFieldId, string>> = {
  mailchimp: { first_name: "*|FNAME|*", last_name: "*|LNAME|*", email: "*|EMAIL|*" },
  klaviyo: { first_name: "{{ first_name }}", last_name: "{{ last_name }}", email: "{{ email }}" },
  brevo: {
    first_name: "{{ contact.FIRSTNAME }}",
    last_name: "{{ contact.LASTNAME }}",
    email: "{{ contact.EMAIL }}",
  },
};

const TOKEN = /\{\{\s*(first_name|last_name|email)\s*\}\}/g;

/** Whether a text has a personal field in it. */
export function usesPersonal(text: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(text);
}

/** The tag a field becomes for a service; for another service it stays as written. */
export function serviceTag(id: PersonalFieldId, service: NewsletterService): string {
  return service === "other" ? personalToken(id) : SERVICE_TAGS[service][id];
}

/**
 * A text or a finished HTML document with its personal fields filled in:
 * "send" puts in the chosen service's tags, "sample" puts in example values
 * (for the preview and a test email, where nobody would fill the tags).
 */
export function fillPersonal(
  text: string,
  service: NewsletterService,
  mode: "send" | "sample",
): string {
  return text.replace(TOKEN, (_match, id: PersonalFieldId) =>
    mode === "sample"
      ? (PERSONAL_FIELDS.find((field) => field.id === id)?.sample ?? "")
      : serviceTag(id, service),
  );
}
