"use client";

import { useState, useTransition } from "react";
import { requestReopen } from "../server/chat-actions";
import { UsersSignature } from "./UsersSignature";

interface DiscoverySessionLockedScreenProps {
  sessionId: string;
  alreadyRequested: boolean;
}

// Se renderiza server-side (page.tsx llama a computeSessionLockState antes
// de decidir qué pantalla mandar) — este componente solo maneja el botón de
// solicitud y su estado optimista, no vuelve a evaluar el bloqueo. Autorizar
// de verdad requiere una acción del dueño del proyecto fuera de esta UI
// (scripts/authorize-reopen.ts) — no hay forma de autoextenderse desde aquí.
export function DiscoverySessionLockedScreen({ sessionId, alreadyRequested }: DiscoverySessionLockedScreenProps) {
  const [requested, setRequested] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestReopen(sessionId);
      if (result.ok) setRequested(true);
      else setError(result.error);
    });
  }

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col justify-between bg-canvas p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <img src="/brand/actiiva-symbol-primary.svg" alt="ACTIIVA" className="h-10 w-auto" />
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-foreground">Se cerró la ventana para ajustes</h1>
          {requested ? (
            <p className="text-base text-secondary">
              Ya enviamos tu solicitud. En cuanto la aprobemos, vas a poder seguir aquí mismo, con este mismo link
              — no necesitas hacer nada más por ahora.
            </p>
          ) : (
            <p className="text-base text-secondary">
              Ya pasaron los días que teníamos para hacer ajustes a la configuración de tu negocio. Si necesitas
              corregir o agregar algo, puedes solicitar que te reabramos el acceso.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-col items-center gap-4">
        {!requested && (
          <button
            type="button"
            onClick={handleRequest}
            disabled={isPending}
            className="h-12 w-full rounded-md bg-primary text-sm font-medium text-white disabled:opacity-40"
          >
            {isPending ? "Enviando..." : "Solicitar reapertura"}
          </button>
        )}
        <UsersSignature />
      </div>
    </div>
  );
}
