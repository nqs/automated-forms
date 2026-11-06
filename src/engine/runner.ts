import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ApplicationStatusReport, StepRecord } from "../schema/status.js";
import { applicationStatusReport } from "../schema/status.js";
import { parseApplication, type SkilledWorkerApplication } from "../schema/application.js";
import { builtInSteps } from "../steps/index.js";
import { CONTINUE } from "../steps/helpers.js";
import type { FormDriver, PageState } from "./driver.js";
import { FieldFiller, pageMatches, type FieldIntent } from "./fields.js";
import { EXTRACT_QUESTIONS_INSTRUCTION, buildDictionary, mapQuestions, pageQuestionsSchema } from "./fallback.js";
import type { FormStep, ResolvedRunOptions, RunOptions, RunState, StepContext } from "./types.js";

export const DEFAULT_START_URL = "https://www.gov.uk/skilled-worker-visa/apply";
const GWF = /\bGWF\d{9}\b/;
const MAX_ATTEMPTS_PER_PAGE = 3;

export interface RunDeps {
  /** A ready driver. When omitted, `createDriver` is called. */
  driver?: FormDriver;
  createDriver?: (options: ResolvedRunOptions) => Promise<FormDriver>;
  now?: () => Date;
}

class StopRun extends Error {
  constructor(
    readonly status: ApplicationStatusReport["status"],
    readonly reason: string,
    readonly nextActions: string[] = [],
  ) {
    super(reason);
  }
}

export function resolveOptions(options: RunOptions, modelName: string): ResolvedRunOptions {
  return {
    startUrl: options.startUrl ?? DEFAULT_START_URL,
    stopAt: options.stopAt ?? "declaration",
    maxPages: options.maxPages ?? 200,
    artifactsDir: options.artifactsDir ?? join(process.cwd(), "runs", new Date().toISOString().replace(/[:.]/g, "-")),
    screenshots: options.screenshots ?? true,
    resolveVerificationCode: options.resolveVerificationCode,
    onStep: options.onStep,
    extraSteps: options.extraSteps ?? [],
    log: options.log ?? (() => {}),
    modelName,
  };
}

/**
 * Run the Skilled Worker application end to end and return the status report.
 * Never throws for form-level problems; those are reported in `status`.
 */
