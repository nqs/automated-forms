import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { countryName } from "../engine/format.js";
import { addressFields } from "./helpers.js";

export const historySteps: FormStep[] = [
  {
    id: "previous-addresses-question",
    title: "Have you lived at any other addresses?",
    match: [/other address|previous address|lived (anywhere else|at any other)/i],
    when: (ctx) => !/enter|details/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Have you lived at any other addresses in the last 10 years?", value: ctx.app.travelHistory.previousUkAddresses.length > 0, source: "/travelHistory/previousUkAddresses" },
    ],
  },
  {
    id: "previous-address-details",
    title: "Previous address",
    match: [/(enter|details of) (your )?previous address/i],
    repeatGroup: "previousAddresses",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.previousAddresses ?? 0;
      const prev = ctx.app.travelHistory.previousUkAddresses[i];
      if (!prev) return [];
      const src = `/travelHistory/previousUkAddresses/${i}`;
      return [
        ...addressFields("prev", `${src}/address`, prev.address),
        { kind: "date", label: "When did you start living at this address?", aliases: ["From"], value: prev.from, source: `${src}/from` },
        { kind: "date", label: "When did you stop living at this address?", aliases: ["To"], value: prev.to, source: `${src}/to` },
      ];
    },
  },
  {
    id: "uk-travel-question",
    title: "Have you been to the UK in the last 10 years?",
    match: [/been to the uk|visited the uk|travelled to the uk|travel history.*uk|uk travel history/i],
    when: (ctx) => !/enter|details|when did you/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Have you been to the UK in the last 10 years?", value: ctx.app.travelHistory.hasVisitedUkInLast10Years, source: "/travelHistory/hasVisitedUkInLast10Years" },
    ],
  },
  {
    id: "uk-visit-details",
    title: "UK visit details",
    match: [/(enter|details of|about) (your |a |the )?(uk )?visit|when did you (visit|travel to|arrive in) the uk|uk visit details/i],
    repeatGroup: "ukVisits",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.ukVisits ?? 0;
      const v = ctx.app.travelHistory.ukVisits[i];
      if (!v) return [];
      const src = `/travelHistory/ukVisits/${i}`;
      return [
        { kind: "text", label: "Reason for visit", aliases: ["Purpose of visit", "Why did you visit the UK?"], value: v.reason, source: `${src}/reason` },
        { kind: "date", label: "Date you arrived in the UK", aliases: ["Arrival date", "From"], value: v.arrivalDate, source: `${src}/arrivalDate` },
        { kind: "date", label: "Date you left the UK", aliases: ["Departure date", "To"], value: v.departureDate, source: `${src}/departureDate` },
      ];
    },
  },
  {
    id: "previous-uk-visa-question",
    title: "Have you been issued a UK visa before?",
    match: [/issued (a |any )?(uk )?visa|held a (uk )?visa|previous (uk )?visa|applied for a uk visa before|uk immigration status before/i],
    when: (ctx) => !/refused|enter|details/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Have you been issued a UK visa before?", value: ctx.app.travelHistory.hasBeenIssuedUkVisaBefore, source: "/travelHistory/hasBeenIssuedUkVisaBefore" },
    ],
  },
  {
    id: "previous-uk-visa-details",
    title: "Previous UK visa details",
    match: [/(enter|details of) (your )?previous (uk )?visa/i],
    repeatGroup: "previousUkVisas",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.previousUkVisas ?? 0;
      const v = ctx.app.travelHistory.previousUkVisaDetails[i];
      if (!v) return [];
      const src = `/travelHistory/previousUkVisaDetails/${i}`;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Type of visa", aliases: ["Visa type", "Immigration route"], value: v.type, source: `${src}/type` },
        { kind: "date", label: "Date the visa was issued", aliases: ["Issue date"], value: v.issueDate, source: `${src}/issueDate` },
      ];
      if (v.referenceNumber) fields.push({ kind: "text", label: "Visa reference number", aliases: ["Reference"], value: v.referenceNumber, source: `${src}/referenceNumber` });
      return fields;
    },
  },
  {
    id: "national-insurance",
    title: "National Insurance number",
    match: [/national insurance/i],
    fields: (ctx) => {
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Do you have a UK National Insurance number?", value: ctx.app.travelHistory.hasUkNationalInsuranceNumber, source: "/travelHistory/hasUkNationalInsuranceNumber" },
      ];
      if (ctx.app.travelHistory.hasUkNationalInsuranceNumber && ctx.app.travelHistory.nationalInsuranceNumber) {
        fields.push({ kind: "text", label: "National Insurance number", value: ctx.app.travelHistory.nationalInsuranceNumber, source: "/travelHistory/nationalInsuranceNumber" });
      }
      return fields;
    },
  },
  {
    id: "other-countries-question",
    title: "Have you travelled to any other countries?",
    match: [/other countries|travelled (anywhere|to any other)|world travel|countries you have (visited|travelled)|travel history/i],
    when: (ctx) => !/uk/i.test(ctx.page.heading) && !/enter|details|which country/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Have you travelled to any other countries in the last 10 years?", value: ctx.app.travelHistory.hasVisitedOtherCountriesInLast10Years, source: "/travelHistory/hasVisitedOtherCountriesInLast10Years" },
    ],
  },
  {
    id: "other-country-visit-details",
    title: "Travel details",
    match: [/(enter|details of|which) (country|countries) (you |have you )?(visited|travelled)|travel details|trip details/i],
    repeatGroup: "otherCountryVisits",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.otherCountryVisits ?? 0;
      const v = ctx.app.travelHistory.otherCountryVisits[i];
      if (!v) return [];
      const src = `/travelHistory/otherCountryVisits/${i}`;
      return [
        { kind: "select", label: "Country", aliases: ["Which country did you visit?"], value: countryName(v.country), source: `${src}/country` },
        { kind: "text", label: "Reason for visit", aliases: ["Purpose"], value: v.reason, source: `${src}/reason` },
        { kind: "date", label: "Date you arrived", aliases: ["Arrival date", "From"], value: v.arrivalDate, source: `${src}/arrivalDate` },
        { kind: "date", label: "Date you left", aliases: ["Departure date", "To"], value: v.departureDate, source: `${src}/departureDate` },
      ];
    },
  },
  {
    id: "immigration-history",
    title: "Immigration history",
    match: [/refused (a |an )?(visa|entry)|refused (permission|leave)|deported|removed from|required to leave|overstay|breach(ed)? (the )?(conditions|immigration)|immigration (history|offences|law)|been (refused|removed|deported)/i],
    fields: (ctx) => {
      const h = ctx.app.travelHistory;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Have you ever been refused a visa for the UK?", aliases: ["Refused a UK visa"], value: h.hasAppliedForUkVisaAndBeenRefused, source: "/travelHistory/hasAppliedForUkVisaAndBeenRefused" },
        { kind: "yesno", label: "Have you ever been refused a visa for any other country?", aliases: ["Refused a visa for another country"], value: h.hasBeenRefusedVisaForAnyCountry, source: "/travelHistory/hasBeenRefusedVisaForAnyCountry" },
        { kind: "yesno", label: "Have you ever been refused entry at the border to the UK or any other country?", aliases: ["Refused entry"], value: h.hasBeenRefusedEntryToAnyCountry, source: "/travelHistory/hasBeenRefusedEntryToAnyCountry" },
        { kind: "yesno", label: "Have you ever been deported, removed or otherwise required to leave any country?", aliases: ["Deported or removed"], value: h.hasBeenDeportedOrRemoved, source: "/travelHistory/hasBeenDeportedOrRemoved" },
        { kind: "yesno", label: "Have you ever overstayed or breached the conditions of a visa?", aliases: ["Breached immigration law", "Overstayed"], value: h.hasOverstayedOrBreachedConditions, source: "/travelHistory/hasOverstayedOrBreachedConditions" },
      ];
      if (h.immigrationHistoryExplanation) {
        fields.push({ kind: "textarea", label: "Provide details", aliases: ["Give details", "Explain"], value: h.immigrationHistoryExplanation, source: "/travelHistory/immigrationHistoryExplanation" });
      }
      return fields;
    },
  },
  {
    id: "character-and-conduct",
    title: "Convictions and other penalties",
    match: [/conviction|criminal|offence|prosecution|war crimes|genocide|terroris|extremis|organised crime|good character|security (or|and) intelligence|armed forces|anything else (you|to) (would like to )?(tell|declare)|other information/i],
    fields: (ctx) => {
      const c = ctx.app.characterAndConduct;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Have you ever had a criminal conviction, including traffic offences?", aliases: ["Criminal convictions"], value: c.hasCriminalConvictions, source: "/characterAndConduct/hasCriminalConvictions" },
        { kind: "yesno", label: "Are there any pending prosecutions against you?", aliases: ["Pending prosecutions"], value: c.hasPendingProsecutions, source: "/characterAndConduct/hasPendingProsecutions" },
        { kind: "yesno", label: "Have you ever been involved in, supported or encouraged war crimes, crimes against humanity or genocide?", aliases: ["War crimes"], value: c.hasBeenInvolvedInWarCrimes, source: "/characterAndConduct/hasBeenInvolvedInWarCrimes" },
        { kind: "yesno", label: "Have you ever been involved in, supported or encouraged terrorist activities?", aliases: ["Terrorism"], value: c.hasBeenInvolvedInTerrorism, source: "/characterAndConduct/hasBeenInvolvedInTerrorism" },
        { kind: "yesno", label: "Have you ever expressed views that justify or glorify terrorist violence or that may encourage others to commit terrorist or other serious criminal acts?", aliases: ["Extremist views"], value: c.hasExpressedExtremistViews, source: "/characterAndConduct/hasExpressedExtremistViews" },
        { kind: "yesno", label: "Have you ever been involved in organised crime?", aliases: ["Organised crime"], value: c.hasBeenInvolvedInOrganisedCrime, source: "/characterAndConduct/hasBeenInvolvedInOrganisedCrime" },
        { kind: "yesno", label: "Have you ever worked for the security, intelligence or armed forces of any country?", aliases: ["Security or intelligence services"], value: c.hasWorkedForSecurityOrIntelligenceServices, source: "/characterAndConduct/hasWorkedForSecurityOrIntelligenceServices" },
        { kind: "yesno", label: "Is there any other information you would like us to know?", aliases: ["Anything else to declare"], value: c.hasOtherInformationToDeclare, source: "/characterAndConduct/hasOtherInformationToDeclare" },
      ];
      if (c.explanation) fields.push({ kind: "textarea", label: "Provide details", aliases: ["Give details", "Explain"], value: c.explanation, source: "/characterAndConduct/explanation" });
      return fields;
    },
  },
  {
    id: "conviction-details",
    title: "Conviction details",
    match: [/(enter|details of) (your |the )?(conviction|offence)/i],
    repeatGroup: "convictions",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.convictions ?? 0;
      const conv = ctx.app.characterAndConduct.convictions[i];
      if (!conv) return [];
      const src = `/characterAndConduct/convictions/${i}`;
      return [
        { kind: "textarea", label: "Offence", aliases: ["What was the offence?"], value: conv.offence, source: `${src}/offence` },
        { kind: "select", label: "Country", value: countryName(conv.country), source: `${src}/country` },
        { kind: "date", label: "Date of conviction", value: conv.date, source: `${src}/date` },
        { kind: "textarea", label: "Sentence", aliases: ["Penalty"], value: conv.sentence, source: `${src}/sentence` },
        { kind: "yesno", label: "Is this conviction spent?", value: conv.isSpent, source: `${src}/isSpent` },
      ];
    },
  },
];
