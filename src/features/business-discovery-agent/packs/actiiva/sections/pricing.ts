import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

export const section: QuestionSection = {
  id: "membresias-precios",
  order: 5,
  title: "Membresías, planes, precios y promociones",
};

export const questions: QuestionDefinition[] = [
  {
    id: "pricing.has_memberships",
    sectionId: "membresias-precios",
    order: 1,
    prompt: "¿Manejas membresías o paquetes, o solo clases sueltas?",
    type: "yes_no",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    helpText: "Responde \"Sí\" si tienes planes/paquetes además de clases sueltas.",
    dataTarget: "offerings.hasMemberships",
    sensitivity: "public",
  },
  {
    id: "pricing.membership_plans",
    sectionId: "membresias-precios",
    order: 2,
    prompt: "Cuéntanos tus planes de membresía",
    type: "editable_table",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    tableSchema: {
      minRows: 1,
      columns: [
        { key: "plan_name", label: "Nombre del plan", type: "text" },
        { key: "price", label: "Precio", type: "currency" },
        { key: "billing_period", label: "Periodo (mensual, anual, por clase...)", type: "text" },
      ],
    },
    conditions: [{ dependsOn: "pricing.has_memberships", operator: "equals", value: true }],
    dataTarget: "offerings.membershipPlans",
    sensitivity: "public",
  },
  {
    id: "pricing.dropin_price",
    sectionId: "membresias-precios",
    order: 3,
    prompt: "¿Cuánto cuesta una clase suelta (drop-in)?",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: true,
    dataTarget: "offerings.dropInPrice",
    sensitivity: "public",
  },
  {
    id: "pricing.promotions",
    sectionId: "membresias-precios",
    order: 4,
    prompt: "¿Tienes alguna promoción activa?",
    helpText: "Ej. primera clase gratis, paquete de bienvenida.",
    type: "long_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "offerings.promotions",
    sensitivity: "public",
  },
];
