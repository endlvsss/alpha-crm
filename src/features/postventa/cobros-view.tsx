"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useQuery } from "@/services";
import { GRACIA_DIAS, type SuscripcionFila } from "@/services/mock/queries";
import { addDays } from "@/data/seed";
import { getPlan } from "@/lib/plans";
import { ESTADO_SUSCRIPCION } from "@/lib/domain/labels";
import type { EstadoSuscripcion } from "@/lib/domain/types";
import { clp, formatDateTime, formatShortDate, type IsoDate } from "@/lib/format";
import { DemoTag, Empty, EstadoPill, Kpi, PageHeader, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { Modal, Sheet } from "@/components/ui/overlay";
import { Field } from "@/components/ui/form";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";

const MOTIVOS = ["Vendió el vehículo", "Precio", "Poco uso", "Se cambia a otro proveedor", "Otro"];

export function CobrosView({ tab: tabParam }: { tab?: string }) {
  const { data } = useQuery("suscripciones", async (s) => ({ subs: await s.billing.subscriptions(), hoy: await s.dashboard.today() }));
  const { exec, pending } = useAction();
  const [detalle, setDetalle] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState<SuscripcionFila | null>(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const tab = ["morosidad", "renovaciones", "bajas"].includes(tabParam ?? "") ? tabParam! : "suscripciones";

  const header = (
    <PageHeader
      eyebrow="Postventa"
      title="Suscripciones"
      description={
        <>
          Una suscripción por vehículo, mensual o anual. Si un cobro falla: aviso, reintento, período de gracia y suspensión; si regulariza, se reactiva sola. <SimTag>Cobro simulado</SimTag>
        </>
      }
    />
  );
  if (!data) {
    return (
      <>
        {header}
        <KpiSkeleton count={5} />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }

  const { subs, hoy } = data;
  const count = (e: EstadoSuscripcion) => subs.filter((s) => s.estado === e).length;
  const mrr = subs.filter((s) => s.estado === "activa" || s.estado === "pago_pendiente").reduce((t, s) => t + (s.periodicidad === "anual" ? Math.round(s.montoPeriodo / 12) : s.montoPeriodo), 0);
  const morosas = subs.filter((s) => s.estado === "pago_pendiente" || s.estado === "suspendida");
  const renuevan = subs.filter((s) => s.estado === "activa" && s.proximoCobro && s.proximoCobro <= addDays(hoy, 30)).sort((a, b) => a.proximoCobro!.localeCompare(b.proximoCobro!));
  const bajas = subs.filter((s) => s.estado === "cancelada");
  const sel = subs.find((s) => s.id === detalle) ?? null;

  const cliente = (s: SuscripcionFila) => (
    <button type="button" onClick={() => setDetalle(s.id)} className="text-left font-medium hover:underline">
      {s.cliente.nombre}
    </button>
  );

  return (
    <>
      {header}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ingreso mensual recurrente" value={clp(mrr)} hint="Anuales prorrateados" />
        <Kpi label="Activas" value={count("activa")} tone="ok" />
        <Kpi label="Renuevan en 30 días" value={renuevan.length} href="/cobros?tab=renovaciones" />
        <Kpi label="Pago pendiente" value={count("pago_pendiente")} tone={count("pago_pendiente") ? "amber" : undefined} href="/cobros?tab=morosidad" />
        <Kpi label="Suspendidas" value={count("suspendida")} tone={count("suspendida") ? "danger" : undefined} href="/cobros?tab=morosidad" />
      </div>
      <Tabs
        current={tab}
        items={[
          { key: "suscripciones", label: "Todas", href: "/cobros", count: subs.length },
          { key: "renovaciones", label: "Próximas renovaciones", href: "/cobros?tab=renovaciones", count: renuevan.length },
          { key: "morosidad", label: "Morosidad", href: "/cobros?tab=morosidad", count: morosas.length },
          { key: "bajas", label: "Cancelaciones", href: "/cobros?tab=bajas", count: bajas.length },
        ]}
      />

      {tab === "suscripciones" && (
        <Table head={["Cliente", "Vehículo", "Plan", "Periodicidad", "Monto del período", "Estado", "Inicio", "Próximo cobro"]} minWidth={1000}>
          {subs.map((s) => (
            <tr key={s.id} className="hover:bg-surface-2">
              <td>{cliente(s)}</td>
              <td><Patente>{s.patente}</Patente></td>
              <td>{getPlan(s.planId).name}</td>
              <td className="capitalize">{s.periodicidad}</td>
              <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
              <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
              <td className="font-mono text-xs">{s.inicio ? formatShortDate(s.inicio) : "—"}</td>
              <td className="font-mono text-xs">{s.proximoCobro ? formatShortDate(s.proximoCobro) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "renovaciones" &&
        (renuevan.length === 0 ? (
          <Empty>Ninguna suscripción renueva en los próximos 30 días.</Empty>
        ) : (
          <Table head={["Fecha", "Cliente", "Vehículo", "Plan", "Monto", ""]} minWidth={760}>
            {renuevan.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2">
                <td className="font-mono text-xs">{formatShortDate(s.proximoCobro!)}</td>
                <td>{cliente(s)}</td>
                <td><Patente>{s.patente}</Patente></td>
                <td>{getPlan(s.planId).name} · {s.periodicidad}</td>
                <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
                <td className="text-right"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCancelar(s)}>Cancelar</button></td>
              </tr>
            ))}
          </Table>
        ))}

      {tab === "morosidad" &&
        (morosas.length === 0 ? (
          <Empty>Nadie con pagos pendientes.</Empty>
        ) : (
          <Table head={["Cliente", "Vehículo", "Monto", "Moroso desde", "Gracia", "Estado", ""]} minWidth={1040}>
            {morosas.map((s) => {
              const dias = s.diasMora ?? 0;
              const restan = GRACIA_DIAS - dias;
              return (
                <tr key={s.id}>
                  <td>{cliente(s)}</td>
                  <td><Patente>{s.patente}</Patente></td>
                  <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
                  <td className="font-mono text-xs">{s.morosoDesde ? formatShortDate(s.morosoDesde) : "—"} · {dias} días</td>
                  <td>
                    {restan > 0 ? (
                      <span className="text-sm">
                        Quedan <strong>{restan}</strong> días
                        <span className="mt-1 block h-1.5 w-28 rounded-full bg-bg-sunken">
                          <span className="block h-1.5 rounded-full bg-amber-bright" style={{ width: `${Math.min(100, (dias / GRACIA_DIAS) * 100)}%` }} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-danger">Vencida</span>
                    )}
                  </td>
                  <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
                  <td className="text-right whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec((x) => x.billing.retryCharge(s.id, true), "Cobro aprobado (simulado): suscripción reactivada")}>Simular cobro OK</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec((x) => x.billing.retryCharge(s.id, false), "Reintento rechazado (simulado)")}>Rechazo</button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
        ))}

      {tab === "bajas" &&
        (bajas.length === 0 ? (
          <Empty>Sin cancelaciones.</Empty>
        ) : (
          <Table head={["Cliente", "Vehículo", "Plan", "Estado del cliente", "Motivo"]} minWidth={760}>
            {bajas.map((s) => (
              <tr key={s.id}>
                <td>{cliente(s)}</td>
                <td><Patente>{s.patente}</Patente></td>
                <td>{getPlan(s.planId).name}</td>
                <td><EstadoPill estado={s.cliente.estado} /></td>
                <td className="text-ink-soft">{s.cliente.motivoBaja ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ))}

      <p className="mt-3 text-xs text-muted">
        Planes y montos ilustrativos, pendientes de aprobación comercial. Período de gracia ~{GRACIA_DIAS} días (REFERENCIAL); regla de SUSPENDIDO a CANCELADO: POR DEFINIR.
      </p>

      <Sheet open={sel !== null} onClose={() => setDetalle(null)} eyebrow="Suscripción" title={sel ? `${sel.cliente.nombre} · ${sel.patente}` : ""}
        footer={sel && (
          <>
            <Link href={`/clientes/${sel.clienteId}?tab=pagos`} className="btn btn-ghost mr-auto">Ficha del cliente</Link>
            {sel.estado !== "cancelada" && sel.estado !== "pendiente_instalacion" && <button type="button" className="btn btn-danger" onClick={() => setCancelar(sel)}>Cancelar suscripción</button>}
          </>
        )}
      >
        {sel && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Plan</dt><dd>{getPlan(sel.planId).name} · {sel.periodicidad}</dd></div>
              <div><dt className="text-xs text-muted">Estado</dt><dd><Pill tone={ESTADO_SUSCRIPCION[sel.estado].tone}>{ESTADO_SUSCRIPCION[sel.estado].label}</Pill></dd></div>
              <div><dt className="text-xs text-muted">Monto del período</dt><dd className="font-mono">{clp(sel.montoPeriodo)} <DemoTag>Ilustrativo</DemoTag></dd></div>
              <div><dt className="text-xs text-muted">Próximo cobro</dt><dd className="font-mono">{sel.proximoCobro ? formatShortDate(sel.proximoCobro as IsoDate) : "—"}</dd></div>
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Eventos de renovación y cancelación</h3>
              {sel.eventos.length === 0 ? (
                <p className="text-sm text-muted">Sin eventos todavía.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {sel.eventos.map((e) => (
                    <li key={e.id} className="grid grid-cols-[6.5rem_1fr] gap-2 text-sm">
                      <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                      <span>
                        <span className="font-mono text-xs font-medium uppercase">{e.tipo}</span>
                        {e.detalle && <span className="block text-xs text-muted">{e.detalle}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Sheet>

      {cancelar && (
        <Modal
          open
          onClose={() => setCancelar(null)}
          title="Cancelar suscripción"
          description={`${cancelar.cliente.nombre} · ${cancelar.patente}. Si es su única suscripción, el cliente pasa a CANCELADO y su cuenta GPS se bloquea (simulado). En producción se ofrece primero una alternativa.`}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setCancelar(null)}>Volver</button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={async () => {
                  const r = await exec((x) => x.billing.cancelSubscription(cancelar.id, motivo), "Suscripción cancelada (demo)");
                  if (r.ok) {
                    setCancelar(null);
                    setDetalle(null);
                  }
                }}
              >
                Confirmar cancelación
              </button>
            </>
          }
        >
          <Field label="Motivo">
            <select className="field" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </Modal>
      )}
    </>
  );
}
