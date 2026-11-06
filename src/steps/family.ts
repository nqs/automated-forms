import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { countryName, titleCase } from "../engine/format.js";

export const familySteps: FormStep[] = [
  {
    id: "parent-details",
    title: "Your parents' details",
    match: [/your (mother|father)|parent.?s? details|details of your parents|about your parents/i],
    repeatGroup: "parents",
    fields: (ctx) => {
      const headingSaysMother = /mother/i.test(ctx.page.heading);
      const headingSaysFather = /father/i.test(ctx.page.heading);
      const byHeading = headingSaysMother ? "mother" : headingSaysFather ? "father" : undefined;
      const i = ctx.state.repeatIndex.parents ?? 0;
      const parent = byHeading ? ctx.app.family.parents.find((p) => p.relationship === byHeading) : ctx.app.family.parents[i];
      if (!parent) return [];
      const who = titleCase(parent.relationship);
      const idx = ctx.app.family.parents.indexOf(parent);
      const src = `/family/parents/${idx}`;
      const fields: FieldIntent[] = [];
      if (!parent.detailsKnown) {
        fields.push({ kind: "checkbox", label: `What is your ${parent.relationship}'s name?`, aliases: ["I do not have my parent's details", "Details not known"], values: ["I do not have their details"], source: `${src}/detailsKnown` });
        return fields;
      }
      if (parent.name) {
        fields.push({ kind: "text", label: `${who}'s given name(s)`, aliases: ["Given names", "First names"], value: parent.name.givenNames, source: `${src}/name/givenNames` });
        fields.push({ kind: "text", label: `${who}'s family name`, aliases: ["Family name", "Surname"], value: parent.name.familyName, source: `${src}/name/familyName` });
      }
      if (parent.dateOfBirth) fields.push({ kind: "date", label: `${who}'s date of birth`, aliases: ["Date of birth"], value: parent.dateOfBirth, source: `${src}/dateOfBirth` });
      if (parent.nationality) fields.push({ kind: "select", label: `${who}'s nationality`, aliases: ["Nationality"], value: countryName(parent.nationality), source: `${src}/nationality` });
      if (parent.hadSameNationalityAtBirth !== undefined) {
        fields.push({ kind: "yesno", label: `Did your ${parent.relationship} have the same nationality at birth?`, aliases: ["Same nationality at birth"], value: parent.hadSameNationalityAtBirth, source: `${src}/hadSameNationalityAtBirth` });
      }
      return fields;
    },
  },
  {
    id: "partner-question",
    title: "Do you have a partner?",
    match: [/do you have a (partner|spouse)|your partner|partner.?s details|husband|wife|spouse/i],
    when: (ctx) => !/enter|details|travelling with you/i.test(ctx.page.heading) || !ctx.app.family.partner,
    fields: (ctx) => [
      { kind: "yesno", label: "Do you have a partner?", aliases: ["Are you in a relationship?"], value: Boolean(ctx.app.family.partner), source: "/family/partner" },
    ],
  },
  {
    id: "partner-details",
    title: "Partner details",
    match: [/(enter|details of|about) (your )?partner|partner details|partner.?s (name|details)/i],
    when: (ctx) => Boolean(ctx.app.family.partner),
    fields: (ctx) => {
      const p = ctx.app.family.partner!;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Partner's given name(s)", aliases: ["Given names"], value: p.name.givenNames, source: "/family/partner/name/givenNames" },
        { kind: "text", label: "Partner's family name", aliases: ["Family name", "Surname"], value: p.name.familyName, source: "/family/partner/name/familyName" },
        { kind: "date", label: "Partner's date of birth", aliases: ["Date of birth"], value: p.dateOfBirth, source: "/family/partner/dateOfBirth" },
        { kind: "select", label: "Partner's nationality", aliases: ["Nationality"], value: countryName(p.nationality), source: "/family/partner/nationality" },
        { kind: "yesno", label: "Does your partner live with you?", aliases: ["Lives with you"], value: p.livesWithApplicant, source: "/family/partner/livesWithApplicant" },
        { kind: "yesno", label: "Is your partner applying with you?", aliases: ["Travelling with you", "Applying at the same time"], value: p.isApplyingToo, source: "/family/partner/isApplyingToo" },
      ];
      if (p.passportNumber) fields.push({ kind: "text", label: "Partner's passport number", aliases: ["Passport number"], value: p.passportNumber, source: "/family/partner/passportNumber" });
      if (p.relationshipStartDate) fields.push({ kind: "date", label: "When did your relationship start?", aliases: ["Relationship start date", "Date of marriage"], value: p.relationshipStartDate, source: "/family/partner/relationshipStartDate" });
      return fields;
    },
  },
  {
    id: "children-question",
    title: "Do you have any children?",
    match: [/do you have (any )?children|dependant children|your children/i],
    when: (ctx) => !/enter|details|another/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Do you have any children?", value: ctx.app.family.children.length > 0, source: "/family/children" },
    ],
  },
  {
    id: "child-details",
    title: "Child details",
    match: [/(enter|details of|about) (your |a |the )?child|child.?s (name|details)|child details/i],
    repeatGroup: "children",
    fields: (ctx) => {
      const i = ctx.state.repeatIndex.children ?? 0;
      const c = ctx.app.family.children[i];
      if (!c) return [];
      const src = `/family/children/${i}`;
      return [
        { kind: "text", label: "Child's given name(s)", aliases: ["Given names"], value: c.name.givenNames, source: `${src}/name/givenNames` },
        { kind: "text", label: "Child's family name", aliases: ["Family name", "Surname"], value: c.name.familyName, source: `${src}/name/familyName` },
        { kind: "date", label: "Child's date of birth", aliases: ["Date of birth"], value: c.dateOfBirth, source: `${src}/dateOfBirth` },
        { kind: "select", label: "Child's nationality", aliases: ["Nationality"], value: countryName(c.nationality), source: `${src}/nationality` },
        { kind: "radio", label: "What is your relationship to this child?", aliases: ["Relationship"], value: titleCase(c.relationshipToApplicant), source: `${src}/relationshipToApplicant` },
        { kind: "yesno", label: "Does this child live with you?", aliases: ["Lives with you"], value: c.livesWithApplicant, source: `${src}/livesWithApplicant` },
        { kind: "yesno", label: "Is this child applying with you?", aliases: ["Travelling with you"], value: c.isApplyingToo, source: `${src}/isApplyingToo` },
      ];
    },
  },
];
