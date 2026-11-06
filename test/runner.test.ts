import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { Action, ActOutcome, FormDriver, PageState } from "../src/engine/driver.js";
import { runApplication } from "../src/engine/runner.js";
import { exampleApplication, tmpDir } from "./fixtures.js";

/**
 * A scripted driver: a list of pages, each advanced by "Continue". Fields are
 * recorded rather than rendered, which is enough to test the runner's control
 * flow (stop points, validation retries, references, unrecognised pages).
 */
class ScriptedDriver implements FormDriver {
  index = 0;
  filled: { selector: string; value: string }[] = [];
  clicked: string[] = [];
  acts: string[] = [];
  constructor(private readonly pages: (Partial<PageState> & { heading: string; errorsOnFirstContinue?: boolean; questions?: unknown })[]) {}
  private get current() {
    return this.pages[Math.min(this.index, this.pages.length - 1)]!;
  }
  async goto() {}
  async pageState(): Promise<PageState> {
    const p = this.current;
    return { url: p.url ?? `https://form.example/page/${this.index}`, title: p.heading, heading: p.heading, bodyText: p.bodyText ?? p.heading, errors: p.errors ?? [] };
  }
  async observe(instruction: string): Promise<Action[]> {
    if (/date field/.test(instruction)) return ["day", "month", "year"].map((d) => ({ selector: `#${d}`, description: `${d} input` }));
    return [{ selector: `#${instruction.replace(/[^a-z]+/gi, "-").slice(0, 40)}`, description: instruction }];
  }
  async act(instruction: string): Promise<ActOutcome> {
    this.acts.push(instruction);
    return { success: true, message: "ok" };
  }
  async extract<S extends z.ZodType>(_i: string, schema: S): Promise<z.output<S>> {
    return schema.parse(this.current.questions ?? { questions: [], hasContinueButton: true }) as z.output<S>;
  }
  async fill(selector: string, value: string) {
    this.filled.push({ selector, value });
  }
  async selectOption() {
    return true;
  }
  async click(selector: string) {
    this.clicked.push(selector);
  }
  async clickButtonByText() {
    const p = this.current;
    if (p.errorsOnFirstContinue) {
      p.errors = [{ field: "x", message: "Enter a value" }];
      p.errorsOnFirstContinue = false;
      return true;
    }
    p.errors = [];
    this.index += 1;
    return true;
  }
  async waitForSettled() {}
  async screenshot() {}
  async usage() {
    return { inputTokens: 10, outputTokens: 5, inferenceTimeMs: 1 };
  }
  async close() {}
}

const base = { screenshots: false, startUrl: "https://form.example/start" };

