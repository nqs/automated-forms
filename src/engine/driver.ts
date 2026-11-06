import type { z } from "zod";

/**
 * The slice of the Stagehand v4 surface the runner depends on.
 *
 * Keeping this narrow lets tests run against an in-memory fake and keeps the
 * runner independent of Stagehand version churn.
 */
export interface Action {
  selector: string;
  description: string;
  method?: string;
  arguments?: string[];
}

export interface ActOutcome {
  success: boolean;
  message: string;
}

export interface PageState {
  url: string;
  title: string;
  /** Main heading (h1 or the first fieldset legend) as plain text. */
  heading: string;
  /** Visible body text, trimmed, used for reference-number extraction and page matching. */
  bodyText: string;
  /** GOV.UK error summary entries, if the page is showing validation errors. */
  errors: { field?: string; message: string }[];
}

export interface FormDriver {
  goto(url: string): Promise<void>;
  /** Snapshot cheap, deterministic facts about the current page without calling the model. */
  pageState(): Promise<PageState>;
  /** Ask the model to find elements. */
  observe(instruction: string): Promise<Action[]>;
  /** Ask the model to perform an action. Variables are substituted as %name% and are not shown to the model. */
  act(instruction: string, variables?: Record<string, string | number | boolean>): Promise<ActOutcome>;
  /** Ask the model to extract structured data from the page. */
  extract<S extends z.ZodType>(instruction: string, schema: S): Promise<z.output<S>>;
  /** Fill an input found by selector. Values never reach the model. */
  fill(selector: string, value: string): Promise<void>;
  /** Pick an option on a native select found by selector. Returns false if no option matched. */
  selectOption(selector: string, value: string): Promise<boolean>;
  click(selector: string): Promise<void>;
  /** Click a button by its visible text. Returns false if no such button exists. */
  clickButtonByText(text: string | RegExp): Promise<boolean>;
  waitForSettled(): Promise<void>;
  screenshot(path: string): Promise<void>;
  usage(): Promise<{ inputTokens: number; outputTokens: number; inferenceTimeMs: number } | undefined>;
  close(): Promise<void>;
}
