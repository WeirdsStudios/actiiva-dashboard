import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

// Reutiliza el set ya validado de MOTOR-ANALISIS-NEGOCIO.md Paso 3
// (sitio web actual, cómo consigue clientes hoy).

export const section: QuestionSection = {
  id: "redes-sociales",
  order: 3,
  title: "Redes sociales y presencia digital existente",
};

export const questions: QuestionDefinition[] = [
  {
    id: "digital.has_website",
    sectionId: "redes-sociales",
    order: 1,
    prompt: "¿Tienes sitio web hoy?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "yes_good", label: "Sí, funciona bien" },
      { value: "yes_bad", label: "Sí, pero no me gusta o no funciona" },
      { value: "no", label: "No tengo" },
    ],
    dataTarget: "business-profile.currentWebsiteStatus",
    sensitivity: "public",
  },
  {
    id: "digital.instagram",
    sectionId: "redes-sociales",
    order: 2,
    prompt: "¿Cuál es tu Instagram?",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.instagram",
    sensitivity: "public",
  },
  {
    id: "digital.facebook",
    sectionId: "redes-sociales",
    order: 3,
    prompt: "¿Cuál es tu Facebook?",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.facebook",
    sensitivity: "public",
  },
  {
    id: "digital.whatsapp_business",
    sectionId: "redes-sociales",
    order: 4,
    prompt: "¿Tienes número de WhatsApp de negocio?",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.whatsappBusiness",
    sensitivity: "internal",
  },
  {
    id: "digital.acquisition",
    sectionId: "redes-sociales",
    order: 5,
    prompt: "¿Cómo consigues clientes hoy principalmente?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "social", label: "Redes sociales" },
      { value: "referral", label: "Boca a boca / recomendación" },
      { value: "paid_ads", label: "Publicidad pagada" },
      { value: "none", label: "Ninguno en particular" },
    ],
    dataTarget: "business-profile.acquisitionChannel",
    sensitivity: "public",
  },
];
