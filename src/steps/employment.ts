import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { formatMoney } from "../engine/format.js";
import { addressFields } from "./helpers.js";

export const employmentSteps: FormStep[] = [
  {
    id: "certificate-of-sponsorship",
    title: "Certificate of Sponsorship",
    match: [/certificate of sponsorship|\bcos\b|sponsorship (reference|number|certificate)/i],
    fields: (ctx) => {
      const cos = ctx.app.sponsorAndJob.certificateOfSponsorship;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Certificate of Sponsorship reference number", aliases: ["CoS reference number", "Sponsorship reference"], value: cos.referenceNumber, source: "/sponsorAndJob/certificateOfSponsorship/referenceNumber" },
      ];
      if (cos.issueDate) fields.push({ kind: "date", label: "Date the certificate was issued", aliases: ["CoS issue date"], value: cos.issueDate, source: "/sponsorAndJob/certificateOfSponsorship/issueDate" });
      return fields;
    },
  },
  {
    id: "sponsor-details",
    title: "Your sponsor",
    match: [/sponsor.?s? (name|details|address|licence)|about your sponsor|your (sponsor|employer)|employer.?s details|who is your sponsor/i],
    when: (ctx) => !/certificate of sponsorship/i.test(ctx.page.heading),
    fields: (ctx) => {
      const s = ctx.app.sponsorAndJob.sponsor;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Sponsor name", aliases: ["Employer name", "Name of your sponsor", "Organisation name"], value: s.name, source: "/sponsorAndJob/sponsor/name" },
        { kind: "text", label: "Sponsor licence number", aliases: ["Licence number"], value: s.licenceNumber, source: "/sponsorAndJob/sponsor/licenceNumber" },
        ...addressFields("sponsor", "/sponsorAndJob/sponsor/address", s.address, "Sponsor"),
      ];
      if (s.contactName) fields.push({ kind: "text", label: "Sponsor contact name", aliases: ["Contact name"], value: s.contactName, source: "/sponsorAndJob/sponsor/contactName" });
      if (s.contactTelephone) fields.push({ kind: "text", label: "Sponsor telephone number", aliases: ["Contact telephone"], value: s.contactTelephone, source: "/sponsorAndJob/sponsor/contactTelephone" });
      if (s.contactEmail) fields.push({ kind: "text", label: "Sponsor email address", aliases: ["Contact email"], value: s.contactEmail, source: "/sponsorAndJob/sponsor/contactEmail" });
      return fields;
    },
  },
  {
    id: "job-details",
    title: "Your job",
    match: [/^(your |the |about your |about the )?job( details| title)?$|job (title|details)|about (your|the) job|your (employment|occupation|role)|occupation code|soc code|standard occupational/i],
    fields: (ctx) => {
      const j = ctx.app.sponsorAndJob.job;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Job title", aliases: ["Your job title", "Role"], value: j.title, source: "/sponsorAndJob/job/title" },
        { kind: "text", label: "Occupation code", aliases: ["SOC code", "Standard Occupational Classification code"], value: j.socCode, source: "/sponsorAndJob/job/socCode" },
        { kind: "date", label: "Job start date", aliases: ["When will you start this job?", "Start date"], value: j.startDate, source: "/sponsorAndJob/job/startDate" },
      ];
      if (j.description) fields.push({ kind: "textarea", label: "Job description", aliases: ["Summary of the job", "Duties"], value: j.description, source: "/sponsorAndJob/job/description" });
      if (j.endDate) fields.push({ kind: "date", label: "Job end date", aliases: ["End date"], value: j.endDate, source: "/sponsorAndJob/job/endDate" });
      return fields;
    },
  },
  {
    id: "salary",
    title: "Salary",
    match: [/salary|how much will you be paid|pay|earnings|hours (per|a) week|working hours/i],
    when: (ctx) => !/surcharge|fee|payment/i.test(ctx.page.heading),
    fields: (ctx) => {
      const j = ctx.app.sponsorAndJob.job;
      return [
        { kind: "text", label: "Gross annual salary", aliases: ["Annual salary (before tax)", "Salary in pounds", "How much will you be paid each year?"], value: formatMoney(j.grossAnnualSalaryGbp), source: "/sponsorAndJob/job/grossAnnualSalaryGbp" },
        { kind: "text", label: "Hours per week", aliases: ["Weekly hours", "How many hours a week will you work?"], value: String(j.hoursPerWeek), source: "/sponsorAndJob/job/hoursPerWeek" },
        { kind: "yesno", label: "Is the job on the Immigration Salary List?", aliases: ["Shortage occupation", "Immigration Salary List"], value: j.isOnImmigrationSalaryList, source: "/sponsorAndJob/job/isOnImmigrationSalaryList" },
        { kind: "yesno", label: "Are you a new entrant to the labour market?", aliases: ["New entrant"], value: j.isNewEntrant, source: "/sponsorAndJob/job/isNewEntrant" },
        { kind: "yesno", label: "Does the job require a PhD?", aliases: ["PhD requirement"], value: j.requiresPhd, source: "/sponsorAndJob/job/requiresPhd" },
      ];
    },
  },
  {
    id: "work-address",
    title: "Where will you work?",
    match: [/where will you (work|be working)|work address|place of work|work location/i],
    fields: (ctx) => {
      const j = ctx.app.sponsorAndJob.job;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Will you work at your sponsor's address?", aliases: ["Same as sponsor address"], value: j.workAddressIsSponsorAddress, source: "/sponsorAndJob/job/workAddressIsSponsorAddress" },
      ];
      if (!j.workAddressIsSponsorAddress && j.workAddress) fields.push(...addressFields("work", "/sponsorAndJob/job/workAddress", j.workAddress, "Work"));
      return fields;
    },
  },
  {
    id: "health-and-care",
    title: "Health and Care Worker",
    match: [/health and care|nhs|care worker/i],
    fields: (ctx) => [
      { kind: "yesno", label: "Are you applying as a Health and Care Worker?", value: ctx.app.sponsorAndJob.job.isHealthOrCareWorker, source: "/sponsorAndJob/job/isHealthOrCareWorker" },
    ],
  },
  {
    id: "other-employment",
    title: "Other employment",
    match: [/other (employment|job|work)|currently (employed|working)|current (employer|employment)|additional (employment|work)/i],
    fields: (ctx) => {
      const s = ctx.app.sponsorAndJob;
      const fields: FieldIntent[] = [
        { kind: "yesno", label: "Will you have any other employment in the UK?", aliases: ["Other employment"], value: s.hasOtherEmploymentInUk, source: "/sponsorAndJob/hasOtherEmploymentInUk" },
      ];
      if (s.currentEmployment) {
        fields.push({ kind: "text", label: "Current employer name", aliases: ["Employer"], value: s.currentEmployment.employerName, source: "/sponsorAndJob/currentEmployment/employerName" });
        fields.push({ kind: "text", label: "Current job title", aliases: ["Job title"], value: s.currentEmployment.jobTitle, source: "/sponsorAndJob/currentEmployment/jobTitle" });
        fields.push({ kind: "date", label: "Current job start date", aliases: ["Start date"], value: s.currentEmployment.startDate, source: "/sponsorAndJob/currentEmployment/startDate" });
      }
      return fields;
    },
  },
];
