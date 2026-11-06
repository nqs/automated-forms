import { describe, expect, it } from "vitest";
import { safeParseApplication, parseApplication } from "../src/schema/application.js";
import { exampleApplication } from "./fixtures.js";

describe("input schema", () => {
  it("accepts the example document and applies defaults", () => {
    const app = parseApplication(exampleApplication());
    expect(app.applicationType).toBe("skilled-worker");
    expect(app.declaration.authoriseSubmission).toBe(false);
    expect(app.contact.telephone.type).toBe("mobile");
  });

  it("rejects a malformed CoS reference with a useful path", () => {
    const doc = exampleApplication();
    (doc.sponsorAndJob as any).certificateOfSponsorship.referenceNumber = "SHORT";
    const result = safeParseApplication(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "sponsorAndJob.certificateOfSponsorship.referenceNumber")).toBe(true);
    }
  });

  it("enforces cross-field rules", () => {
    const doc = exampleApplication();
    (doc.englishLanguage as any) = { howRequirementIsMet: "approved-english-test" };
    (doc.travelHistory as any).hasBeenDeportedOrRemoved = true;
    const result = safeParseApplication(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("englishLanguage.testDetails");
      expect(paths).toContain("travelHistory.immigrationHistoryExplanation");
    }
  });

  it("rejects non-ISO dates and lower-case country codes", () => {
    const doc = exampleApplication();
    (doc.applicant as any).dateOfBirth = "14/07/1991";
    (doc.applicant as any).nationality = "in";
    const result = safeParseApplication(doc);
    expect(result.success).toBe(false);
  });
});
