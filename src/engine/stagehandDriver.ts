import { Stagehand, browserbase, localBrowser, type Page, type StagehandBrowser } from "@browserbasehq/stagehand";
import type { z } from "zod";
import type { Action, ActOutcome, FormDriver, PageState } from "./driver.js";
import { browserExpression, capturePageState, clickButtonMatching, documentReplaced, markDocument } from "./pageState.js";

export interface StagehandDriverOptions {
  /** provider/model, e.g. anthropic/claude-opus-5-5 */
  modelName: `${"openai" | "anthropic" | "google" | "groq" | "cerebras"}/${string}`;
  modelApiKey?: string;
  headless?: boolean;
  chromePath?: string;
  userDataDir?: string;
  browserbaseApiKey?: string;
  browserbaseProjectId?: string;
  /** Extra guidance given to the model on every act/observe/extract call. */
  systemPrompt?: string;
  actTimeoutMs?: number;
  verbose?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are filling in a UK Home Office visa application form built with the GOV.UK Design System.
Rules:
- Only interact with the element the instruction names. Never click Continue, Save, Submit, Pay or navigation links unless the instruction says so.
- Radio buttons and checkboxes are labelled; choose the option whose label matches the requested value most closely.
- Dates are split into separate Day, Month and Year inputs.
- Do not invent values. If the requested element does not exist, report that instead of acting on something else.`;

export class StagehandFormDriver implements FormDriver {
  private constructor(
    private readonly stagehand: Stagehand,
    private readonly browser: StagehandBrowser,
    private page: Page,
    private readonly opts: StagehandDriverOptions,
  ) {}

  static async launch(opts: StagehandDriverOptions): Promise<StagehandFormDriver> {
    const browser = opts.browserbaseApiKey
      ? await browserbase.launch({
          apiKey: opts.browserbaseApiKey,
          ...(opts.browserbaseProjectId ? { projectId: opts.browserbaseProjectId } : {}),
        })
      : await localBrowser.launch({
          headless: opts.headless ?? true,
          ...(opts.chromePath ? { executablePath: opts.chromePath } : {}),
          ...(opts.userDataDir ? { userDataDir: opts.userDataDir, preserveUserDataDir: true } : {}),
          viewport: { width: 1280, height: 1600 },
        });

    const stagehand = await Stagehand.create({
      browser,
      model: { modelName: opts.modelName, ...(opts.modelApiKey ? { apiKey: opts.modelApiKey } : {}) },
      systemPrompt: opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      selfHeal: true,
      logging: { level: opts.verbose ? "info" : "warn", format: "pretty" },
    });

    const pages = await browser.context.pages();
    const page = pages[0] ?? (await browser.context.newPage());
    return new StagehandFormDriver(stagehand, browser, page, opts);
  }

  private async currentPage(): Promise<Page> {
    const active = await this.browser.context.activePage();
    if (active) this.page = active;
    return this.page;
  }

  async goto(url: string): Promise<void> {
    const page = await this.currentPage();
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
  }

  async pageState(): Promise<PageState> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const page = await this.currentPage();
        return await page.evaluate<PageState>(browserExpression(capturePageState));
      } catch (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw lastError;
  }

  async observe(instruction: string): Promise<Action[]> {
    const result = await this.stagehand.observe(instruction, { timeout: this.opts.actTimeoutMs ?? 45_000 });
    return result.data;
  }

  async act(instruction: string, variables?: Record<string, string | number | boolean>): Promise<ActOutcome> {
    if (/continue|next|submit/i.test(instruction)) await this.markForNavigation();
    const result = await this.stagehand.act(instruction, {
      ...(variables ? { variables } : {}),
      timeout: this.opts.actTimeoutMs ?? 45_000,
    });
    return { success: result.data.success, message: result.data.message };
  }

  async extract<S extends z.ZodType>(instruction: string, schema: S): Promise<z.output<S>> {
    const result = await this.stagehand.extract(instruction, schema, { timeout: this.opts.actTimeoutMs ?? 45_000 });
    return result.data;
  }

  async fill(selector: string, value: string): Promise<void> {
    const page = await this.currentPage();
    await page.locator(selector).fill(value, { timeout: 10_000 });
  }

  async selectOption(selector: string, value: string): Promise<boolean> {
    const page = await this.currentPage();
    try {
      const chosen = await page.locator(selector).selectOption(value, { timeout: 10_000 });
      return chosen.length > 0;
    } catch {
      return false;
    }
  }

  async click(selector: string): Promise<void> {
    const page = await this.currentPage();
    await page.locator(selector).click({ timeout: 10_000 });
  }

  async clickButtonByText(text: string | RegExp): Promise<boolean> {
    const page = await this.currentPage();
    const pattern = text instanceof RegExp ? text.source : `^\\s*${escapeRegExp(text)}\\s*$`;
    await this.markForNavigation();
    return page.evaluate<boolean>(browserExpression(clickButtonMatching, pattern));
  }

  private async markForNavigation(): Promise<void> {
    const page = await this.currentPage();
    await page.evaluate(browserExpression(markDocument)).catch(() => {});
  }

  /** Wait for a navigation started by the last click (if any) to replace the document and load. */
  async waitForSettled(): Promise<void> {
    const page = await this.currentPage();
    await page.waitForFunction(browserExpression(documentReplaced), undefined, { timeout: 8_000 }).catch(() => {});
    try {
      await page.waitForLoadState("load", 30_000);
    } catch {
      /* navigation may not have happened */
    }
    await page.waitForTimeout(300);
  }

  async screenshot(path: string): Promise<void> {
    const page = await this.currentPage();
    await page.screenshot({ path, fullPage: true });
  }

  async usage() {
    try {
      const m = await this.stagehand.metrics();
      return {
        inputTokens: m.totalPromptTokens,
        outputTokens: m.totalCompletionTokens,
        inferenceTimeMs: m.totalInferenceTimeMs,
      };
    } catch {
      return undefined;
    }
  }

  async close(): Promise<void> {
    try {
      await this.stagehand.close();
    } finally {
      await this.browser.close();
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
