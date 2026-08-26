"use client";

import { useActionState } from "react";
import {
  provisionOrganizationPlatform,
  publishOrganizationPlatform,
  type PlatformProvisioningActionState,
} from "../server/actions";

const initialState: PlatformProvisioningActionState = { ok: false };

export interface PlatformReadinessItem {
  key: string;
  label: string;
  detail: string;
  ready: boolean;
}

export interface AdminPlatformView {
  subdomain: string;
  status: "draft" | "published" | "paused";
  provisionedAt: string | null;
  publishedAt: string | null;
  readiness: PlatformReadinessItem[];
  canPublish: boolean;
}

export function PlatformProvisioningPanel({
  organizationId,
  sourceSessionId,
  suggestedSubdomain,
  previewPlanCount,
  previewClassCount,
  platform,
}: {
  organizationId: string;
  sourceSessionId: string | null;
  suggestedSubdomain: string;
  previewPlanCount: number;
  previewClassCount: number;
  platform: AdminPlatformView | null;
}) {
  const provisionAction = sourceSessionId
    ? provisionOrganizationPlatform.bind(null, organizationId, sourceSessionId)
    : null;
  const [provisionState, submitProvision, provisioning] = useActionState(provisionAction ?? unavailableProvision, initialState);
  const [publishState, submitPublication, publishing] = useActionState(publishOrganizationPlatform.bind(null, organizationId), initialState);

  if (!platform) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-primary p-6 text-white">
          <p className="text-xs font-semibold tracking-[0.14em] text-white/55 uppercase">Siguiente hito</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Crear plataforma</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">Convierte la información aprobada en un borrador aislado antes de hacerlo público.</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-canvas p-4"><strong className="block text-2xl text-foreground">{previewPlanCount}</strong><span className="text-xs text-muted">planes detectados</span></div>
            <div className="rounded-xl bg-canvas p-4"><strong className="block text-2xl text-foreground">{previewClassCount}</strong><span className="text-xs text-muted">clases detectadas</span></div>
          </div>
          <form action={submitProvision} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-foreground" htmlFor="platform-subdomain">
              Dirección del negocio
              <div className="mt-2 flex h-12 overflow-hidden rounded-lg border border-border focus-within:border-secondary">
                <input id="platform-subdomain" name="subdomain" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={63} defaultValue={suggestedSubdomain} className="min-w-0 flex-1 bg-surface px-3 font-mono text-sm outline-none" />
                <span className="flex items-center border-l border-border bg-canvas px-3 text-xs text-muted">.actiiva.mx</span>
              </div>
            </label>
            <label className="block text-sm font-medium text-foreground" htmlFor="platform-owner-email">
              Correo del propietario
              <input id="platform-owner-email" name="ownerEmail" type="email" autoComplete="email" required placeholder="dueno@negocio.mx" className="mt-2 h-12 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-secondary" />
            </label>
            {!sourceSessionId ? <p className="rounded-lg bg-warning-surface px-3 py-3 text-sm text-warning">Este cliente todavía no tiene un onboarding aprobado disponible.</p> : null}
            {provisionState.message ? <p className={`rounded-lg px-3 py-3 text-sm ${provisionState.ok ? "bg-success-surface text-success" : "bg-danger-surface text-danger"}`}>{provisionState.message}</p> : null}
            <button type="submit" disabled={provisioning || !sourceSessionId} className="h-12 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              {provisioning ? "Preparando plataforma…" : "Preparar plataforma e invitar"}
            </button>
            <p className="text-xs leading-5 text-muted">Se crea como borrador. Nada será público hasta que la lista de preparación esté completa.</p>
          </form>
        </div>
      </section>
    );
  }

  const baseUrl = `https://${platform.subdomain}.actiiva.mx`;
  const isPublished = platform.status === "published";
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className={`border-b p-6 ${isPublished ? "border-success/20 bg-success-surface" : "border-border bg-primary text-white"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold tracking-[0.14em] uppercase ${isPublished ? "text-success" : "text-white/55"}`}>Plataforma fitness</p>
            <h2 className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${isPublished ? "text-foreground" : "text-white"}`}>{isPublished ? "Publicada" : "Borrador preparado"}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPublished ? "bg-success text-white" : "bg-white/10 text-white"}`}>{platform.subdomain}</span>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Ruta de lanzamiento</p>
        <ul className="mt-4 space-y-2">
          {platform.readiness.map((item) => (
            <li key={item.key} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl border border-border p-3">
              <span aria-hidden className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${item.ready ? "bg-success-surface text-success" : "bg-warning-surface text-warning"}`}>{item.ready ? "✓" : "·"}</span>
              <div><strong className="block text-sm text-foreground">{item.label}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{item.detail}</span></div>
            </li>
          ))}
        </ul>

        {isPublished ? (
          <div className="mt-5 grid gap-2">
            <a href={baseUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-between rounded-lg bg-primary px-4 text-sm font-semibold text-white">Sitio público <span>↗</span></a>
            <a href={`${baseUrl}/mi-cuenta`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-between rounded-lg border border-border px-4 text-sm font-semibold text-secondary">Portal de clientes <span>↗</span></a>
            <a href={`${baseUrl}/gestion`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-between rounded-lg border border-border px-4 text-sm font-semibold text-secondary">Gestión del negocio <span>↗</span></a>
          </div>
        ) : (
          <form action={submitPublication} className="mt-5">
            {publishState.message ? <p className={`mb-3 rounded-lg px-3 py-3 text-sm ${publishState.ok ? "bg-success-surface text-success" : "bg-danger-surface text-danger"}`}>{publishState.message}</p> : null}
            <button type="submit" disabled={publishing || !platform.canPublish} className="h-12 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40">
              {publishing ? "Publicando…" : platform.canPublish ? "Publicar las tres experiencias" : "Completa los requisitos para publicar"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

async function unavailableProvision(
  _state: PlatformProvisioningActionState,
  _formData: FormData,
): Promise<PlatformProvisioningActionState> {
  void _state;
  void _formData;
  return { ok: false, message: "Primero aprueba y vincula un onboarding." };
}
