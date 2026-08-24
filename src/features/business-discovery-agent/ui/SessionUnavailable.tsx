interface SessionUnavailableProps {
  reason: "not_found" | "expired" | "approved";
}

export function SessionUnavailable({ reason }: SessionUnavailableProps) {
  const message = reason === "expired"
    ? "Este link ya expiró. Pide que te compartan uno nuevo."
    : reason === "approved"
      ? "La información de este negocio ya fue aprobada. Si necesitas hacer un cambio, contacta a ACTIIVA."
      : "Este link no es válido.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <p className="max-w-sm text-center text-base text-secondary">{message}</p>
    </div>
  );
}
