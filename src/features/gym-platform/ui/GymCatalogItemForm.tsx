"use client";

import { useActionState, useState } from "react";
import { createGymCatalogItem, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymBranchDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymCatalogItemForm({ subdomain, branches }: { subdomain: string; branches: GymBranchDTO[] }) {
  const [state, formAction, pending] = useActionState(createGymCatalogItem.bind(null, subdomain), initialState);
  const [itemType, setItemType] = useState("product");
  return <form action={formAction} className="gym-catalog-form">
    <header><p className="gym-panel-label">Nuevo concepto</p><h3>Agregar al catálogo</h3></header>
    <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
    <label>Nombre<input name="name" maxLength={120} placeholder="Ej. Bebida isotónica" required /></label>
    <label>Tipo<select name="itemType" value={itemType} onChange={(event) => setItemType(event.target.value)}><option value="product">Producto</option><option value="service">Servicio</option><option value="class_pack">Paquete de clases</option><option value="drop_in">Clase de visita</option></select></label>
    <label>SKU <small>opcional</small><input name="sku" maxLength={40} placeholder="BEB-ISO" /></label>
    <label>Precio MXN<input name="pricePesos" type="number" min="0" step="0.01" required /></label>
    <label>Costo MXN<input name="costPesos" type="number" min="0" step="0.01" defaultValue="0" /></label>
    <label>Inventario inicial<input name="initialQuantity" type="number" min="0" step="1" defaultValue="0" disabled={itemType !== "product"} /></label>
    <button disabled={pending || !branches.length}>{pending ? "Creando…" : "Crear concepto"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
