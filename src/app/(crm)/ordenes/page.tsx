import type { Metadata } from "next";
import Link from "next/link";
import { listOrdenes } from "@/data";
import { getPlan } from "@/lib/plans";
import { ESTADO_ORDEN } from "@/lib/domain/labels";
import type { EstadoOrden } from "@/lib/domain/types";
import { clp, formatDateTime } from "@/lib/format";
import { EstadoPill, Kpi, Mono, PageHeader, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Órdenes y pagos" };

const FILTROS: { key: string; label: string; estados: EstadoOrden[] | null }[] = [
  { key: "todas", label: "Todas", estados: null },
  { key: "pagadas", label: "Pagadas", estados: ["pagada"] },
  { key: "abiertas", label: "Checkout abierto", estados: ["checkout_iniciado"] },
  { key: "abandonadas", label: "Abandonadas", estados: ["abandonada", "pago_rechazado"] },
  { key: "devueltas", label: "Canceladas y devoluciones", estados: ["cancelada", "reembolsada"] },
];

export default async function OrdenesPage({ searchParams }: PageProps<"/ordenes">) {
  const sp = await searchParams;
  const filtro = FILTROS.find((f) => f.key === sp.f) ?? FILTROS[0];
  const todas = await listOrdenes();
  const ordenes = filtro.estados ? todas.filter((o) => filtro.estados!.includes(o.estado)) : todas;
  const pagadas = todas.filter((o) => o.estado === "pagada");
  const total = pagadas.reduce((s, o) => s + o.montoTotal, 0);
  const anual = pagadas.filter((o) => o.periodicidad === "anual").length;

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Órdenes y pagos"
        description={
          <>
            Cada compra del checkout crea una orden. El pago aprobado en Webpay la marca pagada, crea la cuenta y deja la visita por agendar. <SimTag>Webpay simulado</SimTag>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Órdenes pagadas" value={pagadas.length} hint={clp(total)} />
        <Kpi label="Ticket promedio" value={clp(pagadas.length ? Math.round(total / pagadas.length) : 0)} hint="Equipo, instalación y primer período" />
        <Kpi label="Eligen anual" value={`${Math.round((anual / Math.max(1, pagadas.length)) * 100)}%`} hint="Pagan 10 meses y usan 12" />
        <Kpi
          label="Checkout sin pagar"
          value={todas.filter((o) => o.estado === "abandonada" || o.estado === "checkout_iniciado").length}
          hint="Recuperables con consentimiento"
          tone="amber"
        />
      </div>
      <Tabs
        current={filtro.key}
        items={FILTROS.map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "todas" ? "/ordenes" : `/ordenes?f=${f.key}`,
          count: f.estados ? todas.filter((o) => f.estados!.includes(o.estado)).length : todas.length,
        }))}
      />
      <Table head={["Folio", "Cliente", "Plan", "Total hoy", "Orden", "Referencia Webpay", "Fecha"]} minWidth={980}>
        {ordenes.map((o) => (
          <tr key={o.folio} className="hover:bg-surface-2">
            <td><Mono>{o.folio}</Mono></td>
            <td>
              <Link href={`/clientes/${o.clienteId}?tab=pagos`} className="font-medium hover:underline">{o.cliente.nombre}</Link>
              <span className="mt-0.5 block"><EstadoPill estado={o.cliente.estado} /></span>
            </td>
            <td>
              {getPlan(o.planId).name} · {o.periodicidad}
              {o.vehiculos > 1 && <span className="block text-xs text-muted">{o.vehiculos} vehículos</span>}
            </td>
            <td className="tabular-nums">{clp(o.montoTotal)}</td>
            <td><Pill tone={ESTADO_ORDEN[o.estado].tone}>{ESTADO_ORDEN[o.estado].label}</Pill></td>
            <td><Mono className="text-muted">{o.pagoRef ?? "—"}</Mono></td>
            <td className="font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(o.pagadaEn ?? o.creadaEn)}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-muted">Precios provisorios (Esencial · Seguridad · Flota), con IVA.</p>
    </>
  );
}
