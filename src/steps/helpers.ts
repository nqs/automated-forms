import type { Address } from "../schema/common.js";
import type { FieldIntent } from "../engine/fields.js";
import { countryName } from "../engine/format.js";

/** Field intents for a GOV.UK style address block. */
export function addressFields(prefix: string, source: string, a: Address, labelPrefix = ""): FieldIntent[] {
  const l = (s: string) => (labelPrefix ? `${labelPrefix} ${s}` : s);
  const fields: FieldIntent[] = [
    { kind: "text", label: l("Address line 1"), aliases: ["Building and street", "Street address", "Address 1"], value: a.line1, source: `${source}/line1` },
  ];
  if (a.line2) fields.push({ kind: "text", label: l("Address line 2"), aliases: ["Address 2"], value: a.line2, source: `${source}/line2` });
  if (a.line3) fields.push({ kind: "text", label: l("Address line 3"), aliases: ["Address 3"], value: a.line3, source: `${source}/line3` });
  fields.push({ kind: "text", label: l("Town or city"), aliases: ["Town/City", "City"], value: a.townOrCity, source: `${source}/townOrCity` });
  if (a.provinceOrState) fields.push({ kind: "text", label: l("Province, region or state"), aliases: ["County", "State", "Region"], value: a.provinceOrState, source: `${source}/provinceOrState` });
  if (a.postalCode) fields.push({ kind: "text", label: l("Postal code"), aliases: ["Postcode", "ZIP code", "Zip"], value: a.postalCode, source: `${source}/postalCode` });
  fields.push({ kind: "select", label: l("Country"), aliases: ["Country or territory"], value: countryName(a.country), source: `${source}/country` });
  void prefix;
  return fields;
}

export const CONTINUE = /^(continue|save and continue|next|save and return later|confirm and continue)$/i;
