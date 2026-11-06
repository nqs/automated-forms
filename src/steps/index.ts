import type { FormStep } from "../engine/types.js";
import { startSteps } from "./start.js";
import { accountSteps } from "./account.js";
import { personalSteps } from "./personal.js";
import { contactSteps } from "./contact.js";
import { familySteps } from "./family.js";
import { historySteps } from "./history.js";
import { employmentSteps } from "./employment.js";
import { requirementSteps } from "./requirements.js";
import { finishSteps } from "./finish.js";

/**
 * Ordered registry. Order matters only for disambiguation: when two steps
 * match the same heading the earlier one wins, so the more specific steps
 * (terminal pages, stop points, account pages) come first.
 */
export const builtInSteps: FormStep[] = [
  ...finishSteps.filter((s) => s.kind === "terminal" || s.kind === "stop"),
  ...accountSteps,
  ...startSteps,
  ...personalSteps,
  ...contactSteps,
  ...familySteps,
  ...historySteps,
  ...employmentSteps,
  ...requirementSteps,
  ...finishSteps.filter((s) => s.kind !== "terminal" && s.kind !== "stop"),
];

export { remainingItems } from "./finish.js";
