import { z } from "zod";
import { address, countryCode, isoDate, moneyGbp, personName, yesNo } from "./common.js";

/**
 * Input document for the UK Skilled Worker visa application.
 *
 * The structure follows the order in which the Home Office online form
 * (Access UK / "Apply for a UK visa") asks its questions, so the automation
 * can map one section of this document onto one group of form pages.
 */

export const applicationRoute = z
  .object({
    applyingFrom: z
      .enum(["outside-uk", "inside-uk"])
      .describe("outside-uk: entry clearance application. inside-uk: switching or extending"),
    countryOfApplication: countryCode.describe(
      "Country the applicant is physically in when applying (determines the visa application centre)",
    ),
    applicantIsMainApplicant: z.literal(true).default(true),
    hasDependantsApplying: yesNo.default(false).describe("Partner or children applying at the same time"),
  })
  .describe("Which flavour of the Skilled Worker application to start");

export const accountDetails = z
  .object({
    email: z.email().describe("Email used to create the UKVI application account and receive correspondence"),
    password: z
      .string()
      .min(8)
      .describe(
        "Password for the application account. Never logged; passed to the browser via a selector, not to the model",
      ),
    emailVerificationCode: z
      .string()
      .optional()
      .describe("One-time verification code if you already have it; otherwise supply a resolver at run time"),
    existingApplicationReference: z
      .string()
      .regex(/^GWF\d{9}$/)
      .optional()
      .describe("GWF reference of an in-progress application to resume instead of starting a new one"),
  })
  .describe("Credentials for the UKVI online account");

export const passportDetails = z
  .object({
    number: z.string().min(1),
    issuingAuthority: z.string().min(1).describe("Issuing authority or place of issue as printed in the passport"),
    issueDate: isoDate,
    expiryDate: isoDate,
    countryOfIssue: countryCode,
    isBiometric: yesNo.default(true),
  })
  .describe("Current passport used for travel");

export const nationalIdentityCard = z.object({
  number: z.string().min(1),
  issuingAuthority: z.string().min(1),
  issueDate: isoDate,
  expiryDate: isoDate.optional(),
});

export const otherName = z.object({
  name: z.string().min(1),
  reason: z.string().min(1).describe("Why the name was used, e.g. maiden name, name at birth"),
});

export const otherNationality = z.object({
  country: countryCode,
  heldSince: isoDate.optional(),
  howAcquired: z.enum(["birth", "descent", "naturalisation", "marriage", "other"]).optional(),
});

export const applicant = z
  .object({
    name: personName,
    hasOtherNames: yesNo.default(false),
    otherNames: z.array(otherName).default([]),
    sex: z.enum(["male", "female", "unspecified"]),
    relationshipStatus: z.enum([
      "single",
      "married",
      "civil-partnership",
      "unmarried-partner",
      "divorced",
      "dissolved-civil-partnership",
      "separated",
      "widowed",
    ]),
    dateOfBirth: isoDate,
    countryOfBirth: countryCode,
    placeOfBirth: z.string().min(1).describe("Town or city of birth"),
    nationality: countryCode.describe("Nationality shown on the passport used to apply"),
    hasOtherNationalities: yesNo.default(false),
    otherNationalities: z.array(otherNationality).default([]),
    nationalIdentityCard: nationalIdentityCard.optional(),
    passport: passportDetails,
  })
  .describe("Identity details of the main applicant");

export const contactDetails = z
  .object({
    telephone: z.object({
      number: z.string().min(5).describe("International format including country code, e.g. +91 98765 43210"),
      type: z.enum(["mobile", "home", "work"]).default("mobile"),
      usedIn: z.enum(["uk", "outside-uk", "both"]).default("outside-uk"),
    }),
    additionalTelephone: z
      .object({ number: z.string().min(5), type: z.enum(["mobile", "home", "work"]).default("mobile") })
      .optional(),
    canBeContactedByTelephone: yesNo.default(true),
    homeAddress: address,
    livedAtHomeAddressSince: isoDate.describe("When the applicant started living at the home address"),
    homeAddressOwnership: z.enum(["own", "rent", "other"]),
    correspondenceAddressIsHomeAddress: yesNo.default(true),
    correspondenceAddress: address.optional(),
    preferredContactMethod: z.enum(["email", "post"]).default("email"),
  })
  .describe("How the Home Office can reach the applicant");

