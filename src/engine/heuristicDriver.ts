import type { z } from "zod";
import type { Browser, Page } from "playwright";
import type { Action, ActOutcome, FormDriver, PageState } from "./driver.js";
import { browserExpression, capturePageState, clickButtonMatching, documentReplaced, markDocument } from "./pageState.js";

/**
 * A model-free driver for development and tests.
 *
 * It answers the same `observe` / `act` / `extract` requests the runner makes
 * of Stagehand, but resolves them by matching visible labels in the DOM
 * instead of asking a model. It only understands the instruction phrasings
 * the runner itself produces, which makes it a faithful stand-in for
 * exercising the page loop against the mock form or any GOV.UK-style page.
 */
export class HeuristicDriver implements FormDriver {
  private constructor(
    private readonly browser: Browser,
    private readonly page: Page,
  ) {}

  static async launch(opts: { headless?: boolean; executablePath?: string } = {}): Promise<HeuristicDriver> {
    const { chromium } = await import("playwright");
    const executablePath = opts.executablePath ?? process.env.CHROME_PATH;
    const browser = await chromium.launch({
      headless: opts.headless ?? true,
      ...(executablePath ? { executablePath } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    return new HeuristicDriver(browser, page);
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: "load" });
  }

  async pageState(): Promise<PageState> {
    return retryDuringNavigation(() => this.page.evaluate<PageState>(browserExpression(capturePageState)));
  }

  async observe(instruction: string): Promise<Action[]> {
    return this.page.evaluate<Action[]>(browserExpression(resolveInstruction, instruction));
  }

  async act(instruction: string, variables: Record<string, string | number | boolean> = {}): Promise<ActOutcome> {
    const substituted = instruction.replace(/%(\w+)%/g, (_, name: string) => String(variables[name] ?? `%${name}%`));
    const radio = /select the radio option "([^"]+)"/i.exec(substituted);
    if (radio) {
      const actions = await this.observe(`the radio button labelled "${radio[1]}"`);
      if (!actions[0]) return { success: false, message: `No radio option "${radio[1]}" found` };
      await this.click(actions[0].selector);
      return { success: true, message: "clicked" };
    }
    if (/continue button/i.test(substituted)) {
      const ok = await this.clickButtonByText(/^(continue|save and continue|next|start now|submit( application)?|pay now)$/i);
      return { success: ok, message: ok ? "clicked" : "no continue button" };
    }
    const typed = /type (.+?) into the field labelled "([^"]+)"/i.exec(substituted);
    if (typed) {
      const actions = await this.observe(`the text input for the field labelled "${typed[2]}"`);
      if (!actions[0]) return { success: false, message: `No field "${typed[2]}"` };
      await this.fill(actions[0].selector, typed[1]!);
      return { success: true, message: "typed" };
    }
    return { success: false, message: `Heuristic driver cannot perform: ${instruction}` };
  }

  async extract<S extends z.ZodType>(_instruction: string, schema: S): Promise<z.output<S>> {
    const questions = await this.page.evaluate(browserExpression(listQuestions));
    return schema.parse(questions) as z.output<S>;
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().fill(value);
  }

  async selectOption(selector: string, value: string): Promise<boolean> {
    try {
      const chosen = await this.page.locator(selector).first().selectOption({ label: value }, { timeout: 2_000 });
      return chosen.length > 0;
    } catch {
      return false;
    }
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).first().click();
  }

  async clickButtonByText(text: string | RegExp): Promise<boolean> {
    const pattern = text instanceof RegExp ? text.source : `^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`;
    await this.page.evaluate(browserExpression(markDocument));
    return this.page.evaluate<boolean>(browserExpression(clickButtonMatching, pattern));
  }

  /** Wait for a navigation started by the last click (if any) to replace the document and load. */
  async waitForSettled(): Promise<void> {
    await this.page.waitForFunction(browserExpression(documentReplaced), undefined, { timeout: 5_000 }).catch(() => {});
    await this.page.waitForLoadState("load").catch(() => {});
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }

  async usage() {
    return undefined;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

async function retryDuringNavigation<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!/context|navigat|detached|destroyed/i.test(String(error))) throw error;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Browser-side helpers. These run inside the page, so they must not reference
// anything from module scope.
// ---------------------------------------------------------------------------

