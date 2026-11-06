import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { countryName, formatMoney } from "../engine/format.js";
import { addressFields } from "./helpers.js";

const ENGLISH_LABELS: Record<string, string> = {
  "national-of-majority-english-speaking-country": "I am a national of a majority English speaking country",
  "degree-taught-in-english": "I have a degree that was taught or researched in English",
  "approved-english-test": "I have passed an approved English language test",
  "gcse-a-level-or-scottish-qualification": "I have a GCSE, A level or Scottish qualification in English",
  "already-proven-in-previous-application": "I met the requirement in a previous application",
  exempt: "I am exempt",
};

export const requirementSteps: FormStep[] = [
  {
    id: "english-language",
    title: "English language requirement",
    match: [/english language|knowledge of english|meet the english|english (test|requirement|qualification)/i],
    fields: (ctx) => {
      const e = ctx.app.englishLanguage;
      const fields: FieldIntent[] = [
        { kind: "radio", label: "How do you meet the English language requirement?", aliases: ["English language requirement"], value: ENGLISH_LABELS[e.howRequirementIsMet]!, source: "/englishLanguage/howRequirementIsMet" },
      ];
      if (e.testDetails) {
        const t = e.testDetails;
        fields.push(
          { kind: "text", label: "Test provider", aliases: ["Who provided the test?", "Provider"], value: t.provider, source: "/englishLanguage/testDetails/provider" },
          { kind: "text", label: "Test name", aliases: ["Name of the test", "Qualification"], value: t.testName, source: "/englishLanguage/testDetails/testName" },
          { kind: "text", label: "Unique reference number", aliases: ["URN", "Test reference number", "Certificate number"], value: t.uniqueReferenceNumber, source: "/englishLanguage/testDetails/uniqueReferenceNumber" },
          { kind: "date", label: "Test date", aliases: ["Date of test", "When did you take the test?"], value: t.testDate, source: "/englishLanguage/testDetails/testDate" },
          { kind: "radio", label: "Level achieved", aliases: ["CEFR level"], value: t.cefrLevel, source: "/englishLanguage/testDetails/cefrLevel" },
        );
      }
      if (e.degreeDetails) {
        const d = e.degreeDetails;
        fields.push(
          { kind: "text", label: "Qualification", aliases: ["Degree title", "Name of qualification"], value: d.qualification, source: "/englishLanguage/degreeDetails/qualification" },
          { kind: "text", label: "Awarding institution", aliases: ["University", "Institution"], value: d.awardingInstitution, source: "/englishLanguage/degreeDetails/awardingInstitution" },
          { kind: "select", label: "Country of study", aliases: ["Country where you studied"], value: countryName(d.countryOfStudy), source: "/englishLanguage/degreeDetails/countryOfStudy" },
          { kind: "date", label: "Date the qualification was awarded", aliases: ["Completion date", "Award date"], value: d.completionDate, source: "/englishLanguage/degreeDetails/completionDate" },
        );
        if (d.ecctisReferenceNumber) fields.push({ kind: "text", label: "Ecctis reference number", aliases: ["UK NARIC reference", "Ecctis"], value: d.ecctisReferenceNumber, source: "/englishLanguage/degreeDetails/ecctisReferenceNumber" });
      }
      if (e.exemptionReason) fields.push({ kind: "textarea", label: "Why are you exempt?", aliases: ["Exemption reason"], value: e.exemptionReason, source: "/englishLanguage/exemptionReason" });
      return fields;
    },
  },
  {
    id: "maintenance-funds",
    title: "Maintenance funds",
    match: [/maintenance|funds|money to support|financial (requirement|support)|support yourself|public funds|savings/i],
    fields: (ctx) => {
      const f = ctx.app.finances;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Has your sponsor certified that they will maintain and accommodate you?", aliases: ["Sponsor certifies maintenance", "Maintenance certified on your Certificate of Sponsorship"], value: f.sponsorCertifiesMaintenance, source: "/finances/sponsorCertifiesMaintenance" },
      ];
      if (!f.sponsorCertifiesMaintenance && f.hasHeldRequiredFundsFor28Days !== undefined) {
        fields.push({ kind: "yesno", label: "Have you held the required funds for at least 28 consecutive days?", aliases: ["Held funds for 28 days"], value: f.hasHeldRequiredFundsFor28Days, source: "/finances/hasHeldRequiredFundsFor28Days" });
      }
      if (f.availableFundsGbp !== undefined) fields.push({ kind: "text", label: "How much money do you have available?", aliases: ["Available funds", "Amount in pounds"], value: formatMoney(f.availableFundsGbp), source: "/finances/availableFundsGbp" });
      fields.push({ kind: "yesno", label: "Will you be relying on public funds?", aliases: ["Public funds"], value: f.willBeRelyingOnPublicFunds, source: "/finances/willBeRelyingOnPublicFunds" });
      return fields;
    },
  },
  {
    id: "tuberculosis",
    title: "Tuberculosis test",
    match: [/tuberculosis|\btb\b/i],
    fields: (ctx) => {
      const h = ctx.app.health;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Have you had a tuberculosis test?", aliases: ["TB test certificate"], value: h.tuberculosisTestRequired && Boolean(h.tuberculosisCertificateNumber), source: "/health/tuberculosisTestRequired" },
      ];
      if (h.tuberculosisCertificateNumber) fields.push({ kind: "text", label: "Tuberculosis certificate number", aliases: ["TB certificate number"], value: h.tuberculosisCertificateNumber, source: "/health/tuberculosisCertificateNumber" });
      if (h.tuberculosisTestDate) fields.push({ kind: "date", label: "Date of the test", aliases: ["Test date"], value: h.tuberculosisTestDate, source: "/health/tuberculosisTestDate" });
      return fields;
    },
  },
  {
    id: "immigration-health-surcharge",
    title: "Immigration Health Surcharge",
    match: [/immigration health surcharge|\bihs\b|health surcharge/i],
    run: async (ctx) => {
      const h = ctx.app.health;
      if (h.immigrationHealthSurchargeReference) ctx.state.references.ihs = h.immigrationHealthSurchargeReference;
      const actions = await ctx.driver.observe('the text input for the Immigration Health Surcharge (IHS) reference number');
      if (h.immigrationHealthSurchargeReference && actions[0]) {
        await ctx.driver.fill(actions[0].selector, h.immigrationHealthSurchargeReference);
        return true;
      }
      if (!h.hasPaidImmigrationHealthSurcharge) {
        ctx.state.warnings.push("The Immigration Health Surcharge has not been paid; the form will require payment before submission");
      }
      return true;
    },
  },
  {
    id: "travel-plans",
    title: "Travel plans",
    match: [/when (do you|will you|are you) (plan|intend|want|going) to (travel|arrive|come)|intended date of (travel|arrival)|date (you|of) (plan|intend|arrival)|travel date|length of (your )?stay|how long (do you|will you).*(stay|uk)/i],
    fields: (ctx) => {
      const v = ctx.app.visa;
      return [
        { kind: "date", label: "When do you plan to arrive in the UK?", aliases: ["Intended date of travel", "Date of travel", "Arrival date"], value: v.intendedDateOfTravel, source: "/visa/intendedDateOfTravel" },
        { kind: "text", label: "How long do you plan to stay in the UK?", aliases: ["Length of stay in months", "Months"], value: String(v.lengthOfStayMonths), source: "/visa/lengthOfStayMonths" },
      ];
    },
  },
  {
    id: "uk-address-question",
    title: "Where will you live in the UK?",
    match: [/where will you (live|stay|be living) (in the uk|when you arrive)|uk address|address in the uk|accommodation/i],
    fields: (ctx) => {
      const v = ctx.app.visa;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Do you have an address in the UK where you will be living?", aliases: ["Do you know where you will live in the UK?"], value: v.hasUkAddressToLiveAt, source: "/visa/hasUkAddressToLiveAt" },
      ];
      if (v.hasUkAddressToLiveAt && v.ukAddress) fields.push(...addressFields("uk", "/visa/ukAddress", v.ukAddress, "UK"));
      return fields;
    },
  },
  {
    id: "service-level",
    title: "Priority service",
    match: [/priority (service|visa)|faster decision|how quickly|service level|processing time/i],
    fields: (ctx) => [
      {
        kind: "radio",
        label: "Which service do you want?",
        aliases: ["Priority service"],
        value: ctx.app.visa.priorityService === "standard" ? "Standard" : ctx.app.visa.priorityService === "priority" ? "Priority" : "Super priority",
        source: "/visa/priorityService",
      },
    ],
  },
  {
    id: "biometrics-info",
    title: "Biometrics and visa application centre",
    kind: "info",
    match: [/biometric|visa application centre|fingerprints|appointment|identity (check|verification)|id check app/i],
    fields: (ctx) =>
      ctx.app.visa.biometricsLocationPreference
        ? [{ kind: "select", label: "Visa application centre", aliases: ["Choose a location", "City"], value: ctx.app.visa.biometricsLocationPreference, source: "/visa/biometricsLocationPreference" }]
        : [],
  },
];