export const previousAddress = z.object({
  address,
  from: isoDate,
  to: isoDate,
});

export const parent = z.object({
  relationship: z.enum(["mother", "father"]),
  detailsKnown: yesNo.default(true),
  name: personName.optional(),
  dateOfBirth: isoDate.optional(),
  nationality: countryCode.optional(),
  hadSameNationalityAtBirth: yesNo.optional(),
});

export const partner = z.object({
  name: personName,
  dateOfBirth: isoDate,
  nationality: countryCode,
  livesWithApplicant: yesNo,
  isApplyingToo: yesNo.default(false),
  passportNumber: z.string().optional(),
  relationshipStartDate: isoDate.optional(),
});

export const child = z.object({
  name: personName,
  dateOfBirth: isoDate,
  nationality: countryCode,
  livesWithApplicant: yesNo,
  isApplyingToo: yesNo.default(false),
  relationshipToApplicant: z.enum(["child", "step-child", "adopted-child"]).default("child"),
});

export const family = z
  .object({
    parents: z.array(parent).length(2).describe("Mother and father, even if deceased or unknown"),
    partner: partner.optional(),
    children: z.array(child).default([]),
  })
  .describe("Family members the form asks about");

export const ukVisit = z.object({
  reason: z.string().min(1).describe("e.g. tourism, business, study"),
  arrivalDate: isoDate,
  departureDate: isoDate,
});

export const travelHistory = z
  .object({
    previousUkAddresses: z.array(previousAddress).default([]),
    hasVisitedUkInLast10Years: yesNo.default(false),
    ukVisits: z.array(ukVisit).default([]),
    hasBeenIssuedUkVisaBefore: yesNo.default(false),
    previousUkVisaDetails: z
      .array(
        z.object({
          type: z.string(),
          issueDate: isoDate,
          referenceNumber: z.string().optional(),
        }),
      )
      .default([]),
    hasUkNationalInsuranceNumber: yesNo.default(false),
    nationalInsuranceNumber: z.string().optional(),
    hasVisitedOtherCountriesInLast10Years: yesNo.default(false),
    otherCountryVisits: z
      .array(
        z.object({
          country: countryCode,
          reason: z.string(),
          arrivalDate: isoDate,
          departureDate: isoDate,
        }),
      )
      .default([]),
    hasAppliedForUkVisaAndBeenRefused: yesNo.default(false),
    hasBeenRefusedVisaForAnyCountry: yesNo.default(false),
    hasBeenRefusedEntryToAnyCountry: yesNo.default(false),
    hasBeenDeportedOrRemoved: yesNo.default(false),
    hasOverstayedOrBreachedConditions: yesNo.default(false),
    immigrationHistoryExplanation: z
      .string()
      .optional()
      .describe("Required if any of the refusal/deportation/breach answers is true"),
  })
  .describe("Addresses, travel and immigration history for the last 10 years");

export const characterAndConduct = z
  .object({
    hasCriminalConvictions: yesNo.default(false),
    convictions: z
      .array(
        z.object({
          offence: z.string(),
          country: countryCode,
          date: isoDate,
          sentence: z.string(),
          isSpent: yesNo.default(false),
        }),
      )
      .default([]),
    hasPendingProsecutions: yesNo.default(false),
    hasBeenInvolvedInWarCrimes: yesNo.default(false),
    hasBeenInvolvedInTerrorism: yesNo.default(false),
    hasExpressedExtremistViews: yesNo.default(false),
    hasBeenInvolvedInOrganisedCrime: yesNo.default(false),
    hasWorkedForSecurityOrIntelligenceServices: yesNo.default(false),
    hasOtherInformationToDeclare: yesNo.default(false),
    explanation: z.string().optional(),
  })
  .describe("Good-character declarations. All default to false; set true and explain where applicable");

