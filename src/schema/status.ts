import { z } from "zod";

/**
 * Output document returned by the automation.
 *
 * `status` is the headline:
 *  - submitted:        the application was submitted (only possible with declaration.authoriseSubmission = true)
 *  - stopped:          the automation reached the configured stop point (default: the declaration page) and halted on purpose
 *  - needs_attention:  a human must take over (unrecognised page, repeated validation errors, verification code needed, ...)
 *  - failed:           an unrecoverable error (browser crash, navigation failure, model error)
 */
export const runStatus = z.enum(["submitted", "stopped", "needs_attention", "failed"]);
export type RunStatus = z.infer<typeof runStatus>;

export const stepStatus = z.enum(["completed", "failed", "skipped", "stopped"]);

export const filledField = z.object({
  label: z.string().describe("Question or field label as shown on the page"),
  kind: z.enum(["text", "radio", "checkbox", "select", "date", "textarea", "password", "button"]),
  source: z.string().optional().describe("JSON pointer into the input document the value came from"),
  valuePreview: z.string().optional().describe("Redacted preview of the value that was entered"),
  method: z.enum(["selector", "act", "skipped"]).describe("selector: filled via observe()+locator (value never sent to the model). act: filled via act()"),
});

export const validationError = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export const stepRecord = z.object({
  id: z.string(),
  title: z.string().describe("Page heading as seen in the browser"),
  url: z.string(),
  status: stepStatus,
  startedAt: z.string(),
  durationMs: z.number(),
  attempts: z.number().int().min(1),
  recognised: z.boolean().describe("false when the page was handled by the generic fallback rather than a known step"),
  fieldsFilled: z.array(filledField),
  fieldsNotFound: z.array(z.string()).describe("Answers the automation wanted to enter but found no matching input for on this page"),
  validationErrors: z.array(validationError),
  unansweredQuestions: z.array(z.string()).describe("Questions on the page the automation could not map to input data"),
  screenshot: z.string().optional().describe("Path of the screenshot taken for this page"),
  error: z.object({ message: z.string(), stack: z.string().optional() }).optional(),
});
export type StepRecord = z.infer<typeof stepRecord>;

export const applicationStatusReport = z.object({
  reportVersion: z.literal(1).default(1),
  runId: z.string(),
  clientReference: z.string().optional(),
  applicationType: z.literal("skilled-worker"),
  status: runStatus,
  statusReason: z.string().describe("Human-readable explanation of the headline status"),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationMs: z.number(),
  startUrl: z.string(),
  finalUrl: z.string().optional(),
  finalPageTitle: z.string().optional(),
  stoppedAtStep: z.string().optional().describe("Step id where the run halted"),
  references: z.object({
    gwf: z.string().optional().describe("Application reference (GWF number) issued once the account is created"),
    uan: z.string().optional().describe("Unique Application Number issued after submission"),
    ihs: z.string().optional().describe("Immigration Health Surcharge reference"),
    paymentReference: z.string().optional(),
  }),
  progress: z.object({
    pagesVisited: z.number().int(),
    pagesCompleted: z.number().int(),
    fieldsFilled: z.number().int(),
    percentOfKnownSteps: z.number().min(0).max(100),
  }),
  steps: z.array(stepRecord),
  warnings: z.array(z.string()),
  nextActions: z.array(z.string()).describe("What a human should do next, if anything"),
  model: z.object({
    name: z.string(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    inferenceTimeMs: z.number().optional(),
  }),
  artifactsDir: z.string().optional(),
});
export type ApplicationStatusReport = z.infer<typeof applicationStatusReport>;
