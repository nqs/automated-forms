import { z } from "zod";
import type { FieldIntent } from "./fields.js";
import type { FormStep, StepContext } from "./types.js";

/**
 * Generic handling for pages no registered step recognises.
 *
 * The model lists the questions on the page; each is matched against the
 * labels and aliases of every field intent the registered steps could
 * produce for this application. Matches above a confidence threshold are
 * filled; the rest are reported as unanswered so a human can review.
 */

export const pageQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      label: z.string().describe("The question or field label exactly as shown"),
      inputType: z.enum(["text", "textarea", "radio", "checkbox", "select", "date", "password", "unknown"]),
      options: z.array(z.string()).default([]).describe("Option labels for radio, checkbox or select inputs"),
      required: z.boolean().default(true),
    }),
  ),
  hasContinueButton: z.boolean(),
});
export type PageQuestions = z.infer<typeof pageQuestionsSchema>;

export const EXTRACT_QUESTIONS_INSTRUCTION =
  "List every question or form field the user must answer on this page, in order, with its input type and any option labels. Also report whether there is a Continue, Save and continue or Next button.";

const STOPWORDS = new Set(["the", "a", "an", "of", "your", "you", "is", "are", "do", "does", "to", "in", "on", "for", "this", "that", "what", "which", "please", "enter", "and", "or", "as", "at", "be", "have", "has", "with", "any", "ever"]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

/** Similarity in [0,1] between a page question and an intent label. */
export function similarity(question: string, candidate: string): number {
  const q = tokens(question);
  const c = tokens(candidate);
  if (q.length === 0 || c.length === 0) return 0;
  const qn = q.join(" ");
  const cn = c.join(" ");
  if (qn === cn) return 1;
  if (qn.includes(cn) || cn.includes(qn)) return 0.9;
  const qs = new Set(q);
  const overlap = c.filter((t) => qs.has(t)).length;
  return overlap / Math.max(q.length, c.length);
}

export interface Candidate {
  intent: FieldIntent;
  stepId: string;
}

/** Every intent any registered step could want to fill for this application. */
export function buildDictionary(steps: FormStep[], ctx: StepContext): Candidate[] {
  const out: Candidate[] = [];
  for (const step of steps) {
    if (!step.fields) continue;
    try {
      for (const intent of step.fields(ctx)) out.push({ intent, stepId: step.id });
    } catch {
      /* a step's fields may depend on page state; ignore */
    }
  }
  return out;
}

export interface Mapped {
  question: PageQuestions["questions"][number];
  intent: FieldIntent;
  score: number;
  stepId: string;
}

export function mapQuestions(questions: PageQuestions["questions"], dictionary: Candidate[], threshold = 0.6): { mapped: Mapped[]; unanswered: string[] } {
  const mapped: Mapped[] = [];
  const unanswered: string[] = [];
  const used = new Set<FieldIntent>();
  for (const question of questions) {
    let best: Mapped | undefined;
    for (const cand of dictionary) {
      if (used.has(cand.intent)) continue;
      const labels = [cand.intent.label, ...(cand.intent.aliases ?? [])];
      const score = Math.max(...labels.map((l) => similarity(question.label, l)));
      if (score >= threshold && (!best || score > best.score)) {
        best = { question, intent: adaptIntent(cand.intent, question), score, stepId: cand.stepId };
      }
    }
    if (best) {
      mapped.push(best);
      used.add(best.intent);
    } else {
      unanswered.push(question.label);
    }
  }
  return { mapped, unanswered };
}

/** Re-shape an intent so it fits the input type the page actually uses. */
function adaptIntent(intent: FieldIntent, q: PageQuestions["questions"][number]): FieldIntent {
  const label = q.label;
  switch (q.inputType) {
    case "radio":
      if (intent.kind === "select") return { ...intent, kind: "radio", label };
      if (intent.kind === "text") return { ...intent, kind: "radio", label };
      return { ...intent, label };
    case "select":
      if (intent.kind === "radio") return { ...intent, kind: "select", label };
      if (intent.kind === "yesno") return { kind: "select", label, value: intent.value ? "Yes" : "No", source: intent.source };
      return { ...intent, label };
    case "text":
      if (intent.kind === "select" || intent.kind === "radio") return { ...intent, kind: "text", label };
      return { ...intent, label };
    default:
      return { ...intent, label };
  }
}