function resolveInstruction(instruction: string): { selector: string; description: string }[] {
  const norm = (s: string | null | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const STOP = new Set(["the", "a", "an", "of", "your", "you", "is", "are", "do", "does", "to", "in", "on", "for", "this", "that", "what", "which", "please", "enter", "and", "or", "as", "at", "be", "have", "has", "with", "any", "ever", "s"]);
  const toks = (s: string) => norm(s).split(" ").filter((t) => t && !STOP.has(t));
  const sim = (a: string, b: string) => {
    const ta = toks(a);
    const tb = toks(b);
    if (!ta.length || !tb.length) return 0;
    const ja = ta.join(" ");
    const jb = tb.join(" ");
    if (ja === jb) return 1;
    if (ja.includes(jb) || jb.includes(ja)) return 0.9;
    const set = new Set(ta);
    return tb.filter((t) => set.has(t)).length / Math.max(ta.length, tb.length);
  };
  let counter = Number(document.body.dataset.afCounter ?? "0");
  const mark = (el: Element, description: string) => {
    counter += 1;
    document.body.dataset.afCounter = String(counter);
    el.setAttribute("data-af", String(counter));
    return { selector: `[data-af="${counter}"]`, description };
  };
  const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || el.tagName === "OPTION";
  const labelFor = (el: Element): string => {
    const id = el.getAttribute("id");
    let text = "";
    if (id) {
      const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      text = lab?.textContent ?? "";
    }
    if (!text) text = el.closest("label")?.textContent ?? "";
    if (!text) text = el.getAttribute("aria-label") ?? "";
    return text.replace(/\s+/g, " ").trim();
  };
  const legendFor = (el: Element): string => el.closest("fieldset")?.querySelector("legend")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const controls = Array.from(document.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
    (el) => visible(el) && (el as HTMLInputElement).type !== "hidden" && (el as HTMLInputElement).type !== "submit",
  );

  const best = <T,>(items: T[], score: (t: T) => number, min: number): T | undefined => {
    let top: { item: T; score: number } | undefined;
    for (const item of items) {
      const s = score(item);
      if (s >= min && (!top || s > top.score)) top = { item, score: s };
    }
    return top?.item;
  };

  let m: RegExpExecArray | null;

  // Date: three inputs under a legend
  if ((m = /date field labelled "([^"]+)"/i.exec(instruction))) {
    const label = m[1]!;
    const fieldsets = Array.from(document.querySelectorAll("fieldset")).filter((fs) => fs.querySelectorAll("input[type=text], input[type=number], input:not([type])").length >= 3);
    const fs = best(fieldsets, (f) => sim(label, f.querySelector("legend")?.textContent ?? ""), 0.4);
    if (!fs) return [];
    const inputs = Array.from(fs.querySelectorAll<HTMLInputElement>("input[type=text], input[type=number], input:not([type])"));
    return inputs.map((input) => mark(input, `${labelFor(input) || input.name} input`));
  }

  // Radio under a question
  if ((m = /radio button whose option label is "([^"]+)" for the question "([^"]+)"/i.exec(instruction))) {
    const [, option, question] = m;
    const radios = controls.filter((c) => (c as HTMLInputElement).type === "radio");
    const scored = radios.map((r) => ({ r, opt: sim(option!, labelFor(r)), q: sim(question!, legendFor(r)) }));
    const exactOpt = scored.filter((s) => s.opt >= 0.85);
    const pick = best(exactOpt, (s) => s.q, 0.3) ?? (new Set(exactOpt.map((s) => legendFor(s.r))).size === 1 ? exactOpt[0] : undefined);
    return pick ? [mark(pick.r, `radio ${option}`)] : [];
  }
  if ((m = /radio button labelled "([^"]+)"/i.exec(instruction))) {
    const option = m[1]!;
    const radios = controls.filter((c) => (c as HTMLInputElement).type === "radio" && sim(option, labelFor(c)) >= 0.85);
    return radios[0] ? [mark(radios[0], `radio ${option}`)] : [];
  }

  // Checkbox
  if ((m = /checkbox whose label is "([^"]+)" for the question "([^"]+)"/i.exec(instruction))) {
    const [, option, question] = m;
    const boxes = controls.filter((c) => (c as HTMLInputElement).type === "checkbox");
    const pick = best(boxes, (b) => Math.max(sim(option!, labelFor(b)), sim(question!, legendFor(b)) * 0.8), 0.4);
    return pick ? [mark(pick, `checkbox ${option}`)] : [];
  }

  // Select / autocomplete
  if ((m = /(?:drop-down|select).*labelled "([^"]+)"/i.exec(instruction))) {
    const label = m[1]!;
    const selects = controls.filter((c) => c.tagName === "SELECT");
    const pick = best(selects, (s) => Math.max(sim(label, labelFor(s)), sim(label, legendFor(s))), 0.4);
    return pick ? [mark(pick, `select ${label}`)] : [];
  }

  // Text / password / textarea
  if ((m = /(text input|password input|text area) for the field labelled "([^"]+)"/i.exec(instruction))) {
    const [, kind, label] = m;
    const wanted = controls.filter((c) => {
      const type = (c as HTMLInputElement).type;
      if (kind === "password input") return type === "password";
      if (kind === "text area") return c.tagName === "TEXTAREA";
      return c.tagName === "TEXTAREA" || (c.tagName === "INPUT" && !["radio", "checkbox", "password", "file"].includes(type));
    });
    const pick = best(wanted, (c) => Math.max(sim(label!, labelFor(c)), sim(label!, `${legendFor(c)} ${labelFor(c)}`)), 0.5);
    return pick ? [mark(pick, `${kind} ${label}`)] : [];
  }

  // Special-purpose inputs the steps ask for by description
  if (/verification or security code/i.test(instruction)) {
    const pick = controls.find((c) => /code/i.test(labelFor(c)) || /code/i.test(c.getAttribute("name") ?? ""));
    return pick ? [mark(pick, "code input")] : [];
  }
  if (/health surcharge|ihs/i.test(instruction)) {
    const pick = controls.find((c) => /ihs|surcharge|reference/i.test(labelFor(c)));
    return pick ? [mark(pick, "IHS reference input")] : [];
  }
  return [];
}

