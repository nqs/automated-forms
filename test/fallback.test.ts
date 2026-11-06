import { describe, expect, it } from "vitest";
import { mapQuestions, similarity } from "../src/engine/fallback.js";
import { countryName, dateParts } from "../src/engine/format.js";
import { previewValue } from "../src/engine/fields.js";

describe("similarity", () => {
  it("ranks exact and contained labels highest", () => {
    expect(similarity("Given name(s)", "Given name(s)")).toBe(1);
    expect(similarity("What is your family name?", "Family name")).toBeGreaterThanOrEqual(0.9);
    expect(similarity("Passport number", "Telephone number")).toBeLessThan(0.6);
  });
});

describe("mapQuestions", () => {
  it("maps page questions to intents and reports unanswered ones", () => {
    const dictionary = [
      { stepId: "name", intent: { kind: "text" as const, label: "Given name(s)", aliases: ["First names"], value: "Asha" } },
      { stepId: "name", intent: { kind: "text" as const, label: "Family name", aliases: ["Surname"], value: "V" } },
      { stepId: "sex", intent: { kind: "radio" as const, label: "Sex", value: "Female" } },
    ];
    const { mapped, unanswered } = mapQuestions(
      [
        { label: "What are your first names?", inputType: "text", options: [], required: true },
        { label: "Surname", inputType: "text", options: [], required: true },
        { label: "What is your sex?", inputType: "select", options: ["Male", "Female"], required: true },
        { label: "Shoe size", inputType: "text", options: [], required: false },
      ],
      dictionary,
    );
    expect(mapped.map((m) => m.intent.label)).toEqual(["What are your first names?", "Surname", "What is your sex?"]);
    expect(mapped[2]!.intent.kind).toBe("select");
    expect(unanswered).toEqual(["Shoe size"]);
  });
});

describe("formatting", () => {
  it("formats countries and dates for GOV.UK inputs", () => {
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryName("IN")).toBe("India");
    expect(dateParts("1991-07-04")).toEqual({ day: "4", month: "7", year: "1991" });
  });

  it("redacts text values and hides secrets in previews", () => {
    expect(previewValue({ kind: "password", label: "Password", value: "hunter22" })).toBe("••••••••");
    expect(previewValue({ kind: "text", label: "Passport number", value: "Z8123456" })).toMatch(/^Z8•+$/);
    expect(previewValue({ kind: "yesno", label: "q", value: true })).toBe("Yes");
  });
});
