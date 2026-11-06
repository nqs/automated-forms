import type { FormStep } from "../engine/types.js";
import type { FieldIntent } from "../engine/fields.js";
import { titleCase } from "../engine/format.js";
import { addressFields } from "./helpers.js";

const PHONE_USE: Record<string, string> = { uk: "For use whilst in the UK", "outside-uk": "For use outside the UK", both: "For use whilst in the UK and outside the UK" };

export const contactSteps: FormStep[] = [
  {
    id: "telephone",
    title: "Telephone number",
    match: [/telephone|phone number|contact number/i],
    when: (ctx) => !/sponsor|employer|representative/i.test(ctx.page.heading),
    fields: (ctx) => {
      const t = ctx.app.contact.telephone;
      const fields: FieldIntent[] = [
        { kind: "text", label: "Telephone number", aliases: ["Phone number", "Contact telephone number"], value: t.number, source: "/contact/telephone/number" },
        { kind: "radio", label: "What type of telephone number is this?", aliases: ["Type of telephone number"], value: titleCase(t.type), source: "/contact/telephone/type" },
        { kind: "radio", label: "Where do you use this telephone number?", aliases: ["Where this number is used"], value: PHONE_USE[t.usedIn]!, source: "/contact/telephone/usedIn" },
        { kind: "yesno", label: "Can we contact you by telephone?", aliases: ["Are you happy to be contacted by telephone?"], value: ctx.app.contact.canBeContactedByTelephone, source: "/contact/canBeContactedByTelephone" },
      ];
      return fields;
    },
  },
  {
    id: "additional-telephone-question",
    title: "Do you have any other telephone numbers?",
    match: [/(another|other|additional|second) (telephone|phone) number/i],
    fields: (ctx) => [
      { kind: "yesno", label: "Do you have any other telephone numbers?", value: Boolean(ctx.app.contact.additionalTelephone), source: "/contact/additionalTelephone" },
    ],
  },
  {
    id: "home-address",
    title: "Your home address",
    match: [/where do you live|your (home |current |postal )?address|address where you live|home address|enter (your )?address/i],
    when: (ctx) => !/sponsor|employer|work|correspondence|previous|uk address|where will you (live|stay)|partner|child|parent|about|how long|when did|own|rent/i.test(ctx.page.heading),
    fields: (ctx) => addressFields("home", "/contact/homeAddress", ctx.app.contact.homeAddress),
  },
  {
    id: "home-address-details",
    title: "About your home address",
    match: [/how long have you lived|when did you (start|begin|move)|do you (own|rent)|ownership|about (this|your)( home| current)? address|lived at this address/i],
    fields: (ctx) => [
      { kind: "date", label: "When did you start living at this address?", aliases: ["Date you moved in", "Lived here since"], value: ctx.app.contact.livedAtHomeAddressSince, source: "/contact/livedAtHomeAddressSince" },
      {
        kind: "radio",
        label: "What is the ownership status of your home?",
        aliases: ["Do you own or rent your home?", "Ownership status"],
        value: ctx.app.contact.homeAddressOwnership === "own" ? "I own it" : ctx.app.contact.homeAddressOwnership === "rent" ? "I rent it" : "Other",
        source: "/contact/homeAddressOwnership",
      },
    ],
  },
  {
    id: "correspondence-address-question",
    title: "Is this your correspondence address?",
    match: [/correspondence address|where should we send|postal address for correspondence|send (letters|correspondence)/i],
    when: (ctx) => !/enter|details/i.test(ctx.page.heading),
    fields: (ctx) => [
      { kind: "yesno", label: "Is this address also your correspondence address?", value: ctx.app.contact.correspondenceAddressIsHomeAddress, source: "/contact/correspondenceAddressIsHomeAddress" },
    ],
  },
  {
    id: "correspondence-address-details",
    title: "Correspondence address",
    match: [/(enter|details of) (your )?correspondence address/i],
    fields: (ctx) => (ctx.app.contact.correspondenceAddress ? addressFields("corr", "/contact/correspondenceAddress", ctx.app.contact.correspondenceAddress) : []),
  },
];
