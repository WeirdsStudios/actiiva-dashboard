import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

export const section: QuestionSection = {
  id: "equipo",
  order: 7,
  title: "Equipo, coaches y administradores",
};

export const questions: QuestionDefinition[] = [
  {
    id: "team.roster",
    sectionId: "equipo",
    order: 1,
    prompt: "Cuéntanos quién trabaja contigo",
    helpText: "Nombre y rol de cada persona (coach, recepción, administración...).",
    type: "editable_table",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    tableSchema: {
      minRows: 1,
      columns: [
        { key: "name", label: "Nombre", type: "text" },
        { key: "role", label: "Rol", type: "text" },
      ],
    },
    dataTarget: "team.roster",
    sensitivity: "internal",
  },
  {
    id: "team.system_access_count",
    sectionId: "equipo",
    order: 2,
    prompt: "¿Cuántos coaches necesitan acceso al sistema?",
    helpText: "Para ver su calendario, marcar asistencia, etc.",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: true,
    conditions: [{ dependsOn: "biz.employee_range", operator: "notEquals", value: "1_5" }],
    dataTarget: "team.systemAccessCount",
    sensitivity: "internal",
  },
];
