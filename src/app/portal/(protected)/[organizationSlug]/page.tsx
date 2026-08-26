import { notFound } from "next/navigation";
import { getPortalOrganization } from "@/features/portal/server/data";

const ROLE_LABELS = { owner: "Propietario", admin: "Administrador", member: "Miembro" } as const;
const STATUS_LABELS = { active: "Activa", suspended: "En pausa", archived: "Archivada" } as const;

export default async function PortalOrganizationPage({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const organization = await getPortalOrganization(organizationSlug);
  if (!organization) notFound();
  const platformUrl = organization.platform ? `https://${organization.platform.subdomain}.actiiva.mx` : null;
  const platformPublished = organization.platform?.status === "published";
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-success-surface px-3 py-1 text-xs font-medium text-success">Cuenta {STATUS_LABELS[organization.status]}</span>
            <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-secondary">{ROLE_LABELS[organization.role]}</span>
          </div>
          <p className="mt-7 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Tu centro de activación</p>
          <h1 className="mt-2 text-5xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl">{organization.name}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-secondary">Tu cuenta, sitio, operación y experiencia de clientes viven dentro de una misma plataforma privada.</p>
        </div>
        <div className="rounded-2xl bg-primary p-6 text-white">
          <p className="text-xs font-semibold tracking-[0.12em] text-white/55 uppercase">Estado actual</p>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{platformPublished ? "Plataforma activa" : organization.platform ? "En preparación" : "Acceso activado"}</p>
          <p className="mt-3 text-sm leading-6 text-white/65">{platformPublished ? `${organization.platform?.subdomain}.actiiva.mx ya está publicado.` : "Tu identidad y la cuenta quedaron conectadas de forma segura."}</p>
        </div>
      </header>
      <section className="py-10">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Ruta de trabajo</p><h2 className="mt-2 text-2xl font-semibold text-foreground">De información a operación</h2></div>
          <span className="font-mono text-xs text-muted">{platformPublished ? "4 / 4" : organization.platform ? "3 / 4" : "1 / 4"}</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ["01", "Cuenta", "Lista", true],
            ["02", "Presencia", organization.platform ? "Preparada" : "Pendiente", Boolean(organization.platform)],
            ["03", "Operación", organization.platform ? "Preparada" : "Pendiente", Boolean(organization.platform)],
            ["04", "Publicación", platformPublished ? "Lista" : "Pendiente", platformPublished],
          ].map(([number, title, state, active]) => (
            <article key={String(number)} className={`min-h-44 rounded-xl border p-5 ${active ? "border-primary bg-surface" : "border-border bg-surface/55"}`}>
              <span className={`font-mono text-xs ${active ? "text-primary" : "text-muted"}`}>{number}</span>
              <h3 className="mt-8 text-lg font-semibold text-foreground">{title}</h3>
              <p className={`mt-2 text-sm ${active ? "text-success" : "text-muted"}`}>{state}</p>
            </article>
          ))}
        </div>
        {platformPublished && platformUrl ? (
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <a href={platformUrl} className="rounded-xl bg-primary p-5 text-white"><span className="text-xs text-white/55">Presencia online</span><strong className="mt-5 flex items-center justify-between">Abrir sitio <span>↗</span></strong></a>
            <a href={`${platformUrl}/mi-cuenta`} className="rounded-xl border border-border bg-surface p-5"><span className="text-xs text-muted">Experiencia de socios</span><strong className="mt-5 flex items-center justify-between text-foreground">Portal de clientes <span>↗</span></strong></a>
            <a href={`${platformUrl}/gestion`} className="rounded-xl border border-border bg-surface p-5"><span className="text-xs text-muted">Operación diaria</span><strong className="mt-5 flex items-center justify-between text-foreground">Panel de gestión <span>↗</span></strong></a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
