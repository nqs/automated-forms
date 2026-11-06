const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

const COUNTRY_OVERRIDES: Record<string, string> = {
  GB: "United Kingdom",
  US: "United States",
  KR: "South Korea",
  KP: "North Korea",
  CZ: "Czech Republic",
  TR: "Turkey",
  MM: "Myanmar (Burma)",
  CI: "Ivory Coast",
  VA: "Vatican City",
  FM: "Micronesia",
  PS: "Occupied Palestinian Territories",
  CD: "Congo (Democratic Republic)",
  CG: "Congo",
  HK: "Hong Kong",
  MO: "Macao",
  TW: "Taiwan",
};

/** ISO alpha-2 code to the country name used in Home Office drop-downs. */
export function countryName(code: string): string {
  const upper = code.toUpperCase();
  return COUNTRY_OVERRIDES[upper] ?? regionNames.of(upper) ?? upper;
}

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

/** Split an ISO date into the Day / Month / Year parts GOV.UK date inputs expect (no leading zeros). */
export function dateParts(iso: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not an ISO date: ${iso}`);
  const [, year, month, day] = match;
  return { day: String(Number(day)), month: String(Number(month)), year: year! };
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatMoney(gbp: number): string {
  return Number.isInteger(gbp) ? String(gbp) : gbp.toFixed(2);
}
