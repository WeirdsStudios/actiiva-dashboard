"use client";

import { useActionState, useMemo, useState } from "react";
import { recordGymSale, type GymActionState } from "@/features/gym-platform/server/actions";
import type { GymBranchDTO, GymCatalogItemDTO, GymCustomerDTO } from "@/features/gym-platform/server/data";

const initialState: GymActionState = { ok: false };
type CartLine = { key: number; catalogItemId: string; quantity: number };

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

export function GymPOSForm({ subdomain, branches, customers, catalog, cashOpenBranchIds }: {
  subdomain: string;
  branches: GymBranchDTO[];
  customers: GymCustomerDTO[];
  catalog: GymCatalogItemDTO[];
  cashOpenBranchIds: string[];
}) {
  const action = recordGymSale.bind(null, subdomain);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [nextKey, setNextKey] = useState(2);
  const [lines, setLines] = useState<CartLine[]>([{ key: 1, catalogItemId: catalog[0]?.id ?? "", quantity: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const itemById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const total = lines.reduce((sum, line) => sum + (itemById.get(line.catalogItemId)?.priceCents ?? 0) * line.quantity, 0);
  const containsMembership = lines.some((line) => itemById.get(line.catalogItemId)?.itemType === "membership");
  const cashOpen = cashOpenBranchIds.includes(branchId);

  function updateLine(key: number, next: Partial<CartLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...next } : line));
  }

  return (
    <form action={formAction} className="gym-pos-form">
      <input type="hidden" name="items" value={JSON.stringify(lines.map(({ catalogItemId, quantity }) => ({ catalogItemId, quantity })))} />
      <div className="gym-pos-context">
        <label>Sucursal<select name="branchId" required value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label>Socio {containsMembership ? <em>requerido</em> : <small>opcional</small>}<select name="customerId" required={containsMembership} defaultValue=""><option value="">Venta de mostrador</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      </div>

      <div className="gym-pos-lines">
        {lines.map((line) => {
          const item = itemById.get(line.catalogItemId);
          return <div key={line.key} className="gym-pos-line">
            <label>Concepto<select value={line.catalogItemId} onChange={(event) => updateLine(line.key, { catalogItemId: event.target.value })}>{catalog.map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id} disabled={catalogItem.tracksInventory && (catalogItem.inventoryQuantity ?? 0) < 1}>{catalogItem.name} · {money(catalogItem.priceCents)}{catalogItem.tracksInventory ? " · " + (catalogItem.inventoryQuantity ?? 0) + " disp." : ""}</option>)}</select></label>
            <label>Cantidad<input type="number" min="1" max="100" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Math.max(Number(event.target.value), 1) })} /></label>
            <strong>{money((item?.priceCents ?? 0) * line.quantity)}</strong>
            {lines.length > 1 ? <button type="button" aria-label="Quitar concepto" onClick={() => setLines((current) => current.filter((currentLine) => currentLine.key !== line.key))}>×</button> : null}
          </div>;
        })}
      </div>
      <button type="button" className="gym-pos-add" onClick={() => { setLines((current) => [...current, { key: nextKey, catalogItemId: catalog[0]?.id ?? "", quantity: 1 }]); setNextKey((value) => value + 1); }}>+ Agregar concepto</button>

      <div className="gym-pos-payment">
        <label>Forma de pago<select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="card">Tarjeta manual</option><option value="bank_transfer">Transferencia</option><option value="cash" disabled={!cashOpen}>Efectivo{cashOpen ? "" : " · abre caja"}</option></select></label>
        <label>Referencia <small>opcional</small><input name="reference" maxLength={120} placeholder="Últimos 4, folio o nota" /></label>
        <div className="gym-pos-total"><span>Total</span><strong>{money(total)}</strong></div>
      </div>
      <button className="gym-pos-charge" disabled={pending || total <= 0 || (paymentMethod === "cash" && !cashOpen)}>{pending ? "Registrando…" : "Cobrar " + money(total)}</button>
      {state.message ? <p className={state.ok ? "is-ok" : "is-error"}>{state.message}{state.ok && state.receiptToken ? <> <a href={"/recibos/" + state.receiptToken} target="_blank">Ver recibo ↗</a></> : null}</p> : null}
    </form>
  );
}
