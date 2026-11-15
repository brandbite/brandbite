// -----------------------------------------------------------------------------
// @file: lib/brand/questionnaire.ts
// @purpose: The brand form sent by link: its questions, the validation of a
//           submission, and how stored answers are read back. No server
//           imports, so the public form and the review screen share it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import { z } from "zod";

import { BRAND_LIMITS, updateBrandSchema } from "./brand-schema";

export const QUESTIONNAIRE_LINK_DAYS = 30;
export const QUESTIONNAIRE_MAX_OPEN = 10;

export type QuestionKind = "short" | "long" | "list";

export type Question = {
  /** The brand guide field the answer goes into. */
  key: QuestionKey;
  label: string;
  hint?: string;
  kind: QuestionKind;
};

export const QUESTION_KEYS = [
  "tagline",
  "description",
  "audience",
  "values",
  "toneWords",
  "voiceNotes",
  "voiceDo",
  "voiceDont",
  "wordsToUse",
  "wordsToAvoid",
  "sampleCopy",
  "references",
  "imageryNotes",
] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];

const ONE_PER_LINE = "One per line.";

export const QUESTIONS: Question[] = [
  {
    key: "description",
    label: "What does the company do?",
    hint: "Two or three sentences, the way you'd tell a new hire.",
    kind: "long",
  },
  {
    key: "tagline",
    label: "Do you have a tagline?",
    kind: "short",
  },
  {
    key: "audience",
    label: "Who are your customers?",
    hint: "Who they are and what they care about.",
    kind: "long",
  },
  {
    key: "values",
    label: "What does the brand stand for?",
    hint: `Your values. ${ONE_PER_LINE}`,
    kind: "list",
  },
  {
    key: "toneWords",
    label: "Which words describe how the brand sounds?",
    hint: `Three to five words, like warm, direct, playful. ${ONE_PER_LINE}`,
    kind: "list",
  },
  {
    key: "voiceNotes",
    label: "How do you talk to customers?",
    hint: "Formal or casual, long or short, jokes or no jokes.",
    kind: "long",
  },
  {
    key: "voiceDo",
    label: "Lines that sound like you",
    hint: ONE_PER_LINE,
    kind: "list",
  },
  {
    key: "voiceDont",
    label: "Things you would never say",
    hint: ONE_PER_LINE,
    kind: "list",
  },
  {
    key: "wordsToUse",
    label: "Words you like to use",
    hint: ONE_PER_LINE,
    kind: "list",
  },
  {
    key: "wordsToAvoid",
    label: "Words to avoid",
    hint: ONE_PER_LINE,
    kind: "list",
  },
  {
    key: "sampleCopy",
    label: "Something you've written that sounds right",
    hint: "Paste a few lines from your site, an email or a post.",
    kind: "long",
  },
  {
    key: "references",
    label: "Competitors and brands you like",
    hint: "Names or links, and what you like or don't like about them.",
    kind: "long",
  },
  {
    key: "imageryNotes",
    label: "What kind of photos or illustrations fit the brand?",
    hint: "And anything to stay away from.",
    kind: "long",
  },
];

const answersSchema = updateBrandSchema.pick({
  tagline: true,
  description: true,
  audience: true,
  values: true,
  toneWords: true,
  voiceNotes: true,
  voiceDo: true,
  voiceDont: true,
  wordsToUse: true,
  wordsToAvoid: true,
  sampleCopy: true,
  references: true,
  imageryNotes: true,
});

export const submitQuestionnaireSchema = z.object({
  respondentName: z
    .string()
    .trim()
    .min(2, "Please tell us your name.")
    .max(BRAND_LIMITS.name, "That name is too long."),
  respondentRole: z.string().trim().max(BRAND_LIMITS.name, "That role is too long.").optional(),
  answers: answersSchema,
});

type ListKey = "values" | "toneWords" | "voiceDo" | "voiceDont" | "wordsToUse" | "wordsToAvoid";
type TextKey = Exclude<QuestionKey, ListKey>;

/** Answers with something in them: text as strings, lists as string arrays. */
export type QuestionnaireAnswers = Partial<Record<TextKey, string>> &
  Partial<Record<ListKey, string[]>>;

/** Drops unanswered questions. Accepts both a fresh submission and stored JSON. */
export function readAnswers(raw: unknown): QuestionnaireAnswers {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  // Built loosely, then returned under the precise type: each question's kind
  // decides whether its answer is text or a list.
  const answers: Partial<Record<QuestionKey, string | string[]>> = {};
  for (const question of QUESTIONS) {
    const value = row[question.key];
    if (question.kind === "list") {
      if (!Array.isArray(value)) continue;
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length > 0) answers[question.key] = items;
    } else if (typeof value === "string" && value.trim()) {
      answers[question.key] = value.trim();
    }
  }
  return answers as QuestionnaireAnswers;
}

export function countAnswers(raw: unknown): number {
  return Object.keys(readAnswers(raw)).length;
}

/** One entry per line in the form; an array in a submission. */
export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
