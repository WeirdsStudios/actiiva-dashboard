import { UsersSignature } from "./UsersSignature";

interface DiscoverySessionPausedScreenProps {
  onResume: () => void;
}

// Puramente un cambio de vista del lado del cliente — no dispara ningún
// guardado nuevo (todo ya se persiste turno por turno, ver
// ai/conversation-store.ts) ni ningún tool call. Solo existe para la
// tranquilidad visual de "sí quedó guardado" que pedía el hallazgo #10.1 del
// audit original. Reabrir después no requiere nada especial de esta pantalla
// — cualquier mensaje nuevo en el mismo link revive la sesión (ver
// reopenDiscoverySessionIfSubmitted en server/actions.ts).
export function DiscoverySessionPausedScreen({ onResume }: DiscoverySessionPausedScreenProps) {
  return (
    <div className="mx-auto flex h-screen max-w-md flex-col justify-between bg-canvas p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <img src="/brand/actiiva-symbol-primary.svg" alt="ACTIIVA" className="h-10 w-auto" />
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-foreground">Tu progreso quedó guardado</h1>
          <p className="text-base text-secondary">
            Puedes cerrar esta pantalla cuando quieras. Para seguir, abre otra vez este mismo link — vas a
            continuar justo donde te quedaste, no se pierde nada.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onResume}
          className="h-12 w-full rounded-md bg-primary text-sm font-medium text-white transition-colors duration-[var(--motion-base)]"
        >
          Continuar ahora
        </button>
        <UsersSignature />
      </div>
    </div>
  );
}
