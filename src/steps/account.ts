import type { FormStep } from "../engine/types.js";

const GWF = /\bGWF\d{9}\b/;

export const accountSteps: FormStep[] = [
  {
    id: "resume-application",
    title: "Return to an existing application",
    match: [/return to (your|an existing|a saved) application|sign in|already (started|have an account)/i],
    when: (ctx) => Boolean(ctx.app.account.existingApplicationReference),
    fields: (ctx) => [
      { kind: "text", label: "Application reference number", aliases: ["GWF reference", "Reference number"], value: ctx.app.account.existingApplicationReference!, source: "/account/existingApplicationReference" },
      { kind: "text", label: "Email address", value: ctx.app.account.email, source: "/account/email", secret: true },
      { kind: "password", label: "Password", value: ctx.app.account.password, source: "/account/password", secret: true },
    ],
    continueLabel: /^(sign in|continue|return to application|log in)$/i,
  },
  {
    id: "email",
    title: "Email address",
    match: [/^(enter|what is|provide) (your|an) email( address)?|email address|register (your|an) email|create (an|your) account/i],
    fields: (ctx) => {
      const email = ctx.app.account.email;
      return [
        { kind: "text", label: "Email address", aliases: ["Email", "Enter your email address"], value: email, source: "/account/email", secret: true },
        { kind: "text", label: "Confirm email address", aliases: ["Re-enter email address", "Confirm your email", "Repeat email"], value: email, source: "/account/email", secret: true },
      ];
    },
  },
  {
    id: "email-verification",
    title: "Email verification code",
    match: [/verif(y|ication) (code|your email)|security code|enter the code|confirm your email address|check your email/i],
    run: async (ctx) => {
      let code = ctx.app.account.emailVerificationCode;
      if (!code && ctx.options.resolveVerificationCode) {
        ctx.log("Requesting verification code from resolver");
        code = await ctx.options.resolveVerificationCode({ email: ctx.app.account.email });
      }
      if (!code) {
        ctx.state.warnings.push("A verification code was requested by the form but none was available");
        return false;
      }
      const actions = await ctx.driver.observe('the text input for the verification or security code');
      if (actions[0]) {
        await ctx.driver.fill(actions[0].selector, code);
      } else {
        const result = await ctx.driver.act("type %code% into the verification code field", { code });
        if (!result.success) return false;
      }
      return true;
    },
  },
  {
    id: "password",
    title: "Create a password",
    match: [/create (a |your )?password|choose a password|^password$|set (a |your )?password/i],
    fields: (ctx) => [
      { kind: "password", label: "Password", aliases: ["Create a password", "New password"], value: ctx.app.account.password, source: "/account/password", secret: true },
      { kind: "password", label: "Confirm password", aliases: ["Re-enter password", "Repeat password", "Confirm your password"], value: ctx.app.account.password, source: "/account/password", secret: true },
    ],
  },
  {
    id: "security-question",
    title: "Security question",
    match: [/security question|memorable (word|answer)/i],
    run: async (ctx) => {
      ctx.state.warnings.push("The form asked for a security question or memorable word, which is not part of the input document");
      return false;
    },
  },
  {
    id: "application-reference",
    title: "Your application reference",
    kind: "info",
    match: (page) => /application (reference|number)|your reference|save this (number|reference)|unique reference/i.test(page.heading) || (GWF.test(page.bodyText) && /reference/i.test(page.heading)),
    run: async (ctx) => {
      const found = GWF.exec(ctx.page.bodyText);
      if (found) ctx.state.references.gwf = found[0];
      return true;
    },
  },
  {
    id: "contact-preferences",
    title: "How we will contact you",
    match: [/how (should|can|will|would you like) (we|us to) contact you|contact preference|who should we contact|correspondence (method|preference)/i],
    fields: (ctx) => [
      {
        kind: "radio",
        label: "How should we contact you?",
        aliases: ["Preferred contact method"],
        value: ctx.app.contact.preferredContactMethod === "email" ? "Email" : "Post",
        source: "/contact/preferredContactMethod",
      },
    ],
  },
];
