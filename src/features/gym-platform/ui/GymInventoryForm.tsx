"use client";

import { useActionState } from "react";
import { adjustGymInventory, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymBranchDTO, GymCatalogItemDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };

export function GymInventoryForm({ subdomain, branches, items }: { subdomain: string; branches: GymBranchDTO[]; items: GymCatalogItemDTO[] }) {
  const action = adjustGymInventory.bind(null, subdomain);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="gym-inventory-form">
    <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
    <label>Producto<select name="catalogItemId" required>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.inventoryQuantity ?? 0} actuales</option>)}</select></label>
    <label>Movimiento<input name="quantityDelta" type="number" step="1" placeholder="+12 o -2" required /></label>
    <label>Motivo<input name="note" maxLength={300} placeholder="Compra a proveedor, merma…" /></label>
    <button disabled={pending || !items.length}>{pending ? "Guardando…" : "Ajustar existencias"}</button>
    {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}</p> : null}
  </form>;
}
