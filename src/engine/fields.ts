import type { FilledField } from "./types.js";
import type { FormDriver, PageState } from "./driver.js";
import { dateParts, yesNo } from "./format.js";
import { SECRET_PLACEHOLDER, redact } from "./redact.js";

/**
 * A FieldIntent describes one answer the automation wants to put on the
 * current page, independent of how the page is built. The filler turns an
 * intent into Stagehand calls.
 */
interface BaseIntent {
  /** Visible label or question text as it appears on the page. */
  label: string;
  /** Alternative phrasings used by the generic fallback when matching unknown pages. */
  aliases?: string[];
  /** JSON pointer into the input document, for the status report. */
  source?: string;
  /** When true the value is never shown in reports or sent to the model. */
  secret?: boolean;
}

export type FieldIntent =
  | (BaseIntent & { kind: "text" | "textarea" | "password"; value: string })
  | (BaseIntent & { kind: "radio"; value: string })
  | (BaseIntent & { kind: "yesno"; value: boolean })
  | (BaseIntent & { kind: "checkbox"; values: string[] })
  | (BaseIntent & { kind: "select"; value: string })
  | (BaseIntent & { kind: "date"; value: string });

export interface FillOutcome {
  filled: FilledField[];
  failures: { intent: FieldIntent; error: string }[];
}

export interface FillerOptions {
  /** Allow falling back to act() when observe() cannot find a selector. Secrets never fall back. */
  allowActFallback?: boolean;
  log?: (message: string) => void;
}

export function previewValue(intent: FieldIntent): string {
  if (intent.secret || intent.kind === "password") return SECRET_PLACEHOLDER;
  switch (intent.kind) {
    case "text":
    case "textarea":
      return redact(intent.value, { keep: 2 });
    case "checkbox":
      return intent.values.join(", ");
    case "yesno":
      return yesNo(intent.value);
    default:
      return intent.value;
  }
}

function vars(record: Record<string, string>): Record<string, string> {
  return record;
}

export class FieldFiller {
  constructor(
    private readonly driver: FormDriver,
    private readonly options: FillerOptions = {},
  ) {}