export const sponsorAndJob = z
  .object({
    certificateOfSponsorship: z.object({
      referenceNumber: z
        .string()
        .regex(/^[A-Z0-9]{11}$/i, "A CoS reference is 11 alphanumeric characters")
        .describe("Certificate of Sponsorship (CoS) reference number from the sponsor"),
      issueDate: isoDate.optional(),
    }),
    sponsor: z.object({
      name: z.string().min(1).describe("Legal name of the sponsoring employer"),
      licenceNumber: z.string().min(1).describe("Sponsor licence number"),
      address: address,
      contactName: z.string().optional(),
      contactTelephone: z.string().optional(),
      contactEmail: z.email().optional(),
    }),
    job: z.object({
      title: z.string().min(1),
      socCode: z.string().regex(/^\d{4}$/).describe("4-digit SOC 2020 occupation code from the CoS"),
      description: z.string().optional(),
      startDate: isoDate,
      endDate: isoDate.optional(),
      grossAnnualSalaryGbp: moneyGbp,
      hoursPerWeek: z.number().positive(),
      workAddressIsSponsorAddress: yesNo.default(true),
      workAddress: address.optional(),
      isOnImmigrationSalaryList: yesNo.default(false),
      isNewEntrant: yesNo.default(false),
      requiresPhd: yesNo.default(false),
      isHealthOrCareWorker: yesNo.default(false),
    }),
    hasOtherEmploymentInUk: yesNo.default(false),
    currentEmployment: z
      .object({
        employerName: z.string(),
        jobTitle: z.string(),
        startDate: isoDate,
        isSameAsSponsor: yesNo.default(false),
      })
      .optional(),
  })
  .describe("Certificate of Sponsorship, sponsor and job details");

export const englishLanguage = z
  .object({
    howRequirementIsMet: z.enum([
      "national-of-majority-english-speaking-country",
      "degree-taught-in-english",
      "approved-english-test",
      "gcse-a-level-or-scottish-qualification",
      "already-proven-in-previous-application",
      "exempt",
    ]),
    testDetails: z
      .object({
        provider: z.string().describe("e.g. IELTS SELT Consortium, Pearson, LanguageCert, Trinity College London"),
        testName: z.string(),
        uniqueReferenceNumber: z.string().describe("Unique Reference Number (URN) or candidate/test report number"),
        testDate: isoDate,
        cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("B1"),
      })
      .optional(),
    degreeDetails: z
      .object({
        qualification: z.string(),
        awardingInstitution: z.string(),
        countryOfStudy: countryCode,
        completionDate: isoDate,
        ecctisReferenceNumber: z.string().optional().describe("Ecctis (formerly UK NARIC) reference if needed"),
      })
      .optional(),
    exemptionReason: z.string().optional(),
  })
  .describe("How the B1 English language requirement is met");

export const finances = z
  .object({
    sponsorCertifiesMaintenance: yesNo.describe(
      "True if the sponsor has ticked the maintenance certification on the CoS (A-rated sponsor)",
    ),
    hasHeldRequiredFundsFor28Days: yesNo.optional().describe("Required only if the sponsor does not certify maintenance"),
    availableFundsGbp: moneyGbp.optional(),
    willBeRelyingOnPublicFunds: yesNo.default(false),
  })
  .describe("Maintenance funds requirement");

export const health = z
  .object({
    tuberculosisTestRequired: yesNo.default(false).describe("Required for residents of listed countries"),
    tuberculosisCertificateNumber: z.string().optional(),
    tuberculosisTestDate: isoDate.optional(),
    hasPaidImmigrationHealthSurcharge: yesNo.default(false),
    immigrationHealthSurchargeReference: z.string().optional().describe("IHS reference number if already paid"),
  })
  .describe("Tuberculosis test and Immigration Health Surcharge (IHS)");

export const visaDetails = z
  .object({
    intendedDateOfTravel: isoDate.describe("Planned date of arrival in the UK; the visa start date is based on this"),
    lengthOfStayMonths: z.number().int().positive().max(60),
    hasUkAddressToLiveAt: yesNo.default(false),
    ukAddress: address.optional(),
    priorityService: z.enum(["standard", "priority", "super-priority"]).default("standard"),
    biometricsLocationPreference: z.string().optional().describe("Preferred visa application centre city"),
  })
  .describe("Travel plans and service options");

export const declaration = z
  .object({
    informationIsTrue: z.literal(true).describe("Applicant confirms the information is true and complete"),
    completedBy: z.enum(["applicant", "representative"]).default("representative"),
    representative: z
      .object({
        name: z.string(),
        organisation: z.string(),
        email: z.email(),
        telephone: z.string(),
        oiscOrSraNumber: z.string().optional(),
      })
      .optional(),
    /**
     * Hard safety gate. The automation will never press the final submit
     * button or enter payment unless this is literally true. Defaults to false.
     */
    authoriseSubmission: z.boolean().default(false),
  })
  .describe("Declaration and submission authorisation");

