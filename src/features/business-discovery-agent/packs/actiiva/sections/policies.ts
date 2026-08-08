import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

export const section: QuestionSection = {
  id: "politicas",
  order: 9,
  title: "Operación, políticas y reglas del negocio",
};

export const questions: QuestionDefinition[] = [
  {
    id: "policies.general",
    sectionId: "politicas",
    order: 1,
    prompt: "¿Alguna política general que tus clientes deban conocer?",
    helpText: "Ej. puntualidad, uso de toallas, código de vestimenta.",
    type: "long_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.generalPolicies",
    sensitivity: "public",
  },
  {
    id: "policies.trial_class",
    sectionId: "politicas",
    order: 2,
    prompt: "¿Ofreces clase de prueba gratuita o a precio especial?",
    type: "yes_no",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    dataTarget: "offerings.hasTrialClass",
    sensitivity: "public",
  },
];
