import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";

const UAN = /\b(\d{4}-\d{4}-\d{4}-\d{4})\b|\bUAN[:\s]*([A-Z0-9-]{8,})\b/i;

export const finishSteps: FormStep[] = [
  {
    id: "add-another",
    title: "Add another?",
    match: [/add (another|more)|you have added|added \d+|do you (want|need) to add|anyone else|any more|add (a|an)? ?(other|additional)/i],
    run: async (ctx) => {
      // Decide based on whichever repeating group was most recently in progress.
      const group = ctx.state.lastRepeatGroup;
      const remaining = group ? remainingItems(ctx.app, group, ctx.state.repeatIndex[group] ?? 0) : 0;
      const result = await ctx.driver.act(`select the radio option "${remaining > 0 ? "Yes" : "No"}" to indicate whether to add another`);
      if (!result.success) {
        const actions = await ctx.driver.observe(`the radio button labelled "${remaining > 0 ? "Yes" : "No"}"`);
        if (!actions[0]) return false;
        await ctx.driver.click(actions[0].selector);
      }
      return true;
    },
  },
  {
    id: "check-your-answers",
    title: "Check your answers",
    kind: "info",
    match: [/check your answers|review your (answers|application)|summary of your answers|your answers/i],
    continueLabel: /^(continue|confirm|accept and continue|save and continue|next)$/i,
  },
  {
    id: "declaration",
    title: "Declaration",
    kind: "stop",
    match: [/^declaration|declaration and (consent|submission)|confirm (that )?(the|this) information|terms and conditions|consent/i],
    fields: (ctx) => {
      const d = ctx.app.declaration;
      const fields: FieldIntent[] = [
        { kind: "checkbox", label: "Declaration", aliases: ["I confirm", "I agree"], values: ["I confirm that the information I have given is true and complete"], source: "/declaration/informationIsTrue" },
        { kind: "radio", label: "Who is completing this form?", aliases: ["Completed by"], value: d.completedBy === "applicant" ? "The applicant" : "Someone else on behalf of the applicant", source: "/declaration/completedBy" },
      ];
      if (d.completedBy === "representative" && d.representative) {
        const r = d.representative;
        fields.push(
          { kind: "text", label: "Representative's name", aliases: ["Your name", "Name of person completing the form"], value: r.name, source: "/declaration/representative/name" },
          { kind: "text", label: "Organisation", aliases: ["Company", "Firm"], value: r.organisation, source: "/declaration/representative/organisation" },
          { kind: "text", label: "Representative's email address", aliases: ["Email"], value: r.email, source: "/declaration/representative/email" },
          { kind: "text", label: "Representative's telephone number", aliases: ["Telephone"], value: r.telephone, source: "/declaration/representative/telephone" },
        );
        if (r.oiscOrSraNumber) fields.push({ kind: "text", label: "OISC or SRA registration number", aliases: ["Regulator reference"], value: r.oiscOrSraNumber, source: "/declaration/representative/oiscOrSraNumber" });
      }
      return fields;
    },
    continueLabel: /^(submit|submit application|continue|agree and submit|accept and continue|confirm and continue)$/i,
  },
  {
    id: "payment",
    title: "Payment",
    kind: "stop",
    match: [/^pay(ment)?( for your application)?$|pay the (fee|surcharge)|application fee|card details|make (a )?payment|how (do you want|would you like) to pay/i],
    continueLabel: null,
  },
  {
    id: "confirmation",
    title: "Application submitted",
    kind: "terminal",
    match: [/application (submitted|complete|received)|thank you|what happens next|confirmation|you have (submitted|completed)/i],
    run: async (ctx) => {
      const match = UAN.exec(ctx.page.bodyText);
      const uan = match?.[1] ?? match?.[2];
      if (uan) ctx.state.references.uan = uan;
      return true;
    },
    continueLabel: null,
  },
];

export function remainingItems(app: import("../schema/application.js").SkilledWorkerApplication, group: string, nextIndex: number): number {
  const sizes: Record<string, number> = {
    otherNames: app.applicant.otherNames.length,
    otherNationalities: app.applicant.otherNationalities.length,
    parents: app.family.parents.length,
    children: app.family.children.length,
    previousAddresses: app.travelHistory.previousUkAddresses.length,
    ukVisits: app.travelHistory.ukVisits.length,
    previousUkVisas: app.travelHistory.previousUkVisaDetails.length,
    otherCountryVisits: app.travelHistory.otherCountryVisits.length,
    convictions: app.characterAndConduct.convictions.length,
  };
  return Math.max(0, (sizes[group] ?? 0) - nextIndex);
}
