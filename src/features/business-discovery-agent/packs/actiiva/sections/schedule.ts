import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

export const section: QuestionSection = {
  id: "horarios-reservas",
  order: 6,
  title: "Horarios, clases, reservas y capacidad",
};

export const questions: QuestionDefinition[] = [
  {
    id: "schedule.weekly_table",
    sectionId: "horarios-reservas",
    order: 1,
    prompt: "Cuéntanos tu horario semanal",
    helpText: "Agrega una fila por cada clase o sesión que ofrezcas.",
    type: "editable_table",
    required: true,
    allowSkip: true,
    allowUnknown: false,
    tableSchema: {
      minRows: 1,
      columns: [
        { key: "day", label: "Día", type: "text" },
        { key: "class_name", label: "Clase", type: "text" },
        { key: "time", label: "Hora", type: "time" },
        { key: "capacity", label: "Cupo máximo", type: "number" },
      ],
    },
    dataTarget: "schedules.weeklyClasses",
    sensitivity: "public",
  },
  {
    id: "schedule.booking_method",
    sectionId: "horarios-reservas",
    order: 2,
    prompt: "¿Cómo reservan tus clientes hoy?",
    type: "quick_options",
    required: true,
    allowSkip: false,
    allowUnknown: false,
    options: [
      { value: "online", label: "Reservan en línea" },
      { value: "whatsapp_call", label: "Solo por WhatsApp o llamada" },
      { value: "walk_in", label: "Llegan sin reservar" },
    ],
    dataTarget: "schedules.bookingMethod",
    sensitivity: "public",
  },
  {
    id: "schedule.cancellation_policy",
    sectionId: "horarios-reservas",
    order: 3,
    prompt: "¿Cuál es tu política de cancelación de clases?",
    type: "long_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "schedules.cancellationPolicy",
    sensitivity: "public",
  },
];