export async function runApplication(input: unknown, options: RunOptions = {}, deps: RunDeps = {}): Promise<ApplicationStatusReport> {
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const runId = randomUUID();
  const modelName = options.modelName ?? process.env.STAGEHAND_MODEL ?? "anthropic/claude-opus-5-5";
  const resolved = resolveOptions(options, modelName);
  const log = resolved.log;

  let app: SkilledWorkerApplication;
  try {
    app = parseApplication(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return finalise({
      runId,
      app: undefined,
      resolved,
      startedAt,
      finishedAt: now(),
      status: "failed",
      statusReason: `Input document failed validation: ${message}`,
      steps: [],
      state: freshState(),
      nextActions: ["Fix the input document and re-run. Use the `validate` command to see all issues."],
      finalPage: undefined,
      usage: undefined,
    });
  }

  await mkdir(join(resolved.artifactsDir, "screenshots"), { recursive: true });

  const steps = [...resolved.extraSteps, ...builtInSteps];
  const state = freshState();
  const records: StepRecord[] = [];
  let driver: FormDriver | undefined = deps.driver;
  let finalPage: PageState | undefined;
  let status: ApplicationStatusReport["status"] = "failed";
  let statusReason = "";
  let nextActions: string[] = [];

  try {
    if (!driver) {
      if (!deps.createDriver) throw new Error("No driver available: pass deps.driver or deps.createDriver");
      driver = await deps.createDriver(resolved);
    }
    log(`Opening ${resolved.startUrl}`);
    await driver.goto(resolved.startUrl);

    for (let pageIndex = 0; pageIndex < resolved.maxPages; pageIndex++) {
      await driver.waitForSettled();
      const page = await driver.pageState();
      finalPage = page;
      harvestReferences(page, state);

      const pageKey = `${page.url}|${page.heading}`;
      state.consecutiveVisits = pageKey === state.lastPageKey ? state.consecutiveVisits + 1 : 1;
      state.lastPageKey = pageKey;

      const ctx: StepContext = { app, driver, page, state, options: resolved, log };
      const step = steps.find((s) => matchesStep(s, ctx));
      const record = await handlePage(ctx, steps, step, pageIndex, records);
      records.push(record);
      resolved.onStep?.(record);
      finalPage = await driver.pageState().catch(() => finalPage);
    }
    throw new StopRun("needs_attention", `Stopped after visiting ${resolved.maxPages} pages without reaching the end of the form`, [
      "Inspect the screenshots to see where the automation looped",
    ]);
  } catch (error) {
    if (error instanceof StopRun) {
      status = error.status;
      statusReason = error.reason;
      nextActions = error.nextActions;
    } else {
      status = "failed";
      statusReason = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
      nextActions = ["Check the browser/model configuration and re-run. The application can be resumed with the GWF reference if one was issued."];
      log(statusReason);
    }
  }

  const usage = driver ? await driver.usage().catch(() => undefined) : undefined;
  if (driver && !deps.driver) await driver.close().catch(() => {});

  const report = finalise({ runId, app, resolved, startedAt, finishedAt: now(), status, statusReason, steps: records, state, nextActions, finalPage, usage });
  await writeFile(join(resolved.artifactsDir, "status.json"), JSON.stringify(report, null, 2)).catch(() => {});
  return report;

  // ---- inner helpers that need closure over `steps`/`state` ----

  async function handlePage(ctx: StepContext, allSteps: FormStep[], step: FormStep | undefined, pageIndex: number, previous: StepRecord[]): Promise<StepRecord> {
    const { page } = ctx;
    const begun = now();
    const record: StepRecord = {
      id: step?.id ?? `unknown-${pageIndex}`,
      title: page.heading || step?.title || page.title,
      url: page.url,
      status: "completed",
      startedAt: begun.toISOString(),
      durationMs: 0,
      attempts: state.consecutiveVisits,
      recognised: Boolean(step),
      fieldsFilled: [],
      fieldsNotFound: [],
      validationErrors: page.errors,
      unansweredQuestions: [],
    };
    log(`[${pageIndex}] ${record.title} ${step ? `→ ${step.id}` : "→ (unrecognised)"}${page.errors.length ? ` with ${page.errors.length} validation error(s)` : ""}`);

    if (state.consecutiveVisits > MAX_ATTEMPTS_PER_PAGE) {
      record.status = "failed";
      await snapshot(record, pageIndex);
      finish(record, begun);
      throw new StopRun(
        "needs_attention",
        page.errors.length
          ? `The form kept rejecting the "${record.title}" page: ${page.errors.map((e) => e.message).join("; ")}`
          : `The automation could not get past the "${record.title}" page`,
        [`Open the saved application${state.references.gwf ? ` (${state.references.gwf})` : ""} and complete the "${record.title}" page manually`],
      );
    }

    // Terminal and stop pages
    if (step?.kind === "terminal") {
      await step.run?.(ctx);
      await snapshot(record, pageIndex);
      finish(record, begun);
      previous.push(record);
      throw new StopRun("submitted", `Application submitted${state.references.uan ? ` with UAN ${state.references.uan}` : ""}`, [
        "Pay the Immigration Health Surcharge and application fee if not already paid",
        "Book the biometrics appointment or complete the identity check using the UK Immigration: ID Check app",
        "Upload supporting documents",
      ]);
    }
    if (step?.id === "payment") {
      record.status = "stopped";
      await snapshot(record, pageIndex);
      finish(record, begun);
      previous.push(record);
      throw new StopRun("stopped", "Reached the payment page. Payment is not automated.", [
        `Sign in with the GWF reference${state.references.gwf ? ` ${state.references.gwf}` : ""} and complete payment manually`,
      ]);
    }
    if (step?.id === "declaration" && (!ctx.app.declaration.authoriseSubmission || ctx.options.stopAt === "declaration")) {
      record.status = "stopped";
      await snapshot(record, pageIndex);
      finish(record, begun);
      previous.push(record);
      throw new StopRun(
        "stopped",
        ctx.app.declaration.authoriseSubmission
          ? "Reached the declaration page; stopAt is set to 'declaration'"
          : "Reached the declaration page; declaration.authoriseSubmission is false so the form was not submitted",
        [
          "Review the completed answers in the saved application",
          "To submit automatically, set declaration.authoriseSubmission to true and run with stopAt 'payment' or 'never'",
        ],
      );
    }

    // Fill the page
    const filler = new FieldFiller(ctx.driver, { allowActFallback: true, log });
    let ok = true;
    if (step) {
      const intents = step.fields?.(ctx) ?? [];
      const outcome = await filler.fillAll(intents);
      record.fieldsFilled = outcome.filled;
      for (const f of outcome.failures) {
        record.fieldsNotFound.push(f.intent.label);
        state.warnings.push(`${step.id}: could not fill "${f.intent.label}": ${f.error}`);
      }
      if (step.run) {
        const result = await step.run(ctx);
        if (result === false) ok = false;
      }
    } else {
      ok = await genericFill(ctx, allSteps, filler, record);
    }

    await snapshot(record, pageIndex);

    if (!ok) {
      record.status = "failed";
      finish(record, begun);
      previous.push(record);
      throw new StopRun("needs_attention", `Could not complete the "${record.title}" page`, [
        `Complete the "${record.title}" page manually${state.references.gwf ? ` in application ${state.references.gwf}` : ""}`,
        ...record.unansweredQuestions.map((q) => `Answer: ${q}`),
        ...record.fieldsNotFound.map((q) => `Enter: ${q}`),
      ]);
    }

    // Move on
    const continueLabel = step?.continueLabel === undefined ? CONTINUE : step.continueLabel;
    if (continueLabel !== null) {
      const clicked = await ctx.driver.clickButtonByText(continueLabel);
      if (!clicked) {
        const result = await ctx.driver.act("click the Continue button (or Save and continue / Next) to go to the next page");
        if (!result.success) {
          record.status = "failed";
          finish(record, begun);
          previous.push(record);
          throw new StopRun("needs_attention", `No Continue button could be found on the "${record.title}" page`, [
            `Inspect ${record.screenshot ?? "the screenshot"} and continue manually`,
          ]);
        }
      }
    }
    await ctx.driver.waitForSettled();
    const after = await ctx.driver.pageState();
    const stayed = `${after.url}|${after.heading}` === `${page.url}|${page.heading}`;
    if (stayed && after.errors.length > 0) {
      record.validationErrors = after.errors;
      record.status = "failed";
      log(`Validation errors on "${record.title}": ${after.errors.map((e) => e.message).join("; ")}`);
    } else if (stayed && continueLabel !== null) {
      record.status = "failed";
      state.warnings.push(`"${record.title}" did not advance after pressing Continue`);
    } else {
      record.status = "completed";
      if (step?.repeatGroup) {
        state.repeatIndex[step.repeatGroup] = (state.repeatIndex[step.repeatGroup] ?? 0) + 1;
        state.lastRepeatGroup = step.repeatGroup;
      }
      step?.after?.(ctx);
    }
    finish(record, begun);
    return record;
  }

  async function genericFill(ctx: StepContext, allSteps: FormStep[], filler: FieldFiller, record: StepRecord): Promise<boolean> {
    log(`Unrecognised page "${ctx.page.heading}": asking the model to list its questions`);
    const questions = await ctx.driver.extract(EXTRACT_QUESTIONS_INSTRUCTION, pageQuestionsSchema);
    const dictionary = buildDictionary(allSteps, ctx);
    const { mapped, unanswered } = mapQuestions(questions.questions, dictionary);
    record.unansweredQuestions = unanswered;
    if (questions.questions.length === 0) {
      state.warnings.push(`Page "${ctx.page.heading}" was not recognised and has no questions; pressed Continue`);
      return questions.hasContinueButton;
    }
    if (mapped.length === 0) {
      state.warnings.push(`Page "${ctx.page.heading}" was not recognised and none of its questions matched the input document`);
      return false;
    }
    const intents: FieldIntent[] = mapped.map((m) => m.intent);
    const outcome = await filler.fillAll(intents);
    record.fieldsFilled = outcome.filled;
    for (const f of outcome.failures) record.fieldsNotFound.push(f.intent.label);
    state.warnings.push(
      `Page "${ctx.page.heading}" was handled by the generic fallback (${mapped.map((m) => `${m.question.label} ← ${m.stepId}`).join(", ")}); review it`,
    );
    const required = questions.questions.filter((q) => q.required).map((q) => q.label);
    const missingRequired = required.filter((label) => unanswered.includes(label));
    return missingRequired.length === 0;
  }

  async function snapshot(record: StepRecord, pageIndex: number): Promise<void> {
    if (!resolved.screenshots || !driver) return;
    const file = join(resolved.artifactsDir, "screenshots", `${String(pageIndex).padStart(3, "0")}-${slug(record.id)}.png`);
    try {
      await driver.screenshot(file);
      record.screenshot = file;
    } catch (error) {
      log(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function finish(record: StepRecord, begun: Date): void {
    record.durationMs = now().getTime() - begun.getTime();
  }
}

export function matchesStep(step: FormStep, ctx: StepContext): boolean {
  const matched = typeof step.match === "function" ? step.match(ctx.page) : pageMatches(ctx.page, step.match);
  if (!matched) return false;
  return step.when ? step.when(ctx) : true;
}

function harvestReferences(page: PageState, state: RunState): void {
  if (!state.references.gwf) {
    const gwf = GWF.exec(page.bodyText);
    if (gwf) state.references.gwf = gwf[0];
  }
}

function freshState(): RunState {
  return { repeatIndex: {}, references: {}, consecutiveVisits: 0, warnings: [] };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

interface FinaliseArgs {
  runId: string;
  app: SkilledWorkerApplication | undefined;
  resolved: ResolvedRunOptions;
  startedAt: Date;
  finishedAt: Date;
  status: ApplicationStatusReport["status"];
  statusReason: string;
  steps: StepRecord[];
  state: RunState;
  nextActions: string[];
  finalPage: PageState | undefined;
  usage: { inputTokens: number; outputTokens: number; inferenceTimeMs: number } | undefined;
}

function finalise(a: FinaliseArgs): ApplicationStatusReport {
  const knownIds = new Set(builtInSteps.filter((s) => s.kind !== "terminal" && s.kind !== "stop").map((s) => s.id));
  const completedKnown = new Set(a.steps.filter((s) => s.status === "completed" && knownIds.has(s.id)).map((s) => s.id));
  const stopped = a.steps.find((s) => s.status === "stopped" || s.status === "failed");
  const report: ApplicationStatusReport = {
    reportVersion: 1,
    runId: a.runId,
    ...(a.app?.clientReference ? { clientReference: a.app.clientReference } : {}),
    applicationType: "skilled-worker",
    status: a.status,
    statusReason: a.statusReason,
    startedAt: a.startedAt.toISOString(),
    finishedAt: a.finishedAt.toISOString(),
    durationMs: a.finishedAt.getTime() - a.startedAt.getTime(),
    startUrl: a.resolved.startUrl,
    ...(a.finalPage ? { finalUrl: a.finalPage.url, finalPageTitle: a.finalPage.heading || a.finalPage.title } : {}),
    ...(stopped ? { stoppedAtStep: stopped.id } : a.status !== "submitted" && a.steps.length ? { stoppedAtStep: a.steps[a.steps.length - 1]!.id } : {}),
    references: a.state.references,
    progress: {
      pagesVisited: a.steps.length,
      pagesCompleted: a.steps.filter((s) => s.status === "completed").length,
      fieldsFilled: a.steps.reduce((n, s) => n + s.fieldsFilled.length, 0),
      percentOfKnownSteps: Math.round((completedKnown.size / Math.max(1, knownIds.size)) * 100),
    },
    steps: a.steps,
    warnings: a.state.warnings,
    nextActions: a.nextActions,
    model: {
      name: a.resolved.modelName,
      ...(a.usage ? { inputTokens: a.usage.inputTokens, outputTokens: a.usage.outputTokens, inferenceTimeMs: a.usage.inferenceTimeMs } : {}),
    },
    artifactsDir: a.resolved.artifactsDir,
  };
  return applicationStatusReport.parse(report);
}
