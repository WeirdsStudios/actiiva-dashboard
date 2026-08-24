"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswersMap, QuestionDefinition, QuestionPack, ResponseStatus } from "../engine/question-pack.types";
import { computeSectionProgress, getVisibleQuestions, isSectionComplete } from "../engine/session-runtime";
import { QuestionRenderer } from "./QuestionRenderer";
import { ProgressBar } from "./ProgressBar";
import { confirmDraftResponses, saveResponse } from "../server/actions";

const DEBOUNCED_TYPES: QuestionDefinition["type"][] = ["short_text", "long_text"];
const SAVE_DEBOUNCE_MS = 800;

interface DiscoverySectionScreenProps {
  pack: QuestionPack;
  sectionId: string;
  sessionId: string;
  accessToken: string;
  initialAnswers: AnswersMap;
}

export function DiscoverySectionScreen({ pack, sectionId, sessionId, accessToken, initialAnswers }: DiscoverySectionScreenProps) {
  const section = pack.sections.find((s) => s.id === sectionId);
  const [answers, setAnswers] = useState<AnswersMap>(initialAnswers);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  const visibleQuestions = useMemo(
    () => getVisibleQuestions(pack, sectionId, answers),
    [pack, sectionId, answers],
  );

  const progress = computeSectionProgress(visibleQuestions, answers);
  const currentQuestion = visibleQuestions[questionIndex];

  function persist(questionId: string, questionSectionId: string, value: unknown, status: ResponseStatus) {
    void questionSectionId;
    saveResponse({ sessionId, accessToken, questionId, value, status })
      .then((result) => setSaveError(!result.ok))
      .catch(() => setSaveError(true));
  }

  function setAnswer(question: QuestionDefinition, value: unknown, status: ResponseStatus, immediate = false) {
    setAnswers((prev) => ({ ...prev, [question.id]: { value, status } }));

    if (debounceTimers.current[question.id]) {
      clearTimeout(debounceTimers.current[question.id]);
    }

    if (!immediate && DEBOUNCED_TYPES.includes(question.type)) {
      debounceTimers.current[question.id] = setTimeout(
        () => persist(question.id, question.sectionId, value, status),
        SAVE_DEBOUNCE_MS,
      );
    } else {
      persist(question.id, question.sectionId, value, status);
    }
  }

  function goNext() {
    const next = questionIndex + 1;
    if (next < visibleQuestions.length) {
      setQuestionIndex(next);
    } else {
      setShowSummary(true);
    }
  }

  function goToQuestion(index: number) {
    setShowSummary(false);
    setQuestionIndex(index);
  }

  async function confirmSection() {
    const draftIds = visibleQuestions.filter((q) => answers[q.id]?.status === "draft").map((q) => q.id);

    setAnswers((prev) => {
      const next = { ...prev };
      for (const id of draftIds) next[id] = { ...next[id], status: "owner_confirmed" };
      return next;
    });

    if (draftIds.length > 0) {
      const result = await confirmDraftResponses(sessionId, accessToken, draftIds);
      setSaveError(!result.ok);
    }
  }

  if (!section) {
    return <p className="text-sm text-muted">Sección &ldquo;{sectionId}&rdquo; no existe en este pack.</p>;
  }

  if (showSummary || !currentQuestion) {
    const allConfirmed = isSectionComplete(visibleQuestions, answers);

    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas p-6">
        <ProgressBar percent={progress.percent} label={section.title} />

        <h1 className="text-xl font-semibold text-foreground">Resumen de esta sección</h1>

        <div className="flex flex-col gap-3">
          {visibleQuestions.map((q, index) => {
            const answer = answers[q.id];
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goToQuestion(index)}
                className="rounded-lg border border-border bg-surface p-4 text-left"
              >
                <p className="text-sm text-secondary">{q.prompt}</p>
                <p className="mt-1 text-base text-foreground">
                  {formatAnswerPreview(answer, q)}
                </p>
              </button>
            );
          })}
        </div>

        {saveError && (
          <p className="text-sm text-danger">No se pudo guardar el último cambio. Revisa tu conexión.</p>
        )}

        <button
          type="button"
          disabled={!allConfirmed}
          onClick={confirmSection}
          className="h-11 rounded-md bg-primary text-sm font-medium text-white disabled:opacity-40"
        >
          Confirmar y continuar
        </button>
      </div>
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const canContinue =
    !currentQuestion.required ||
    (currentAnswer !== undefined && currentAnswer.status !== "unanswered");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-canvas p-6">
      <ProgressBar percent={progress.percent} label={section.title} />

      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{currentQuestion.prompt}</h1>
          {currentQuestion.helpText && (
            <p className="mt-1 text-sm text-muted">{currentQuestion.helpText}</p>
          )}
        </div>

        <QuestionRenderer
          question={currentQuestion}
          sessionId={sessionId}
          accessToken={accessToken}
          value={currentAnswer?.value}
          onChange={(value) => setAnswer(currentQuestion, value, "draft")}
        />

        {saveError && (
          <p className="text-sm text-danger">No se pudo guardar el último cambio. Revisa tu conexión.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canContinue}
          onClick={goNext}
          className="h-11 rounded-md bg-primary text-sm font-medium text-white disabled:opacity-40"
        >
          Siguiente
        </button>

        <div className="flex gap-2">
          {currentQuestion.allowUnknown && (
            <button
              type="button"
              onClick={() => {
                setAnswer(currentQuestion, undefined, "unknown", true);
                goNext();
              }}
              className="h-10 flex-1 rounded-md border border-border text-sm text-secondary"
            >
              No lo sé todavía
            </button>
          )}
          {currentQuestion.allowSkip && (
            <button
              type="button"
              onClick={() => {
                setAnswer(currentQuestion, undefined, "flagged_missing", true);
                goNext();
              }}
              className="h-10 flex-1 rounded-md border border-border text-sm text-secondary"
            >
              Completar después
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAnswerPreview(
  answer: AnswersMap[string] | undefined,
  question: QuestionDefinition,
): string {
  if (!answer || answer.status === "unanswered") return "Sin responder";
  if (answer.status === "unknown") return "No lo sé todavía";
  if (answer.status === "flagged_missing") return "Pendiente — completar después";
  if (question.options) {
    const option = question.options.find((o) => o.value === answer.value);
    if (option) return option.label;
  }
  if (typeof answer.value === "string") return answer.value;
  return JSON.stringify(answer.value);
}
