import type {
  AnswersMap,
  QuestionCondition,
  QuestionDefinition,
  QuestionPack,
} from "./question-pack.types";

function evaluateCondition(condition: QuestionCondition, answers: AnswersMap): boolean {
  const answer = answers[condition.dependsOn];
  const value = answer?.value;

  switch (condition.operator) {
    case "answered":
      return answer !== undefined && answer.status !== "unanswered";
    case "notAnswered":
      return answer === undefined || answer.status === "unanswered";
    case "equals":
      return value === condition.value;
    case "notEquals":
      return value !== condition.value;
    case "includes":
      return Array.isArray(value) && value.includes(condition.value);
    default:
      return true;
  }
}

export function isQuestionVisible(question: QuestionDefinition, answers: AnswersMap): boolean {
  if (!question.conditions || question.conditions.length === 0) return true;
  return question.conditions.every((condition) => evaluateCondition(condition, answers));
}

export function getVisibleQuestions(
  pack: QuestionPack,
  sectionId: string,
  answers: AnswersMap,
): QuestionDefinition[] {
  return pack.questions
    .filter((q) => q.sectionId === sectionId)
    .filter((q) => isQuestionVisible(q, answers))
    .sort((a, b) => a.order - b.order);
}

export interface SectionProgress {
  total: number;
  resolved: number; // respondida, "no lo sé", o "completar después" — cualquier estado distinto de unanswered
  requiredTotal: number;
  requiredResolved: number;
  percent: number; // 0-100, sobre requiredTotal
}

export function computeSectionProgress(
  visibleQuestions: QuestionDefinition[],
  answers: AnswersMap,
): SectionProgress {
  const total = visibleQuestions.length;
  const required = visibleQuestions.filter((q) => q.required);

  const isResolved = (id: string) => {
    const status = answers[id]?.status;
    return status !== undefined && status !== "unanswered";
  };

  const resolved = visibleQuestions.filter((q) => isResolved(q.id)).length;
  const requiredResolved = required.filter((q) => isResolved(q.id)).length;

  return {
    total,
    resolved,
    requiredTotal: required.length,
    requiredResolved,
    percent: required.length === 0 ? 100 : Math.round((requiredResolved / required.length) * 100),
  };
}

export function isSectionComplete(visibleQuestions: QuestionDefinition[], answers: AnswersMap): boolean {
  const progress = computeSectionProgress(visibleQuestions, answers);
  return progress.requiredResolved === progress.requiredTotal;
}
