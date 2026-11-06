import type { z } from "zod";
import type { filledField } from "../schema/status.js";
import type { SkilledWorkerApplication } from "../schema/application.js";
import type { FormDriver, PageState } from "./driver.js";
import type { FieldIntent } from "./fields.js";

export type FilledField = z.infer<typeof filledField>;

/** Mutable state shared by all steps during one run. */
export interface RunState {
  /** Index of the next item to enter for each repeating group (other names, children, visits...). */
  repeatIndex: Record<string, number>;
  /** The repeating group whose detail page was most recently completed. */
  lastRepeatGroup?: string;
  references: { gwf?: string; uan?: string; ihs?: string; paymentReference?: string };
  /** How many times each page key (url + heading) has been seen in a row. */
  consecutiveVisits: number;
  lastPageKey?: string;
  warnings: string[];
}

export interface StepContext {
  app: SkilledWorkerApplication;
  driver: FormDriver;
  page: PageState;
  state: RunState;
  options: ResolvedRunOptions;
  log: (message: string) => void;
}

export type StepKind = "form" | "info" | "stop" | "terminal";

export interface FormStep {
  id: string;
  /** Short human description used in the report when the page heading is empty. */
  title: string;
  kind?: StepKind;
  /** Patterns tested against the page heading and document title. */
  match: RegExp[] | ((page: PageState) => boolean);
  /** Only match when this predicate holds (e.g. URL host, previous step). */
  when?: (ctx: StepContext) => boolean;
  /** Answers to enter on this page. */
  fields?: (ctx: StepContext) => FieldIntent[];
  /** Custom handling instead of, or in addition to, `fields`. Return false to signal the page could not be completed. */
  run?: (ctx: StepContext) => Promise<boolean | void>;
  /** Visible text of the button that moves to the next page. Defaults to Continue / Save and continue. */
  continueLabel?: RegExp | string | null;
  /** Called after the continue button was pressed and the page changed. */
  after?: (ctx: StepContext) => void;
  /** Repeating group this page belongs to. Advances the group's index after a successful completion. */
  repeatGroup?: string;
}

export interface RunOptions {
  /** Where to begin. Defaults to the GOV.UK Skilled Worker "apply" page. */
  startUrl?: string;
  /** Stop before this point regardless of the input. "declaration" is the default and safest. */
  stopAt?: "declaration" | "payment" | "never";
  maxPages?: number;
  /** Directory for screenshots and the final report. */
  artifactsDir?: string;
  screenshots?: boolean;
  /** Called when a page asks for an email verification code. Return undefined to stop and hand over to a human. */
  resolveVerificationCode?: (ctx: { email: string }) => Promise<string | undefined>;
  onStep?: (record: import("../schema/status.js").StepRecord) => void;
  log?: (message: string) => void;
  /** Extra steps for pages not covered by the built-in registry; matched before the built-ins. */
  extraSteps?: FormStep[];
  modelName?: string;
}

export interface ResolvedRunOptions extends Required<Omit<RunOptions, "resolveVerificationCode" | "onStep" | "extraSteps" | "log" | "modelName">> {
  resolveVerificationCode?: RunOptions["resolveVerificationCode"];
  onStep?: RunOptions["onStep"];
  extraSteps: FormStep[];
  log: (message: string) => void;
  modelName: string;
}
