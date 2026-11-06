import type { FormStep } from "../engine/types.js";
import { countryName } from "../engine/format.js";

export const startSteps: FormStep[] = [
  {
    id: "govuk-start",
    title: "GOV.UK Skilled Worker visa: apply",
    kind: "info",
    match: (page) => /gov\.uk\/skilled-worker-visa/i.test(page.url),
    continueLabel: null,
    run: async (ctx) => {
      const label = ctx.app.route.applyingFrom === "outside-uk" ? /apply from outside the uk/i : /apply from inside the uk|switch|extend/i;
      if (await ctx.driver.clickButtonByText(label)) return true;
      const result = await ctx.driver.act(
        ctx.app.route.applyingFrom === "outside-uk"
          ? 'click the "Apply from outside the UK" link or button'
          : 'click the link or button to apply from inside the UK (switch or extend)',
      );
      return result.success;
    },
  },
  {
    id: "select-language",
    title: "Select your language",
    match: [/select (your )?language|choose (a |your )?language/i],
    fields: () => [{ kind: "radio", label: "Select your language", value: "English", aliases: ["Language"] }],
  },
  {
    id: "applying-from-country",
    title: "Where are you applying from?",
    match: [/where are you (applying|making this application) from|which country are you (applying|in)|select (the )?country.*(applying|living)|country of application/i],
    fields: (ctx) => [
      {
        kind: "select",
        label: "Where are you applying from?",
        aliases: ["Country you are applying from", "Select a country"],
        value: countryName(ctx.app.route.countryOfApplication),
        source: "/route/countryOfApplication",
      },
    ],
  },
  {
    id: "has-current-passport",
    title: "Do you have a current passport?",
    match: [/do you have a (current|valid) passport/i],
    fields: () => [{ kind: "yesno", label: "Do you have a current passport?", value: true, source: "/applicant/passport" }],
  },
  {
    id: "nationality-select",
    title: "Select your nationality",
    match: [/^(select|what is|choose) your (current )?nationality\??$|nationality (shown|as shown) (on|in) your passport/i],
    fields: (ctx) => [
      {
        kind: "select",
        label: "Nationality",
        aliases: ["Select your nationality", "What is your nationality?", "Country of nationality"],
        value: countryName(ctx.app.applicant.nationality),
        source: "/applicant/nationality",
      },
    ],
  },
  {
    id: "main-applicant",
    title: "Are you the main applicant?",
    match: [/are you (the )?main applicant|who is (this application|applying)|applying (for yourself|on behalf)/i],
    fields: () => [{ kind: "yesno", label: "Are you the main applicant?", value: true, source: "/route/applicantIsMainApplicant" }],
  },
  {
    id: "dependants-applying",
    title: "Are any dependants applying with you?",
    match: [/dependants? (applying|travelling) with you|anyone else applying|family members applying/i],
    fields: (ctx) => [
      { kind: "yesno", label: "Are any dependants applying with you?", value: ctx.app.route.hasDependantsApplying, source: "/route/hasDependantsApplying" },
    ],
  },
  {
    id: "before-you-start",
    title: "Before you start / Start now",
    kind: "info",
    match: [/before you (start|apply|begin)|check (you can|if you can|your eligibility)|start (your|the) application|^apply (for|online)|what you.?ll need|^you can apply|^skilled worker( visa)?$/i],
    continueLabel: /^(start now|start|continue|apply now|start application|begin)$/i,
  },
];
