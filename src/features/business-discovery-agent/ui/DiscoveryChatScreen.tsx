"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { QuestionDefinition } from "../engine/question-pack.types";
import { type ChatTurnView, sendChatMessage, startConversation } from "../server/chat-actions";
import { DiscoveryWelcomeScreen } from "./DiscoveryWelcomeScreen";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { UsersSignature } from "./UsersSignature";

interface DiscoveryChatScreenProps {
  sessionId: string;
  businessNameDraft: string | null;
  fileUploadQuestions: QuestionDefinition[];
  initialHistory: ChatTurnView[];
}

export function DiscoveryChatScreen({
  sessionId,
  businessNameDraft,
  fileUploadQuestions,
  initialHistory,
}: DiscoveryChatScreenProps) {
  const [hasStarted, setHasStarted] = useState(initialHistory.length > 0);
  const [messages, setMessages] = useState<ChatTurnView[]>(initialHistory);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileQuestionId, setFileQuestionId] = useState<string>(fileUploadQuestions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const kickoffSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  function handleStart() {
    setHasStarted(true);
    if (kickoffSentRef.current) return;
    kickoffSentRef.current = true;
    startTransition(async () => {
      const result = await startConversation(sessionId);
      if (result.ok) setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
      else setError(result.error);
    });
  }

  function handleSend() {
    if (!input.trim() && !pendingFile) return;
    setError(null);

    const formData = new FormData();
    if (input.trim()) formData.set("message", input.trim());
    if (pendingFile) {
      formData.set("file", pendingFile);
      formData.set("fileQuestionId", fileQuestionId);
    }

    const optimisticText = input.trim() || `Adjunté: ${pendingFile?.name}`;
    setMessages((prev) => [...prev, { role: "user", text: optimisticText }]);
    setInput("");
    setPendingFile(null);

    startTransition(async () => {
      const result = await sendChatMessage(sessionId, formData);
      if (result.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: result.reply, savedCount: result.savedCount }]);
      } else {
        setError(result.error);
      }
    });
  }

  if (!hasStarted) {
    return <DiscoveryWelcomeScreen onStart={handleStart} />;
  }

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col bg-canvas">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <img src="/brand/actiiva-symbol-primary.svg" alt="ACTIIVA" className="h-7 w-auto" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">Configuración de tu negocio</span>
          {businessNameDraft && <span className="text-xs text-muted">{businessNameDraft}</span>}
        </div>
      </header>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="flex max-w-[85%] items-end gap-2 self-start">
              <img src="/brand/actiiva-app-icon-light.svg" alt="" className="h-7 w-7 shrink-0 rounded-[8px]" />
              <div className="flex flex-col gap-1">
                <div className="rounded-lg bg-surface px-4 py-2 text-sm whitespace-pre-wrap text-foreground">
                  {m.text}
                </div>
                {!!m.savedCount && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-signal-soft px-2 py-0.5 text-xs text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--actiiva-lumen-haze)" }} />
                    {m.savedCount === 1 ? "1 dato guardado" : `${m.savedCount} datos guardados`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="max-w-[85%] self-end rounded-lg bg-primary px-4 py-2 text-sm whitespace-pre-wrap text-white"
            >
              {m.text}
            </div>
          ),
        )}
        {isPending && <ThinkingIndicator />}
      </div>

      {error && <p className="px-4 pb-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-2 border-t border-border bg-canvas p-4">
        {pendingFile && (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span className="truncate">{pendingFile.name}</span>
            {fileUploadQuestions.length > 0 && (
              <select
                value={fileQuestionId}
                onChange={(e) => setFileQuestionId(e.target.value)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
              >
                {fileUploadQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.prompt}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="flex h-9 items-center rounded-md px-2 text-danger"
            >
              Quitar
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-lg text-secondary">
            +
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Escribe tu respuesta..."
            className="h-11 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Enviar
          </button>
        </div>

        <div className="flex justify-center pt-1">
          <UsersSignature />
        </div>
      </div>
    </div>
  );
}
