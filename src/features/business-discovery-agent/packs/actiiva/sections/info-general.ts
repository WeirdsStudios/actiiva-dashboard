import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

// El set de campos reutiliza el Paso 1 ya validado en MOTOR-ANALISIS-NEGOCIO.md
// (nombre, giro, años operando, empleados, sucursales), adaptando "giro" a tipo
// de negocio fitness porque este pack es solo para ACTIIVA.

export const section: QuestionSection = {
  id: "info-general",
  order: 1,
  title: "Información general del negocio",
};

export const questions: QuestionDefinition[] = [
  {
    id: "biz.name",
    sectionId: "info-general",
    order: 1,
    prompt: "¿Cómo se llama tu negocio?",
    helpText: "El nombre con el que tus clientes ya te conocen.",
    type: "short_text",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    dataTarget: "business-profile.name",
    sensitivity: "public",
  },
  {
    id: "biz.type",
    sectionId: "info-general",
    order: 2,
    prompt: "¿Qué tipo de negocio fitness es?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "gym", label: "Gimnasio tradicional" },
      { value: "boutique_studio", label: "Estudio boutique (yoga, pilates, spinning...)" },
      { value: "crossfit_box", label: "Box de crossfit o funcional" },
      { value: "independent_trainer", label: "Entrenador(a) personal independiente" },
      { value: "multidisciplinary_center", label: "Centro multidisciplina" },
      { value: "other", label: "Otro" },
    ],
    dataTarget: "business-profile.businessType",
    sensitivity: "public",
  },
  {
    id: "biz.years_operating",
    sectionId: "info-general",
    order: 3,
    prompt: "¿Cuánto tiempo llevas operando?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: true,
    options: [
      { value: "lt_1", label: "Menos de 1 año" },
      { value: "1_3", label: "1-3 años" },
      { value: "3_10", label: "3-10 años" },
      { value: "gt_10", label: "Más de 10 años" },
    ],
    dataTarget: "business-profile.yearsOperating",
    sensitivity: "public",
  },
  {
    id: "biz.employee_range",
    sectionId: "info-general",
    order: 4,
    prompt: "¿Cuántas personas trabajan en el negocio, incluyéndote?",
    type: "quick_options",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    options: [
      { value: "1_5", label: "1-5" },
      { value: "6_15", label: "6-15" },
      { value: "16_50", label: "16-50" },
      { value: "gt_50", label: "Más de 50" },
    ],
    dataTarget: "business-profile.employeeRange",
    sensitivity: "internal",
  },
  {
    id: "biz.location_count",
    sectionId: "info-general",
    order: 5,
    prompt: "¿Cuántas sucursales o ubicaciones tienen?",
    type: "quick_options",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    options: [
      { value: "1", label: "1" },
      { value: "2_3", label: "2-3" },
      { value: "gt_4", label: "4 o más" },
    ],
    dataTarget: "business-profile.locationCount",
    sensitivity: "public",
  },
];
