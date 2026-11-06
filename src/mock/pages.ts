/**
 * Page definitions for the mock Skilled Worker form. The sequence, headings
 * and field types mirror the structure of the Home Office online form closely
 * enough to exercise every kind of step the automation knows about.
 */
export type MockFieldType = "text" | "password" | "textarea" | "radio" | "checkbox" | "select" | "date" | "email";

export interface MockField {
  name: string;
  label: string;
  type: MockFieldType;
  options?: string[];
  required?: boolean;
  hint?: string;
  /** For confirm-style fields: must equal the value of this other field. */
  mustMatch?: string;
}

export interface MockPage {
  id: string;
  heading: string;
  body?: string;
  fields: MockField[];
  button?: string;
  /** Next page id, or a function of the answers so far. */
  next: string | ((answers: Record<string, string>) => string);
  /** Pages that collect one item of a repeating group. */
  repeat?: { group: string; summaryPage: string };
}

const COUNTRIES = ["Australia", "Brazil", "Canada", "China", "France", "Germany", "India", "Nigeria", "Pakistan", "Philippines", "South Africa", "United Kingdom", "United States"];
const yesNo = ["Yes", "No"];

export const START_PAGE = "start";

export const mockPages: MockPage[] = [
  { id: "start", heading: "Apply for a Skilled Worker visa", body: "Use this service to apply for a Skilled Worker visa from outside the UK. You will need your passport and your Certificate of Sponsorship reference number.", fields: [], button: "Start now", next: "country" },
  { id: "country", heading: "Where are you applying from?", fields: [{ name: "country", label: "Where are you applying from?", type: "select", options: COUNTRIES }], next: "passport-q" },
  { id: "passport-q", heading: "Do you have a current passport?", fields: [{ name: "hasPassport", label: "Do you have a current passport?", type: "radio", options: yesNo }], next: "nationality" },
  { id: "nationality", heading: "Select your nationality", fields: [{ name: "nationality", label: "Nationality", type: "select", options: COUNTRIES }], next: "email" },
  { id: "email", heading: "Email address", body: "We will use this to create your account and send you updates.", fields: [
      { name: "email", label: "Email address", type: "email" },
      { name: "email2", label: "Confirm email address", type: "email", mustMatch: "email" },
    ], next: "password" },
  { id: "password", heading: "Create a password", fields: [
      { name: "password", label: "Password", type: "password", hint: "Must be at least 8 characters" },
      { name: "password2", label: "Confirm password", type: "password", mustMatch: "password" },
    ], next: "reference" },
  { id: "reference", heading: "Your application reference number", body: "Your application reference number is GWF{{GWF}}. Keep it safe; you will need it to return to your application.", fields: [], next: "telephone" },
  { id: "telephone", heading: "Telephone number", fields: [
      { name: "phone", label: "Telephone number", type: "text" },
      { name: "phoneType", label: "What type of telephone number is this?", type: "radio", options: ["Mobile", "Home", "Work"] },
      { name: "phoneUse", label: "Where do you use this telephone number?", type: "radio", options: ["For use whilst in the UK", "For use outside the UK", "For use whilst in the UK and outside the UK"] },
      { name: "phoneOk", label: "Can we contact you by telephone?", type: "radio", options: yesNo },
    ], next: "address" },
  { id: "address", heading: "Where do you live?", fields: [
      { name: "line1", label: "Address line 1", type: "text" },
      { name: "line2", label: "Address line 2 (optional)", type: "text", required: false },
      { name: "town", label: "Town or city", type: "text" },
      { name: "state", label: "Province, region or state (optional)", type: "text", required: false },
      { name: "postcode", label: "Postal code (optional)", type: "text", required: false },
      { name: "addrCountry", label: "Country", type: "select", options: COUNTRIES },
    ], next: "address-about" },
  { id: "address-about", heading: "About your home address", fields: [
      { name: "livedSince", label: "When did you start living at this address?", type: "date" },
      { name: "ownership", label: "What is the ownership status of your home?", type: "radio", options: ["I own it", "I rent it", "Other"] },
    ], next: "correspondence" },
  { id: "correspondence", heading: "Is this also your correspondence address?", fields: [{ name: "corrSame", label: "Is this address also your correspondence address?", type: "radio", options: yesNo }], next: "name" },
  { id: "name", heading: "Your name", body: "Enter your name exactly as it appears in your passport.", fields: [
      { name: "given", label: "Given name(s)", type: "text" },
      { name: "family", label: "Family name", type: "text" },
    ], next: "other-names-q" },
  { id: "other-names-q", heading: "Have you ever been known by any other names?", fields: [{ name: "otherNames", label: "Have you ever been known by any other names?", type: "radio", options: yesNo }], next: (a) => (a.otherNames === "Yes" ? "other-name" : "sex") },
  { id: "other-name", heading: "Enter your other name", fields: [
      { name: "otherName", label: "Other name", type: "text" },
      { name: "otherNameReason", label: "Why did you use this name?", type: "textarea" },
    ], repeat: { group: "otherNames", summaryPage: "other-name-more" }, next: "other-name-more" },
  { id: "other-name-more", heading: "You have added {{COUNT:otherNames}} other name(s). Do you need to add another?", fields: [{ name: "otherNameMore", label: "Do you need to add another name?", type: "radio", options: yesNo }], next: (a) => (a.otherNameMore === "Yes" ? "other-name" : "sex") },
  { id: "sex", heading: "What is your sex, as shown in your passport?", fields: [{ name: "sex", label: "Sex", type: "radio", options: ["Male", "Female", "Unspecified"] }], next: "relationship" },
  { id: "relationship", heading: "What is your relationship status?", fields: [{ name: "relationship", label: "Relationship status", type: "radio", options: ["Single", "Married", "Civil partnership", "Unmarried partner", "Divorced", "Separated", "Widowed"] }], next: "dob" },
  { id: "dob", heading: "What is your date of birth?", fields: [{ name: "dob", label: "Date of birth", type: "date", hint: "For example, 27 3 1990" }], next: "pob" },
  { id: "pob", heading: "Where were you born?", fields: [
      { name: "pob", label: "Place of birth", type: "text", hint: "Town or city" },
      { name: "cob", label: "Country of birth", type: "select", options: COUNTRIES },
    ], next: "other-nat-q" },
  { id: "other-nat-q", heading: "Do you hold any other nationalities?", fields: [{ name: "otherNat", label: "Do you currently hold, or have you ever held, any other nationality or citizenship?", type: "radio", options: yesNo }], next: "passport" },
  { id: "passport", heading: "Your passport", fields: [
      { name: "ppNumber", label: "Passport number", type: "text" },
      { name: "ppAuthority", label: "Issuing authority", type: "text" },
      { name: "ppIssue", label: "Issue date", type: "date" },
      { name: "ppExpiry", label: "Expiry date", type: "date" },
      { name: "ppCountry", label: "Country of issue", type: "select", options: COUNTRIES },
      { name: "ppBiometric", label: "Is this a biometric passport?", type: "radio", options: yesNo },
    ], next: "mother" },
  { id: "mother", heading: "Your mother", fields: [
      { name: "motherGiven", label: "Mother's given name(s)", type: "text" },
      { name: "motherFamily", label: "Mother's family name", type: "text" },
      { name: "motherDob", label: "Mother's date of birth", type: "date" },
      { name: "motherNat", label: "Mother's nationality", type: "select", options: COUNTRIES },
    ], next: "father" },
  { id: "father", heading: "Your father", fields: [
      { name: "fatherGiven", label: "Father's given name(s)", type: "text" },
      { name: "fatherFamily", label: "Father's family name", type: "text" },
      { name: "fatherDob", label: "Father's date of birth", type: "date" },
      { name: "fatherNat", label: "Father's nationality", type: "select", options: COUNTRIES },
    ], next: "partner-q" },
  { id: "partner-q", heading: "Do you have a partner?", fields: [{ name: "hasPartner", label: "Do you have a partner?", type: "radio", options: yesNo }], next: (a) => (a.hasPartner === "Yes" ? "partner" : "children-q") },
  { id: "partner", heading: "Enter your partner's details", fields: [
      { name: "partnerGiven", label: "Partner's given name(s)", type: "text" },
      { name: "partnerFamily", label: "Partner's family name", type: "text" },
      { name: "partnerDob", label: "Partner's date of birth", type: "date" },
      { name: "partnerNat", label: "Partner's nationality", type: "select", options: COUNTRIES },
      { name: "partnerLives", label: "Does your partner live with you?", type: "radio", options: yesNo },
      { name: "partnerApplying", label: "Is your partner applying with you?", type: "radio", options: yesNo },
    ], next: "children-q" },
  { id: "children-q", heading: "Do you have any children?", fields: [{ name: "hasChildren", label: "Do you have any children?", type: "radio", options: yesNo }], next: (a) => (a.hasChildren === "Yes" ? "child" : "uk-travel-q") },
  { id: "child", heading: "Enter your child's details", fields: [
      { name: "childGiven", label: "Child's given name(s)", type: "text" },
      { name: "childFamily", label: "Child's family name", type: "text" },
      { name: "childDob", label: "Child's date of birth", type: "date" },
      { name: "childNat", label: "Child's nationality", type: "select", options: COUNTRIES },
      { name: "childRel", label: "What is your relationship to this child?", type: "radio", options: ["Child", "Step Child", "Adopted Child"] },
      { name: "childLives", label: "Does this child live with you?", type: "radio", options: yesNo },
      { name: "childApplying", label: "Is this child applying with you?", type: "radio", options: yesNo },
    ], repeat: { group: "children", summaryPage: "child-more" }, next: "child-more" },
  { id: "child-more", heading: "You have added {{COUNT:children}} child(ren). Do you need to add another?", fields: [{ name: "childMore", label: "Do you need to add another child?", type: "radio", options: yesNo }], next: (a) => (a.childMore === "Yes" ? "child" : "uk-travel-q") },
  { id: "uk-travel-q", heading: "Have you been to the UK in the last 10 years?", fields: [{ name: "ukTravel", label: "Have you been to the UK in the last 10 years?", type: "radio", options: yesNo }], next: (a) => (a.ukTravel === "Yes" ? "uk-visit" : "immigration") },
  { id: "uk-visit", heading: "Enter details of your visit to the UK", fields: [
      { name: "visitReason", label: "Reason for visit", type: "text" },
      { name: "visitFrom", label: "Date you arrived in the UK", type: "date" },
      { name: "visitTo", label: "Date you left the UK", type: "date" },
    ], repeat: { group: "ukVisits", summaryPage: "uk-visit-more" }, next: "uk-visit-more" },
  { id: "uk-visit-more", heading: "You have added {{COUNT:ukVisits}} visit(s). Do you need to add another?", fields: [{ name: "visitMore", label: "Do you need to add another visit?", type: "radio", options: yesNo }], next: (a) => (a.visitMore === "Yes" ? "uk-visit" : "immigration") },
  { id: "immigration", heading: "Immigration history", fields: [
      { name: "refusedUk", label: "Have you ever been refused a visa for the UK?", type: "radio", options: yesNo },
      { name: "refusedOther", label: "Have you ever been refused a visa for any other country?", type: "radio", options: yesNo },
      { name: "refusedEntry", label: "Have you ever been refused entry at the border to the UK or any other country?", type: "radio", options: yesNo },
      { name: "deported", label: "Have you ever been deported, removed or otherwise required to leave any country?", type: "radio", options: yesNo },
      { name: "breached", label: "Have you ever overstayed or breached the conditions of a visa?", type: "radio", options: yesNo },
    ], next: "character" },
  { id: "character", heading: "Convictions and other penalties", fields: [
      { name: "convictions", label: "Have you ever had a criminal conviction, including traffic offences?", type: "radio", options: yesNo },
      { name: "prosecutions", label: "Are there any pending prosecutions against you?", type: "radio", options: yesNo },
      { name: "warCrimes", label: "Have you ever been involved in, supported or encouraged war crimes, crimes against humanity or genocide?", type: "radio", options: yesNo },
      { name: "terrorism", label: "Have you ever been involved in, supported or encouraged terrorist activities?", type: "radio", options: yesNo },
      { name: "extremism", label: "Have you ever expressed views that justify or glorify terrorist violence?", type: "radio", options: yesNo },
      { name: "organisedCrime", label: "Have you ever been involved in organised crime?", type: "radio", options: yesNo },
      { name: "security", label: "Have you ever worked for the security, intelligence or armed forces of any country?", type: "radio", options: yesNo },
      { name: "otherInfo", label: "Is there any other information you would like us to know?", type: "radio", options: yesNo },
    ], next: "cos" },
  { id: "cos", heading: "Certificate of Sponsorship", fields: [{ name: "cos", label: "Certificate of Sponsorship reference number", type: "text", hint: "11 characters, for example C2G4X7K9L1M" }], next: "sponsor" },
  { id: "sponsor", heading: "Your sponsor", fields: [
      { name: "sponsorName", label: "Sponsor name", type: "text" },
      { name: "sponsorLicence", label: "Sponsor licence number", type: "text" },
      { name: "sponsorLine1", label: "Sponsor Address line 1", type: "text" },
      { name: "sponsorTown", label: "Sponsor Town or city", type: "text" },
      { name: "sponsorPostcode", label: "Sponsor Postal code", type: "text" },
      { name: "sponsorCountry", label: "Sponsor Country", type: "select", options: COUNTRIES },
    ], next: "job" },
  { id: "job", heading: "Your job", fields: [
      { name: "jobTitle", label: "Job title", type: "text" },
      { name: "soc", label: "Occupation code", type: "text", hint: "4-digit SOC code" },
      { name: "jobStart", label: "Job start date", type: "date" },
    ], next: "salary" },
  { id: "salary", heading: "Salary", fields: [
      { name: "salary", label: "Gross annual salary", type: "text", hint: "In pounds" },
      { name: "hours", label: "Hours per week", type: "text" },
      { name: "isl", label: "Is the job on the Immigration Salary List?", type: "radio", options: yesNo },
      { name: "newEntrant", label: "Are you a new entrant to the labour market?", type: "radio", options: yesNo },
      { name: "phd", label: "Does the job require a PhD?", type: "radio", options: yesNo },
    ], next: "english" },
  { id: "english", heading: "English language requirement", fields: [
      { name: "english", label: "How do you meet the English language requirement?", type: "radio", options: [
          "I am a national of a majority English speaking country",
          "I have a degree that was taught or researched in English",
          "I have passed an approved English language test",
          "I have a GCSE, A level or Scottish qualification in English",
          "I met the requirement in a previous application",
          "I am exempt",
        ] },
      { name: "testProvider", label: "Test provider (optional)", type: "text", required: false },
      { name: "testUrn", label: "Unique reference number (optional)", type: "text", required: false },
      { name: "testDate", label: "Test date (optional)", type: "date", required: false },
    ], next: "funds" },
  { id: "funds", heading: "Maintenance funds", fields: [
      { name: "certified", label: "Has your sponsor certified that they will maintain and accommodate you?", type: "radio", options: yesNo },
      { name: "publicFunds", label: "Will you be relying on public funds?", type: "radio", options: yesNo },
    ], next: "tb" },
  { id: "tb", heading: "Tuberculosis test", fields: [{ name: "tb", label: "Have you had a tuberculosis test?", type: "radio", options: yesNo }], next: "travel" },
  { id: "travel", heading: "When do you plan to arrive in the UK?", fields: [
      { name: "arrival", label: "When do you plan to arrive in the UK?", type: "date" },
      { name: "months", label: "How long do you plan to stay in the UK?", type: "text", hint: "In months" },
    ], next: "check" },
  { id: "check", heading: "Check your answers", body: "Review the answers you have given before continuing to the declaration.", fields: [], next: "declaration" },
  { id: "declaration", heading: "Declaration", body: "By submitting this application you confirm that the information given is complete and true.", fields: [
      { name: "declare", label: "Declaration", type: "checkbox", options: ["I confirm that the information I have given is true and complete"] },
      { name: "completedBy", label: "Who is completing this form?", type: "radio", options: ["The applicant", "Someone else on behalf of the applicant"] },
    ], button: "Submit application", next: "pay" },
  { id: "pay", heading: "Pay for your application", body: "The application fee is £719.00. You must also pay the Immigration Health Surcharge.", fields: [], button: "Pay now", next: "done" },
  { id: "done", heading: "Application submitted", body: "Your Unique Application Number (UAN) is {{UAN}}. We have sent a confirmation to your email address. What happens next: book your biometrics appointment.", fields: [], next: "done" },
];

export const pagesById = new Map(mockPages.map((p) => [p.id, p]));
