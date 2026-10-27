import type { Metadata } from "next";
import Link from "next/link";
import { hoy, listClientes, listSuscripciones } from "@/data";
import { getPlan } from "@/lib/plans";
import { ESTADO_SUSCRIPCION } from "@/lib/domain/labels";
import type { EstadoSuscripcion } from "@/lib/domain/types";
import { clp, daysBetween, formatDateTime, formatShortDate } from "@/lib/format";
import { Empty, EstadoPill, Kpi, PageHeader, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { DemoAction } from "@/components/ui/demo-action";

export const metadata: Metadata = { title: "Suscripciones y cobro" };

const GRACIA_DIAS = 15; // REFERENCIAL en el blueprint.

export default async function CobrosPage({ searchParams }: PageProps<"/cobros">) {
  const sp = await searchParams;
  const tab = sp.tab === "morosidad" || sp.tab === "bajas" ? sp.tab : "suscripciones";
  const today = await hoy();
  const subs = await listSuscripciones();
  const cancelados = (await listClientes({ estado: "CANCELADO" })).concat(await listClientes({ estado: "SUSPENDIDO" }));
  const count = (e: EstadoSuscripcion) => subs.filter((s) => s.estado === e).length;
  const mrr = subs
    .filter((s) => s.estado === "activa" || s.estado === "pago_pendiente")
    .reduce((t, s) => t + (s.periodicidad === "anual" ? Math.round(s.montoPeriodo / 12) : s.montoPeriodo), 0);
  const morosas = subs.filter((s) => s.estado === "pago_pendiente" || s.estado === "suspendida");

  return (
    <>
      <PageHeader
        eyebrow="Soporte y cobro"
        title="Suscripciones y cobro"
        description={
          <>
            Una suscripción por vehículo. Cobro automático mensual o anual con Webpay; si falla: aviso, segundo intento, gracia y suspensión. Si regulariza, se reactiva sola. <SimTag>Cobro simulado</SimTag>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ingreso mensual recurrente" value={clp(mrr)} />
        <Kpi label="Activas" value={count("activa")} tone="ok" />
        <Kpi label="Pendientes de instalación" value={count("pendiente_instalacion")} hint="Aún no se cobran" />
        <Kpi label="Pago pendiente" value={count("pago_pendiente")} tone="amber" href="/cobros?tab=morosidad" />
        <Kpi label="Suspendidas" value={count("suspendida")} tone="danger" href="/cobros?tab=morosidad" />
      </div>
      <Tabs
        current={tab}
        items={[
          { key: "suscripciones", label: "Suscripciones", href: "/cobros", count: subs.length },
          { key: "morosidad", label: "Morosidad", href: "/cobros?tab=morosidad", count: morosas.length },
          { key: "bajas", label: "Cancelaciones y suspendidos", href: "/cobros?tab=bajas", count: cancelados.length },
        ]}
      />

      {tab === "suscripciones" && (
        <Table head={["Cliente", "Vehículo", "Plan", "Monto del período", "Estado", "Inicio", "Próximo cobro"]} minWidth={940}>
          {subs.map((s) => (
            <tr key={s.id} className="hover:bg-surface-2">
              <td><Link href={`/clientes/${s.clienteId}?tab=pagos`} className="font-medium hover:underline">{s.cliente.nombre}</Link></td>
              <td><Patente>{s.patente}</Patente></td>
              <td>{getPlan(s.planId).name} · {s.periodicidad}</td>
              <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
              <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
              <td className="font-mono text-xs">{s.inicio ? formatShortDate(s.inicio) : "—"}</td>
              <td className="font-mono text-xs">{s.proximoCobro ? formatShortDate(s.proximoCobro) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "morosidad" &&
        (morosas.length === 0 ? (
          <Empty>Nadie con pagos pendientes.</Empty>
        ) : (
          <Table head={["Cliente", "Vehículo", "Monto", "Moroso desde", "Gracia", "Estado", ""]} minWidth={980}>
            {morosas.map((s) => {
              const dias = daysBetween(s.morosoDesde!, today);
              const restan = GRACIA_DIAS - dias;
              return (
                <tr key={s.id}>
                  <td><Link href={`/clientes/${s.clienteId}?tab=pagos`} className="font-medium hover:underline">{s.cliente.nombre}</Link></td>
                  <td><Patente>{s.patente}</Patente></td>
                  <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
                  <td className="font-mono text-xs">{formatShortDate(s.morosoDesde!)} · {dias} días</td>
                  <td>
                    {restan > 0 ? (
                      <span className="text-sm">
                        Quedan <strong>{restan}</strong> días
                        <span className="mt-1 block h-1.5 w-28 rounded-full bg-bg-sunken">
                          <span className="block h-1.5 rounded-full bg-amber-bright" style={{ width: `${(dias / GRACIA_DIAS) * 100}%` }} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-danger">Vencida</span>
                    )}
                  </td>
                  <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
                  <td><DemoAction result="se reenvía el enlace para actualizar el medio de pago.">Reenviar enlace de pago</DemoAction></td>
                </tr>
              );
            })}
          </Table>
        ))}

      {tab === "bajas" && (
        <Table head={["Cliente", "Estado", "Motivo", "Alta"]} minWidth={720}>
          {cancelados.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/clientes/${c.id}`} className="font-medium hover:underline">{c.nombre}</Link></td>
              <td><EstadoPill estado={c.estado} /></td>
              <td className="text-ink-soft">{c.motivoBaja ?? "Pago no regularizado"}</td>
              <td className="font-mono text-xs text-muted">{formatDateTime(c.creadoEn)}</td>
            </tr>
          ))}
        </Table>
      )}

      <p className="mt-3 text-xs text-muted">
        Período de gracia de ~{GRACIA_DIAS} días (REFERENCIAL), regla de SUSPENDIDO a CANCELADO y beneficio por segundo vehículo: POR DEFINIR.
      </p>
    </>
  );
}
