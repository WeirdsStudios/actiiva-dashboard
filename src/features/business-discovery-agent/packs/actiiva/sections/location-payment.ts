import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

// Restricción D5 (docs/business-discovery-agent/OPEN_DECISIONS.md): esta sección
// NUNCA pregunta por números de cuenta, CLABE ni ninguna credencial financiera.
// Solo captura qué métodos de pago acepta el negocio hoy. La conexión de cobro
// real ocurre después vía el flujo OAuth propio de Mercado Pago, no aquí.

export const section: QuestionSection = {
  id: "ubicaciones-pago",
  order: 8,
  title: "Ubicaciones, contacto y formas de pago",
};

export const questions: QuestionDefinition[] = [
  {
    id: "location.address",
    sectionId: "ubicaciones-pago",
    order: 1,
    prompt: "¿Cuál es la dirección de tu negocio?",
    type: "short_text",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.address",
    sensitivity: "public",
  },
  {
    id: "location.phone",
    sectionId: "ubicaciones-pago",
    order: 2,
    prompt: "¿Cuál es el teléfono de contacto del negocio?",
    type: "short_text",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.phone",
    sensitivity: "internal",
  },
  {
    id: "payment.methods_accepted",
    sectionId: "ubicaciones-pago",
    order: 3,
    prompt: "¿Qué métodos de pago aceptas hoy?",
    helpText: "Solo necesitamos saber cuáles aceptas — nunca pedimos números de cuenta ni datos bancarios aquí.",
    type: "multi_select",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "cash", label: "Efectivo" },
      { value: "card", label: "Tarjeta" },
      { value: "bank_transfer", label: "Transferencia bancaria" },
      { value: "mercado_pago", label: "Mercado Pago" },
      { value: "other", label: "Otro" },
    ],
    dataTarget: "business-profile.paymentMethods",
    sensitivity: "public",
  },
];
