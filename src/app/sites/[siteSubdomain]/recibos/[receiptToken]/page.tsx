import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

function money(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bank_transfer: "Transferencia",
  mercado_pago: "Mercado Pago",
};

export default async function GymReceiptPage({ params }: { params: Promise<{ siteSubdomain: string; receiptToken: string }> }) {
  const { siteSubdomain, receiptToken } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(receiptToken)) notFound();
  const { data: site } = await supabaseAdmin.from("organization_sites")
    .select("organization_id, site_name, address, phone")
    .eq("subdomain", siteSubdomain).eq("status", "published").maybeSingle();
  if (!site) notFound();
  const { data: receipt } = await supabaseAdmin.from("gym_receipts")
    .select("id, order_id, customer_id, folio, issued_at")
    .eq("organization_id", site.organization_id).eq("public_token", receiptToken).maybeSingle();
  if (!receipt) notFound();
  const [orderResult, itemsResult, paymentResult, customerResult] = await Promise.all([
    supabaseAdmin.from("gym_orders").select("order_number, subtotal_cents, discount_cents, total_cents").eq("id", receipt.order_id).single(),
    supabaseAdmin.from("gym_order_items").select("description, quantity, unit_price_cents, total_cents").eq("order_id", receipt.order_id).order("created_at"),
    supabaseAdmin.from("gym_payments").select("payment_method, reference, paid_at").eq("order_id", receipt.order_id).eq("status", "approved").maybeSingle(),
    receipt.customer_id ? supabaseAdmin.from("gym_customers").select("name").eq("id", receipt.customer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!orderResult.data || !paymentResult.data) notFound();
  const order = orderResult.data;
  const payment = paymentResult.data;
  return <main className="gym-receipt-page">
    <article className="gym-receipt">
      <header><div><p>Recibo digital interno</p><h1>{site.site_name}</h1><span>{site.address}</span><span>{site.phone}</span></div><div><strong>#{receipt.folio}</strong><span>Venta #{order.order_number}</span><time>{new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date(payment.paid_at))}</time></div></header>
      <section className="gym-receipt-customer"><span>Cliente</span><strong>{customerResult.data?.name ?? "Venta de mostrador"}</strong></section>
      <div className="gym-receipt-lines">
        {(itemsResult.data ?? []).map((item, index) => <div key={index}><span>{item.quantity} × {item.description}</span><small>{money(item.unit_price_cents)} c/u</small><strong>{money(item.total_cents)}</strong></div>)}
      </div>
      <dl><div><dt>Subtotal</dt><dd>{money(order.subtotal_cents)}</dd></div>{order.discount_cents ? <div><dt>Descuento</dt><dd>−{money(order.discount_cents)}</dd></div> : null}<div className="is-total"><dt>Total pagado</dt><dd>{money(order.total_cents)}</dd></div></dl>
      <footer><div><span>Forma de pago</span><strong>{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</strong>{payment.reference ? <small>Ref. {payment.reference}</small> : null}</div><p>Este comprobante acredita una operación interna de {site.site_name}. No es un CFDI ni sustituye una factura fiscal.</p></footer>
    </article>
  </main>;
}
