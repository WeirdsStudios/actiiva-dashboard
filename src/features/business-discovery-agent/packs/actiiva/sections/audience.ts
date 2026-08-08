import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

// audience.urgent_need reutiliza el set ya validado de MOTOR-ANALISIS-NEGOCIO.md Paso 4.

export const section: QuestionSection = {
  id: "publico-objetivo",
  order: 10,
  title: "Público objetivo y experiencia del cliente",
};

export const questions: QuestionDefinition[] = [
  {
    id: "audience.description",
    sectionId: "publico-objetivo",
    order: 1,
    prompt: "Descríbenos a tu cliente ideal",
    helpText: "¿Quién toma tus clases hoy?",
    type: "long_text",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "business-profile.targetAudience",
    sensitivity: "public",
  },
  {
    id: "audience.urgent_need",
    sectionId: "publico-objetivo",
    order: 2,
    prompt: "¿Qué te urge resolver más ahora mismo?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "not_on_google", label: "No aparezco en Google" },
      { value: "same_questions", label: "Contesto las mismas preguntas todo el día" },
      { value: "old_site", label: "Mi sitio se ve viejo o no tengo" },
      { value: "sell_online", label: "Quiero vender en línea" },
      { value: "look_professional", label: "Quiero verme más profesional" },
    ],
    dataTarget: "business-profile.urgentNeed",
    sensitivity: "public",
  },
];
