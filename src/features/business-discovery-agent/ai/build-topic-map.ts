import { questionPackActiiva } from "../packs/actiiva";
import type { QuestionCondition, QuestionDefinition } from "../engine/question-pack.types";

function describeConditions(conditions: QuestionCondition[] | undefined): string {
  if (!conditions || conditions.length === 0) return "";
  const parts = conditions.map((c) => `${c.dependsOn} ${c.operator} ${JSON.stringify(c.value ?? "")}`);
  return ` (solo si ${parts.join(" y ")})`;
}

// Sin esto, el modelo tenía que ADIVINAR el value exacto de una opción o las
// llaves de una tabla — y lo hacía mal (ej. guardó "1_3_years" en vez del
// "1_3" real del pack). Cualquier consumidor que compare por value exacto
// (session-runtime.ts, y sobre todo el futuro agente que arma el sitio/
// plataforma a partir de discovery_responses) necesita que esto sea preciso,
// no aproximado. Ver hallazgo verificado en conversación del 08-ago-2026.
function describeValueShape(question: QuestionDefinition): string {
  if (question.options && question.options.length > 0) {
    const values = question.options.map((o) => o.value).join(", ");
    return ` | valores válidos exactos: ${values}`;
  }
  if (question.tableSchema) {
    const keys = question.tableSchema.columns.map((c) => c.key).join(", ");
    return ` | llaves de columna exactas: ${keys}`;
  }
  return "";
}

// Serializa questionPackActiiva a un bloque de texto compacto para el system
// prompt — una sola fuente de verdad (packs/actiiva/sections/*.ts), no un
// guion duplicado a mano. Si el pack cambia, el prompt se actualiza solo en
// el siguiente request. Ver docs/business-discovery-agent/AI-AGENT-DESIGN.md §4.3.
export function buildTopicMapBlock(): string {
  const sections = [...questionPackActiiva.sections].sort((a, b) => a.order - b.order);

  return sections
    .map((section) => {
      const questions = questionPackActiiva.questions
        .filter((q) => q.sectionId === section.id)
        .sort((a, b) => a.order - b.order);

      const lines = questions.map((q) => {
        const flags = [q.required ? "obligatoria" : "opcional", q.allowUnknown ? "permite 'no sé'" : null]
          .filter(Boolean)
          .join(", ");
        return `  - ${q.id} [${q.type}, ${flags}]: ${q.prompt}${describeConditions(q.conditions)}${describeValueShape(q)}`;
      });

      return `${section.title} (sección "${section.id}"):\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
