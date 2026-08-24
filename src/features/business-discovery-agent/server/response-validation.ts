import { questionPackActiiva } from "../packs/actiiva";
import type { QuestionDefinition, ResponseStatus } from "../engine/question-pack.types";
import { containsSensitiveFinancialNumber } from "./content-safety";

const CLIENT_RESPONSE_STATUSES = new Set<ResponseStatus>([
  "draft",
  "flagged_missing",
  "unknown",
]);

export type ValidatedResponse = {
  question: QuestionDefinition;
  value: unknown;
  status: ResponseStatus;
};

export function validateDiscoveryResponse(input: {
  questionId: string;
  value: unknown;
  status: ResponseStatus;
}): { ok: true; data: ValidatedResponse } | { ok: false; error: string } {
  const question = questionPackActiiva.questions.find((item) => item.id === input.questionId);
  if (!question) return { ok: false, error: "La pregunta no pertenece al pack activo." };
  if (!CLIENT_RESPONSE_STATUSES.has(input.status)) {
    return { ok: false, error: "El estado de la respuesta no es válido." };
  }

  if (input.status === "flagged_missing" || input.status === "unknown") {
    return { ok: true, data: { question, value: null, status: input.status } };
  }

  const value = input.value;
  switch (question.type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string" || !value.trim()) {
        return { ok: false, error: "La respuesta debe contener texto." };
      }
      const maxLength = question.type === "short_text" ? 500 : 5_000;
      if (value.length > maxLength) return { ok: false, error: "La respuesta es demasiado larga." };
      if (containsSensitiveFinancialNumber(value)) {
        return { ok: false, error: "No guardamos números de tarjeta, cuenta o CLABE en este formulario." };
      }
      break;
    }
    case "yes_no":
      if (typeof value !== "boolean") return { ok: false, error: "La respuesta debe ser sí o no." };
      break;
    case "quick_options": {
      const allowed = new Set(question.options?.map((option) => option.value) ?? []);
      if (typeof value !== "string" || !allowed.has(value)) {
        return { ok: false, error: "La opción seleccionada no es válida." };
      }
      break;
    }
    case "multi_select": {
      const allowed = new Set(question.options?.map((option) => option.value) ?? []);
      if (!Array.isArray(value) || value.length > allowed.size || value.some((item) => typeof item !== "string" || !allowed.has(item))) {
        return { ok: false, error: "Una o más opciones seleccionadas no son válidas." };
      }
      break;
    }
    case "editable_table": {
      const columns = new Set(question.tableSchema?.columns.map((column) => column.key) ?? []);
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        value.some(
          (row) =>
            typeof row !== "object" ||
            row === null ||
            Array.isArray(row) ||
            Object.entries(row).some(
              ([key, cell]) =>
                !columns.has(key) ||
                !["string", "number"].includes(typeof cell) ||
                (typeof cell === "string" && cell.length > 500),
            ),
        )
      ) {
        return { ok: false, error: "La tabla contiene filas o columnas no válidas." };
      }
      break;
    }
    case "file_upload":
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        return { ok: false, error: "La referencia del archivo no es válida." };
      }
      break;
  }

  return { ok: true, data: { question, value, status: input.status } };
}

export function validateDiscoveryFile(questionId: string, file: File):
  | { ok: true; question: QuestionDefinition }
  | { ok: false; error: string } {
  const question = questionPackActiiva.questions.find((item) => item.id === questionId);
  if (!question || question.type !== "file_upload" || !question.fileConstraint) {
    return { ok: false, error: "El destino del archivo no es válido." };
  }

  if (!question.fileConstraint.accept.includes(file.type)) {
    return { ok: false, error: "Este tipo de archivo no está permitido." };
  }
  if (file.size <= 0 || file.size > question.fileConstraint.maxSizeMb * 1024 * 1024) {
    return { ok: false, error: `El archivo debe pesar menos de ${question.fileConstraint.maxSizeMb} MB.` };
  }

  return { ok: true, question };
}
