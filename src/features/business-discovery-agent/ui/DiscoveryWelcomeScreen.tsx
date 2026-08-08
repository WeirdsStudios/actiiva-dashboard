import { UsersSignature } from "./UsersSignature";

interface DiscoveryWelcomeScreenProps {
  onStart: () => void;
}

// Pantalla previa al primer mensaje del agente — la nota de duración y
// privacidad vive aquí como UI real, no solo como texto que el modelo tiene
// que repetir igual cada vez (ver system-prompt.ts, que sigue mandando la
// misma nota como respaldo conversacional si el usuario vuelve a preguntar).
//
// A propósito NO recibe el nombre del negocio: el agente ya lo pregunta como
// su primer tema real (biz.name), así que pedirlo aquí solo duplicaría el
// dato y obligaría a quien crea el link a teclearlo de antemano — un paso
// manual extra por cada cliente nuevo que no aporta nada (ver
// scripts/create-discovery-session.ts, que ya no lo requiere).
export function DiscoveryWelcomeScreen({ onStart }: DiscoveryWelcomeScreenProps) {
  return (
    <div className="mx-auto flex h-screen max-w-md flex-col justify-between bg-canvas p-6">
      <div className="flex flex-1 flex-col justify-center gap-8">
        {/* Lockup con descriptor, al ancho completo del recuadro de texto de
            abajo: el contenedor mide muy por arriba de 280px renderizados
            (rule 9 de README_AI_IMPLEMENTATION.md), así que mostrar el
            descriptor a este ancho es correcto.

            h-20 + object-contain (no solo w-full): actiiva-lockup-primary.svg
            no trae width/height en su <svg> raíz, solo viewBox. Un <img> con
            width:100% y height:auto (lo que w-full solo produce) hace que el
            navegador falle al derivar el aspect ratio desde el viewBox y
            renderiza el SVG varias veces más grande que su contenedor — lo
            reproduje en pantalla (~4x, rompía todo el layout). Fijar una
            altura CSS explícita (h-20) le da al navegador una caja con las
            dos dimensiones definidas; object-contain escala el contenido
            real adentro sin depender de ese cálculo de intrínseco. Mismo
            riesgo no aplica a los demás <img> de marca del proyecto porque
            todos usan altura fija (h-7, h-2.5) en vez de ancho porcentual. */}
        <img
          src="/brand/actiiva-lockup-primary.svg"
          alt="ACTIIVA — Gestión de negocios fitness"
          className="mx-auto h-20 w-full object-contain"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold text-foreground">Vamos a configurar tu negocio</h1>
          <p className="text-base text-secondary">
            Te voy a hacer algunas preguntas por chat para entender cómo opera tu negocio, y con eso armo tu cuenta
            y tu sitio web.
          </p>

          <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-left">
            <div className="flex gap-3">
              <span className="mt-0.5 text-lg">⏱️</span>
              <p className="text-sm text-secondary">
                Esto normalmente toma entre <span className="text-foreground">15 y 20 minutos</span>, y puedes
                pausar cuando quieras — lo que ya contestes queda guardado.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 text-lg">🔒</span>
              <p className="text-sm text-secondary">
                Esta información se usa solo para configurar tu cuenta y tu sitio — nadie más la ve. Nunca te vamos
                a pedir números de cuenta ni contraseñas de nada.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onStart}
          className="h-12 w-full rounded-md bg-primary text-sm font-medium text-white transition-colors duration-[var(--motion-base)]"
        >
          Empezar
        </button>
        <UsersSignature />
      </div>
    </div>
  );
}