describe("runner", () => {
  it("fails fast on an invalid input document", async () => {
    const report = await runApplication({ nope: true }, { ...base, artifactsDir: tmpDir("invalid") }, { driver: new ScriptedDriver([{ heading: "x" }]) });
    expect(report.status).toBe("failed");
    expect(report.statusReason).toMatch(/validation/i);
  });

  it("fills recognised pages, records the GWF reference and stops at the declaration", async () => {
    const driver = new ScriptedDriver([
      { heading: "Email address" },
      { heading: "Create a password" },
      { heading: "Your application reference number", bodyText: "Your reference is GWF012345678. Keep it safe." },
      { heading: "Your name" },
      { heading: "What is your date of birth?" },
      { heading: "Check your answers" },
      { heading: "Declaration" },
    ]);
    const report = await runApplication(exampleApplication(), { ...base, artifactsDir: tmpDir("stop") }, { driver });
    expect(report.status).toBe("stopped");
    expect(report.stoppedAtStep).toBe("declaration");
    expect(report.references.gwf).toBe("GWF012345678");
    expect(report.steps.map((s) => s.id)).toEqual(["email", "password", "application-reference", "name", "date-of-birth", "check-your-answers", "declaration"]);
    const name = report.steps.find((s) => s.id === "name")!;
    expect(name.fieldsFilled.map((f) => f.label)).toEqual(["Given name(s)", "Family name"]);
    expect(name.fieldsFilled.every((f) => f.method === "selector")).toBe(true);
    // Secrets are never previewed and never sent through act()
    const email = report.steps.find((s) => s.id === "email")!;
    expect(email.fieldsFilled.every((f) => f.valuePreview === "••••••••")).toBe(true);
    expect(driver.acts.some((a) => /example\.com/.test(a))).toBe(false);
    expect(driver.filled.some((f) => f.value === "asha.venkataraman@example.com")).toBe(true);
    expect(report.model.inputTokens).toBe(10);
  });

  it("submits when authorised and stopAt is never, capturing the UAN", async () => {
    const doc = exampleApplication();
    (doc.declaration as any).authoriseSubmission = true;
    const driver = new ScriptedDriver([
      { heading: "Declaration" },
      { heading: "Application submitted", bodyText: "Your Unique Application Number (UAN) is 1234-5678-9012-3456." },
    ]);
    const report = await runApplication(doc, { ...base, stopAt: "never", artifactsDir: tmpDir("submit") }, { driver });
    expect(report.status).toBe("submitted");
    expect(report.references.uan).toBe("1234-5678-9012-3456");
  });

  it("always stops at the payment page", async () => {
    const doc = exampleApplication();
    (doc.declaration as any).authoriseSubmission = true;
    const driver = new ScriptedDriver([{ heading: "Declaration" }, { heading: "Pay for your application" }]);
    const report = await runApplication(doc, { ...base, stopAt: "never", artifactsDir: tmpDir("pay") }, { driver });
    expect(report.status).toBe("stopped");
    expect(report.stoppedAtStep).toBe("payment");
  });

  it("retries a page that shows validation errors and gives up after repeated failures", async () => {
    const driver = new ScriptedDriver([{ heading: "Your name", errorsOnFirstContinue: true }, { heading: "Declaration" }]);
    const report = await runApplication(exampleApplication(), { ...base, artifactsDir: tmpDir("retry") }, { driver });
    expect(report.status).toBe("stopped");
    const nameSteps = report.steps.filter((s) => s.id === "name");
    expect(nameSteps.length).toBe(2);
    expect(nameSteps[0]!.status).toBe("failed");
    expect(nameSteps[0]!.validationErrors[0]!.message).toBe("Enter a value");
    expect(nameSteps[1]!.status).toBe("completed");

    const stuck = new ScriptedDriver([{ heading: "Your name", errors: [{ message: "Enter your family name" }] }]);
    stuck.clickButtonByText = async () => true; // never advances
    const stuckReport = await runApplication(exampleApplication(), { ...base, artifactsDir: tmpDir("stuck") }, { driver: stuck });
    expect(stuckReport.status).toBe("needs_attention");
    expect(stuckReport.statusReason).toMatch(/kept rejecting/);
  });

  it("handles an unrecognised page through the generic fallback", async () => {
    const driver = new ScriptedDriver([
      {
        heading: "Tell us about yourself",
        questions: {
          questions: [
            { label: "What is your passport number?", inputType: "text", options: [], required: true },
            { label: "Favourite colour", inputType: "text", options: [], required: false },
          ],
          hasContinueButton: true,
        },
      },
      { heading: "Declaration" },
    ]);
    const report = await runApplication(exampleApplication(), { ...base, artifactsDir: tmpDir("fallback") }, { driver });
    expect(report.status).toBe("stopped");
    const unknown = report.steps[0]!;
    expect(unknown.recognised).toBe(false);
    expect(unknown.status).toBe("completed");
    expect(unknown.fieldsFilled[0]!.source).toBe("/applicant/passport/number");
    expect(unknown.unansweredQuestions).toEqual(["Favourite colour"]);
    expect(report.warnings.some((w) => /generic fallback/.test(w))).toBe(true);
  });

  it("hands over when a verification code is needed and no resolver is configured", async () => {
    const driver = new ScriptedDriver([{ heading: "Enter the verification code we sent you" }]);
    const report = await runApplication(exampleApplication(), { ...base, artifactsDir: tmpDir("otp") }, { driver });
    expect(report.status).toBe("needs_attention");
    expect(report.warnings[0]).toMatch(/verification code/);
  });
});
