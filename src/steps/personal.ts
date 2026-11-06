import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { countryName, titleCase } from "../engine/format.js";

const RELATIONSHIP_LABELS: Record<string, string> = {
  single: "Single",
  married: "Married",
  "civil-partnership": "Civil partnership",
  "unmarried-partner": "Unmarried partner",
  divorced: "Divorced",
  "dissolved-civil-partnership": "Dissolved civil partnership",
  separated: "Separated",
  widowed: "Widowed",
};

export const personalSteps: FormStep[] = [
  {
    id: "name",
    title: "Your name",
    match: [/^(what is )?your (full )?name\??$|enter your name|name as (shown|it appears) (in|on) your passport|given name/i],
    fields: (ctx) => [
      { kind: "text", label: "Given name(s)", aliases: ["Given names", "First names", "Forenames", "Given name"], value: ctx.app.applicant.name.givenNames, source: "/applicant/name/givenNames" },
      { kind: "text", label: "Family name", aliases: ["Surname", "Last name"], value: ctx.app.applicant.name.familyName, source: "/applicant/name/familyName" },
    ],
  },
  {
    id: "other-names-question",
    title: "Have you ever been known by any other names?",
    match: [/known by (any )?other names|any other names|used (any )?other names|previous names/i],
    when: (ctx) => !/enter|details|which other name/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Have you ever been known by any other names?", value: ctx.app.applicant.hasOtherNames, source: "/applicant/hasOtherNames" },
    ],
  },
  {
    id: "other-name-details",
    title: "Other name details",
    match: [/(enter|details of|which) (your )?other name|other name details|name you have (used|been known by)/i],
    repeatGroup: "otherNames",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.otherNames ?? 0;
      const other = ctx.app.applicant.otherNames[i];
      if (!other) return [];
      return [
        { kind: "text", label: "Other name", aliases: ["Full name", "Name"], value: other.name, source: `/applicant/otherNames/${i}/name` },
        { kind: "textarea", label: "Why did you use this name?", aliases: ["Reason", "Type of name"], value: other.reason, source: `/applicant/otherNames/${i}/reason` },
      ];
    },
  },
  {
    id: "sex",
    title: "What is your sex?",
    match: [/what is your sex|your sex|^sex$|gender/i],
    fields: (ctx) => [
      {
        kind: "radio",
        label: "What is your sex, as shown in your passport?",
        aliases: ["Sex", "Gender"],
        value: ctx.app.applicant.sex === "unspecified" ? "Unspecified" : titleCase(ctx.app.applicant.sex),
        source: "/applicant/sex",
      },
    ],
  },
  {
    id: "relationship-status",
    title: "What is your relationship status?",
    match: [/relationship status|marital status/i],
    fields: (ctx) => [
      {
        kind: "radio",
        label: "What is your relationship status?",
        aliases: ["Marital status"],
        value: RELATIONSHIP_LABELS[ctx.app.applicant.relationshipStatus] ?? titleCase(ctx.app.applicant.relationshipStatus),
        source: "/applicant/relationshipStatus",
      },
    ],
  },
  {
    id: "date-of-birth",
    title: "Date of birth",
    match: [/date of birth|when were you born/i],
    when: (ctx) => !/(mother|father|partner|child|parent)/i.test(ctx.page.heading),
    fields: (ctx) => [{ kind: "date", label: "Date of birth", aliases: ["When were you born?"], value: ctx.app.applicant.dateOfBirth, source: "/applicant/dateOfBirth" }],
  },
  {
    id: "place-of-birth",
    title: "Place of birth",
    match: [/where were you born|place of birth|country of birth/i],
    fields: (ctx) => [
      { kind: "text", label: "Place of birth", aliases: ["Town or city of birth", "Town of birth", "City of birth"], value: ctx.app.applicant.placeOfBirth, source: "/applicant/placeOfBirth" },
      { kind: "select", label: "Country of birth", aliases: ["Country"], value: countryName(ctx.app.applicant.countryOfBirth), source: "/applicant/countryOfBirth" },
    ],
  },
  {
    id: "other-nationalities-question",
    title: "Do you hold any other nationalities?",
    match: [/other (nationalit(y|ies)|citizenship)|dual national|more than one nationality/i],
    when: (ctx) => !/enter|details|which/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Do you currently hold, or have you ever held, any other nationality or citizenship?", aliases: ["Other nationalities"], value: ctx.app.applicant.hasOtherNationalities, source: "/applicant/hasOtherNationalities" },
    ],
  },
  {
    id: "other-nationality-details",
    title: "Other nationality details",
    match: [/(enter|details of|which) other nationalit|other nationality details/i],
    repeatGroup: "otherNationalities",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.otherNationalities ?? 0;
      const n = ctx.app.applicant.otherNationalities[i];
      if (!n) return [];
      const fields: FieldIntent[] = [
        { kind: "select", label: "Country of nationality", aliases: ["Nationality", "Country"], value: countryName(n.country), source: `/applicant/otherNationalities/${i}/country` },
      ];
      if (n.heldSince) fields.push({ kind: "date", label: "Date you acquired this nationality", aliases: ["Held since", "From"], value: n.heldSince, source: `/applicant/otherNationalities/${i}/heldSince` });
      if (n.howAcquired) fields.push({ kind: "radio", label: "How did you acquire this nationality?", value: titleCase(n.howAcquired), source: `/applicant/otherNationalities/${i}/howAcquired` });
      return fields;
    },
  },
  {
    id: "passport-details",
    title: "Your passport",
    match: [/passport (details|number|information)|about your passport|your (current )?passport|travel document/i],
    when: (ctx) => !/do you have a (current|valid) passport/i.test(ctx.page.heading),
    fields: (ctx) => {
      const p = ctx.app.applicant.passport;
      return [
        { kind: "text", label: "Passport number", aliases: ["Travel document number"], value: p.number, source: "/applicant/passport/number" },
        { kind: "text", label: "Issuing authority", aliases: ["Place of issue", "Issued by"], value: p.issuingAuthority, source: "/applicant/passport/issuingAuthority" },
        { kind: "date", label: "Issue date", aliases: ["Date of issue"], value: p.issueDate, source: "/applicant/passport/issueDate" },
        { kind: "date", label: "Expiry date", aliases: ["Date of expiry", "Expires"], value: p.expiryDate, source: "/applicant/passport/expiryDate" },
        { kind: "select", label: "Country of issue", aliases: ["Issuing country"], value: countryName(p.countryOfIssue), source: "/applicant/passport/countryOfIssue" },
        { kind: "yesno", label: "Is this a biometric passport?", aliases: ["Biometric passport"], value: p.isBiometric, source: "/applicant/passport/isBiometric" },
      ];
    },
  },
  {
    id: "national-identity-card-question",
    title: "Do you have a national identity card?",
    match: [/national identity (card|number)|identity card/i],
    when: (ctx) => !/enter|details/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Do you have a valid national identity card?", value: Boolean(ctx.app.applicant.nationalIdentityCard), source: "/applicant/nationalIdentityCard" },
    ],
  },
  {
    id: "national-identity-card-details",
    title: "National identity card details",
    match: [/(enter|details of) (your )?(national )?identity card/i],
    fields: (ctx) => {
      const card = ctx.app.applicant.nationalIdentityCard;
      if (!card) return [];
      const fields: FieldIntent[] = [
        { kind: "text", label: "Identity card number", value: card.number, source: "/applicant/nationalIdentityCard/number" },
        { kind: "text", label: "Issuing authority", value: card.issuingAuthority, source: "/applicant/nationalIdentityCard/issuingAuthority" },
        { kind: "date", label: "Issue date", value: card.issueDate, source: "/applicant/nationalIdentityCard/issueDate" },
      ];
      if (card.expiryDate) fields.push({ kind: "date", label: "Expiry date", value: card.expiryDate, source: "/applicant/nationalIdentityCard/expiryDate" });
      return fields;
    },
  },
];