  async fillAll(intents: FieldIntent[]): Promise<FillOutcome> {
    const outcome: FillOutcome = { filled: [], failures: [] };
    for (const intent of intents) {
      try {
        const record = await this.fillOne(intent);
        outcome.filled.push(record);
      } catch (error) {
        outcome.failures.push({ intent, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcome;
  }

  async fillOne(intent: FieldIntent): Promise<FilledField> {
    const base = {
      label: intent.label,
      kind: intent.kind === "yesno" ? ("radio" as const) : intent.kind,
      ...(intent.source ? { source: intent.source } : {}),
      valuePreview: previewValue(intent),
    };
    switch (intent.kind) {
      case "text":
      case "textarea":
      case "password":
        return { ...base, method: await this.fillText(intent) };
      case "date":
        return { ...base, method: await this.fillDate(intent) };
      case "radio":
        return { ...base, method: await this.chooseRadio(intent.label, intent.value) };
      case "yesno":
        return { ...base, method: await this.chooseRadio(intent.label, yesNo(intent.value)) };
      case "checkbox":
        return { ...base, method: await this.tickCheckboxes(intent) };
      case "select":
        return { ...base, method: await this.chooseSelect(intent) };
    }
  }

  private canFallback(intent: FieldIntent): boolean {
    return (this.options.allowActFallback ?? true) && !intent.secret && intent.kind !== "password";
  }

  private async fillText(intent: Extract<FieldIntent, { kind: "text" | "textarea" | "password" }>) {
    const what = intent.kind === "password" ? "password input" : intent.kind === "textarea" ? "text area" : "text input";
    const actions = await this.driver.observe(`the ${what} for the field labelled "${intent.label}"`);
    const target = actions[0];
    if (target) {
      await this.driver.fill(target.selector, intent.value);
      return "selector" as const;
    }
    if (!this.canFallback(intent)) {
      throw new Error(`Could not locate the "${intent.label}" input and act() fallback is not permitted for this field`);
    }
    const result = await this.driver.act(`type %value% into the field labelled "${intent.label}"`, vars({ value: intent.value }));
    if (!result.success) throw new Error(`act() failed for "${intent.label}": ${result.message}`);
    return "act" as const;
  }

  private async fillDate(intent: Extract<FieldIntent, { kind: "date" }>) {
    const parts = dateParts(intent.value);
    const actions = await this.driver.observe(
      `the Day, Month and Year text inputs for the date field labelled "${intent.label}"`,
    );
    const pick = (word: RegExp) => actions.find((a) => word.test(a.description) || word.test(a.selector));
    const day = pick(/\bday\b/i);
    const month = pick(/\bmonth\b/i);
    const year = pick(/\byear\b/i);
    if (day && month && year) {
      await this.driver.fill(day.selector, parts.day);
      await this.driver.fill(month.selector, parts.month);
      await this.driver.fill(year.selector, parts.year);
      return "selector" as const;
    }
    if (actions.length === 3) {
      // Three inputs in document order are almost always day, month, year.
      await this.driver.fill(actions[0]!.selector, parts.day);
      await this.driver.fill(actions[1]!.selector, parts.month);
      await this.driver.fill(actions[2]!.selector, parts.year);
      return "selector" as const;
    }
    if (!this.canFallback(intent)) throw new Error(`Could not locate the date inputs for "${intent.label}"`);
    const result = await this.driver.act(
      `for the date field labelled "${intent.label}", type %day% into Day, %month% into Month and %year% into Year`,
      vars({ day: parts.day, month: parts.month, year: parts.year }),
    );
    if (!result.success) throw new Error(`act() failed for date "${intent.label}": ${result.message}`);
    return "act" as const;
  }

  private async chooseRadio(label: string, optionText: string) {
    const actions = await this.driver.observe(
      `the radio button whose option label is "${optionText}" for the question "${label}"`,
    );
    const target = actions[0];
    if (target) {
      await this.driver.click(target.selector);
      return "selector" as const;
    }
    const result = await this.driver.act(`select the radio option "${optionText}" for the question "${label}"`);
    if (!result.success) throw new Error(`act() failed selecting "${optionText}" for "${label}": ${result.message}`);
    return "act" as const;
  }

  private async tickCheckboxes(intent: Extract<FieldIntent, { kind: "checkbox" }>) {
    let method: "selector" | "act" = "selector";
    for (const value of intent.values) {
      const actions = await this.driver.observe(
        `the checkbox whose label is "${value}" for the question "${intent.label}"`,
      );
      const target = actions[0];
      if (target) {
        await this.driver.click(target.selector);
        continue;
      }
      const result = await this.driver.act(`tick the checkbox "${value}" for the question "${intent.label}"`);
      if (!result.success) throw new Error(`act() failed ticking "${value}": ${result.message}`);
      method = "act";
    }
    return method;
  }

  private async chooseSelect(intent: Extract<FieldIntent, { kind: "select" }>) {
    const actions = await this.driver.observe(`the drop-down (select) or autocomplete input labelled "${intent.label}"`);
    const target = actions[0];
    if (target && (await this.driver.selectOption(target.selector, intent.value))) {
      return "selector" as const;
    }
    // Autocomplete-style country pickers are text inputs; type the value and accept the suggestion.
    const result = await this.driver.act(
      `in the field labelled "${intent.label}", choose or type and select the option %value%`,
      vars({ value: intent.value }),
    );
    if (!result.success) throw new Error(`act() failed choosing "${intent.value}" for "${intent.label}": ${result.message}`);
    return "act" as const;
  }
}

/**
 * Does the page heading match any of the given patterns? The document title
 * is only consulted when the page has no heading, because titles carry the
 * service name ("... - Apply for a UK visa - GOV.UK") which would match far
 * too much.
 */
export function pageMatches(state: PageState, patterns: RegExp[]): boolean {
  const text = state.heading || state.title;
  return Boolean(text) && patterns.some((re) => re.test(text));
}
