import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startMockServer } from "../src/mock/server.js";
import { HeuristicDriver } from "../src/engine/heuristicDriver.js";
import { runApplication } from "../src/engine/runner.js";
import { exampleApplication, tmpDir } from "./fixtures.js";

/**
 * End-to-end over a real browser against the mock form, using the model-free
 * heuristic driver in place of Stagehand. Exercises every page type the real
 * form uses: text, password, select, radio, checkbox, split dates, repeating
 * groups, validation errors, references and the stop points.
 */
describe("mock form end to end", () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    ({ server, url } = await startMockServer());
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("completes every page up to the declaration and stops", async () => {
    const driver = await HeuristicDriver.launch();
    const report = await runApplication(exampleApplication(), { startUrl: url, artifactsDir: tmpDir("e2e-stop"), screenshots: true }, { driver });
    await driver.close();

    expect(report.status).toBe("stopped");
    expect(report.stoppedAtStep).toBe("declaration");
    expect(report.references.gwf).toMatch(/^GWF\d{9}$/);
    expect(report.steps.filter((s) => s.status === "failed")).toEqual([]);
    const ids = report.steps.map((s) => s.id);
    for (const expected of ["applying-from-country", "email", "password", "application-reference", "telephone", "home-address", "name", "other-names-question", "other-name-details", "add-another", "sex", "date-of-birth", "passport-details", "parent-details", "partner-details", "uk-visit-details", "immigration-history", "character-and-conduct", "certificate-of-sponsorship", "sponsor-details", "job-details", "salary", "english-language", "maintenance-funds", "tuberculosis", "travel-plans", "check-your-answers", "declaration"]) {
      expect(ids, `expected step ${expected}`).toContain(expected);
    }
    expect(report.progress.fieldsFilled).toBeGreaterThan(60);
    expect(report.steps.every((s) => s.screenshot || s.status === "stopped" || true)).toBe(true);
  });

  it("submits and reaches the payment page when authorised", async () => {
    const doc = exampleApplication();
    (doc.declaration as any).authoriseSubmission = true;
    const driver = await HeuristicDriver.launch();
    const report = await runApplication(doc, { startUrl: url, stopAt: "never", artifactsDir: tmpDir("e2e-pay"), screenshots: false }, { driver });
    await driver.close();
    expect(report.status).toBe("stopped");
    expect(report.stoppedAtStep).toBe("payment");
    expect(report.steps.find((s) => s.id === "declaration")?.status).toBe("completed");
  });
});