function listQuestions() {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const questions: { label: string; inputType: string; options: string[]; required: boolean }[] = [];
  const seen = new Set<Element>();
  document.querySelectorAll("fieldset").forEach((fs) => {
    const legend = clean(fs.querySelector("legend")?.textContent);
    const radios = Array.from(fs.querySelectorAll<HTMLInputElement>("input[type=radio], input[type=checkbox]"));
    const texts = Array.from(fs.querySelectorAll<HTMLInputElement>("input[type=text], input[type=number], input:not([type])"));
    if (radios.length) {
      radios.forEach((r) => seen.add(r));
      const options = radios.map((r) => clean(document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent));
      questions.push({ label: legend, inputType: radios[0]!.type === "radio" ? "radio" : "checkbox", options, required: true });
    } else if (texts.length >= 3 && texts.every((t) => /day|month|year/i.test(t.name + t.id))) {
      texts.forEach((t) => seen.add(t));
      questions.push({ label: legend, inputType: "date", options: [], required: true });
    }
  });
  document.querySelectorAll<HTMLElement>("input, select, textarea").forEach((el) => {
    if (seen.has(el)) return;
    const type = (el as HTMLInputElement).type;
    if (["hidden", "submit", "button", "radio", "checkbox"].includes(type)) return;
    const label = clean(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) || clean(el.getAttribute("aria-label"));
    if (!label) return;
    const inputType = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : type === "password" ? "password" : "text";
    const options = el.tagName === "SELECT" ? Array.from((el as HTMLSelectElement).options).map((o) => clean(o.textContent)).filter(Boolean) : [];
    questions.push({ label, inputType, options, required: el.hasAttribute("required") || !/optional/i.test(label) });
  });
  const hasContinueButton = Array.from(document.querySelectorAll("button, input[type=submit]")).some((b) =>
    /continue|next|start/i.test(clean(b.textContent || (b as HTMLInputElement).value)),
  );
  return { questions, hasContinueButton };
}