export const skilledWorkerApplication = z
  .object({
    $schema: z.string().optional(),
    applicationType: z.literal("skilled-worker").default("skilled-worker"),
    clientReference: z.string().optional().describe("Your own case/matter reference; echoed back in the status report"),
    route: applicationRoute,
    account: accountDetails,
    applicant,
    contact: contactDetails,
    family,
    travelHistory,
    characterAndConduct,
    sponsorAndJob,
    englishLanguage,
    finances,
    health,
    visa: visaDetails,
    declaration,
  })
  .superRefine((data, ctx) => {
    if (data.applicant.hasOtherNames && data.applicant.otherNames.length === 0) {
      ctx.addIssue({ code: "custom", path: ["applicant", "otherNames"], message: "hasOtherNames is true but no other names were given" });
    }
    if (data.applicant.hasOtherNationalities && data.applicant.otherNationalities.length === 0) {
      ctx.addIssue({ code: "custom", path: ["applicant", "otherNationalities"], message: "hasOtherNationalities is true but none were given" });
    }
    if (!data.contact.correspondenceAddressIsHomeAddress && !data.contact.correspondenceAddress) {
      ctx.addIssue({ code: "custom", path: ["contact", "correspondenceAddress"], message: "Required when correspondenceAddressIsHomeAddress is false" });
    }
    if (data.englishLanguage.howRequirementIsMet === "approved-english-test" && !data.englishLanguage.testDetails) {
      ctx.addIssue({ code: "custom", path: ["englishLanguage", "testDetails"], message: "Required when the requirement is met by an approved test" });
    }
    if (data.englishLanguage.howRequirementIsMet === "degree-taught-in-english" && !data.englishLanguage.degreeDetails) {
      ctx.addIssue({ code: "custom", path: ["englishLanguage", "degreeDetails"], message: "Required when the requirement is met by a degree" });
    }
    if (!data.finances.sponsorCertifiesMaintenance && data.finances.hasHeldRequiredFundsFor28Days === undefined) {
      ctx.addIssue({ code: "custom", path: ["finances", "hasHeldRequiredFundsFor28Days"], message: "Required when the sponsor does not certify maintenance" });
    }
    if (!data.sponsorAndJob.job.workAddressIsSponsorAddress && !data.sponsorAndJob.job.workAddress) {
      ctx.addIssue({ code: "custom", path: ["sponsorAndJob", "job", "workAddress"], message: "Required when the work address differs from the sponsor address" });
    }
    if (data.visa.hasUkAddressToLiveAt && !data.visa.ukAddress) {
      ctx.addIssue({ code: "custom", path: ["visa", "ukAddress"], message: "Required when hasUkAddressToLiveAt is true" });
    }
    if (data.declaration.completedBy === "representative" && !data.declaration.representative) {
      ctx.addIssue({ code: "custom", path: ["declaration", "representative"], message: "Required when completedBy is representative" });
    }
    const refusalFlags = [
      data.travelHistory.hasAppliedForUkVisaAndBeenRefused,
      data.travelHistory.hasBeenRefusedVisaForAnyCountry,
      data.travelHistory.hasBeenRefusedEntryToAnyCountry,
      data.travelHistory.hasBeenDeportedOrRemoved,
      data.travelHistory.hasOverstayedOrBreachedConditions,
    ];
    if (refusalFlags.some(Boolean) && !data.travelHistory.immigrationHistoryExplanation) {
      ctx.addIssue({ code: "custom", path: ["travelHistory", "immigrationHistoryExplanation"], message: "Explain any refusal, removal or breach" });
    }
  });

export type SkilledWorkerApplicationInput = z.input<typeof skilledWorkerApplication>;
export type SkilledWorkerApplication = z.output<typeof skilledWorkerApplication>;

export function parseApplication(input: unknown): SkilledWorkerApplication {
  return skilledWorkerApplication.parse(input);
}

export function safeParseApplication(input: unknown) {
  return skilledWorkerApplication.safeParse(input);
}
