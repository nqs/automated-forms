import { z } from "zod";

/** ISO 8601 calendar date, e.g. 1990-04-23. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date in the form YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Not a real calendar date")
  .describe("Calendar date in ISO 8601 form (YYYY-MM-DD)");

/** ISO 3166-1 alpha-2 country code. */
export const countryCode = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Expected an upper-case ISO 3166-1 alpha-2 country code")
  .describe("ISO 3166-1 alpha-2 country code, e.g. IN, US, NG");

export const yesNo = z.boolean();

export const address = z
  .object({
    line1: z.string().min(1).describe("First line of the address"),
    line2: z.string().optional(),
    line3: z.string().optional(),
    townOrCity: z.string().min(1),
    provinceOrState: z.string().optional(),
    postalCode: z.string().optional(),
    country: countryCode,
  })
  .describe("Postal address");

export type Address = z.infer<typeof address>;

export const personName = z.object({
  givenNames: z.string().min(1).describe("Given name(s) exactly as shown in the passport"),
  familyName: z.string().min(1).describe("Family name exactly as shown in the passport"),
});

export const moneyGbp = z
  .number()
  .nonnegative()
  .describe("Amount in pounds sterling (GBP), no currency symbol");
