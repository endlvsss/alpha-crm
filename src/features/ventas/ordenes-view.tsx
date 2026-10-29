"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useAction, useQuery } from "@/services";
import type { OrdenFila } from "@/services/mock/queries";
import { getPlan } from "@/lib/plans";
import { ESTADO_ORDEN, ESTADO_PAGO } from "@/lib/domain/labels";
import type { EstadoOrden } from "@/lib/domain/types";
import { clp, formatDateTime } from "@/lib/format";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Empty, EstadoPill, Kpi, Mono, PageHeader, Pill, SimTag, Tabs } from "@/components/ui/kit";
import { Confirm } from "@/components/ui/overlay";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";

const FILTROS: { key: string; label: string; estados: EstadoOrden[] | null }[] = [
  { key: "todas", label: "Todas", estados: null },
  { key: "creadas", label: "Orden creada", estados: ["checkout_iniciado"] },
  { key: "pendientes", label: "Pago pendiente", estados: ["pendiente_pago"] },
  { key: "pagadas", label: "Pago confirmado", estados: ["pagada"] },
  { key: "sinpago", label: "Abandonadas y rechazadas", estados: ["abandonada", "pago_rechazado"] },
  { key: "devueltas", label: "Reembolsadas", estados: ["cancelada", "reembolsada"] },
];

export function OrdenesView({ filtro: f }: { filtro?: string }) {
  const { data: todas } = useQuery("ordenes", (s) => s.orders.list());
  const { exec, pending } = useAction();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [reembolso, setReembolso] = useState<OrdenFila | null>(null);
  const filtro = FILTROS.find((x) => x.key === f) ?? FILTROS[0];

  const header = (
    <PageHeader
      eyebrow="Ventas"
      title="Órdenes y pagos"
      description={
        <>
          Una orden nace en el checkout; el ingreso existe solo cuando la pasarela confirma el pago. Cada intento queda como transacción separada. <SimTag>Pasarela simulada</SimTag>
        </>
      }
    />
  );
  if (!todas) {
    return (
      <>
        {header}
        <KpiSkeleton />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }

  const suma = (es: EstadoOrden[]) => todas.filter((o) => es.includes(o.estado)).reduce((s, o) => s + o.montoTotal, 0);
  const n = (es: EstadoOrden[]) => todas.filter((o) => es.includes(o.estado)).length;
  const ordenes = filtro.estados ? todas.filter((o) => filtro.estados!.includes(o.estado)) : todas;

  return (
    <>
      {header}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Orden creada · sin pagar" value={n(["checkout_iniciado", "abandonada", "pago_rechazado"])} hint={`${clp(suma(["checkout_iniciado", "abandonada", "pago_rechazado"]))} · no es ingreso`} href="/ordenes?f=creadas" />
        <Kpi label="Pago pendiente" value={n(["pendiente_pago"])} hint={`${clp(suma(["pendiente_pago"]))} esperando la pasarela`} tone={n(["pendiente_pago"]) ? "amber" : undefined} href="/ordenes?f=pendientes" />
        <Kpi label="Pago confirmado" value={n(["pagada"])} hint={`${clp(suma(["pagada"]))} cobrado`} tone="ok" href="/ordenes?f=pagadas" />
        <Kpi label="Reembolsadas" value={n(["reembolsada", "cancelada"])} hint={`${clp(suma(["reembolsada"]))} devuelto`} href="/ordenes?f=devueltas" />
      </div>
      <Tabs current={filtro.key} items={FILTROS.map((x) => ({ key: x.key, label: x.label, href: x.key === "todas" ? "/ordenes" : `/ordenes?f=${x.key}`, count: x.estados ? n(x.estados) : todas.length }))} />
      {ordenes.length === 0 ? (
        <Empty>No hay órdenes con ese estado.</Empty>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead>
              <tr className="text-xs font-medium text-muted">
                {["", "Folio", "Cliente", "Plan", "Total", "Orden", "Último pago", "Fecha", ""].map((h, i) => (
                  <th key={i} scope="col" className="px-4 pt-3.5 pb-2.5 font-medium whitespace-nowrap first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const ultimo = o.pagos[0];
                const open = abierta === o.folio;
                return (
                  <Fragment key={o.folio}>
                    <tr className="border-t border-line/70 transition-colors hover:bg-surface-2 [&>td]:px-4 [&>td]:py-3">
                      <td className="!pl-5">
                        <button type="button" aria-expanded={open} aria-label={`${open ? "Ocultar" : "Ver"} transacciones de ${o.folio}`} onClick={() => setAbierta(open ? null : o.folio)} className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-ink/[0.06]">
                          <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                      <td><Mono>{o.folio}</Mono></td>
                      <td>
                        <Link href={`/clientes/${o.clienteId}?tab=pagos`} className="font-medium hover:underline">{o.cliente.nombre}</Link>
                        <span className="mt-0.5 block"><EstadoPill estado={o.cliente.estado} /></span>
                      </td>
                      <td>
                        {getPlan(o.planId).name} · {o.periodicidad}
                        {o.vehiculos > 1 && <span className="block text-xs text-muted">{o.vehiculos} vehículos</span>}
                      </td>
                      <td className="font-mono tabular-nums">{clp(o.montoTotal)}</td>
                      <td><Pill tone={ESTADO_ORDEN[o.estado].tone}>{ESTADO_ORDEN[o.estado].label}</Pill></td>
                      <td>{ultimo ? <Pill tone={ESTADO_PAGO[ultimo.estado].tone}>{ESTADO_PAGO[ultimo.estado].label}</Pill> : <span className="text-xs text-muted">Sin intentos</span>}</td>
                      <td className="font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(o.pagadaEn ?? o.creadaEn)}</td>
                      <td className="text-right whitespace-nowrap">
                        <span className="inline-flex gap-1.5">
                          {o.estado === "pendiente_pago" && (
                            <>
                              <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec((s) => s.orders.confirmPayment(o.folio), `Pago de ${o.folio} confirmado (simulado)`)}>Aprobar</button>
                              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec((s) => s.orders.rejectPayment(o.folio), "Pago rechazado (simulado)")}>Rechazar</button>
                            </>
                          )}
                          {["checkout_iniciado", "abandonada", "pago_rechazado"].includes(o.estado) && (
                            <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec((s) => s.orders.sendToGateway(o.folio), "Enviado a la pasarela (simulada)")}>
                              {o.estado === "pago_rechazado" ? "Reintentar" : "Enviar a pasarela"}
                            </button>
                          )}
                          {o.estado === "pagada" && !o.cliente.instaladoEn && (
                            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setReembolso(o)}>Reembolsar</button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-bg-sunken/40">
                        <td colSpan={9} className="px-5 py-3">
                          {o.pagos.length === 0 ? (
                            <p className="text-sm text-muted">Sin transacciones: la orden se creó pero nunca se envió a pagar.</p>
                          ) : (
                            <ul className="flex flex-col gap-1.5">
                              {o.pagos.map((p) => (
                                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                  <Mono className="text-muted">{p.id}</Mono>
                                  <Pill tone={ESTADO_PAGO[p.estado].tone}>{ESTADO_PAGO[p.estado].label}</Pill>
                                  <span className="font-mono tabular-nums">{clp(p.monto)}</span>
                                  <span className="text-muted">{p.pasarela === "webpay" ? "Webpay" : "Mercado Pago"} · <Mono>{p.ref ?? "sin referencia"}</Mono></span>
                                  <span className="font-mono text-xs text-muted">{formatDateTime(p.creadoEn)}</span>
                                  {p.motivo && <span className="text-xs text-muted">{p.motivo}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Precios provisorios (Esencial · Seguridad · Flota) con IVA, ilustrativos hasta la aprobación comercial. Pasarela: Webpay o Mercado Pago, PENDIENTE.</p>
      {reembolso && (
        <Confirm
          open
          onClose={() => setReembolso(null)}
          onConfirm={async () => {
            const r = await exec((s) => s.orders.refund(reembolso.folio, "Desistió antes de la instalación"), "Reembolso registrado (simulado)");
            if (r.ok) setReembolso(null);
          }}
          title={`¿Reembolsar ${reembolso.folio}?`}
          description={`${clp(reembolso.montoTotal)} a ${reembolso.cliente.nombre}. El cliente queda CANCELADO y se cancelan su suscripción y visitas. No se mueve dinero real; la política de devolución está POR DEFINIR.`}
          confirmLabel="Registrar reembolso"
          danger
          pending={pending}
        />
      )}
    </>
  );
}
