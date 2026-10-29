"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/services";
import type { Periodo } from "@/services/contracts";
import { TARIFA_VISITA_DEMO } from "@/services/mock/queries";
import { capitalize, clp, formatDateTime, formatLongDate, formatShortDate } from "@/lib/format";
import { BarChart, clpCompacto } from "@/components/ui/bar-chart";
import { Card, DemoTag, Empty, Kpi, Mono, PageHeader, Pill, SimTag, Table, pct } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/form";
import { KpiSkeleton, Skeleton } from "@/components/ui/skeleton";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "mes", label: "Este mes" },
  { value: "90d", label: "90 días" },
];

const CONCILIACION = {
  conciliado: { label: "Conciliado", tone: "ok" as const },
  por_liquidar: { label: "Por liquidar", tone: "amber" as const },
  reversado: { label: "Reversado", tone: "muted" as const },
};

export function FinanzasView() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const { data: f } = useQuery(`finanzas-${periodo}`, (s) => s.billing.finance(periodo));

  return (
    <>
      <PageHeader
        eyebrow="Postventa"
        title="Finanzas"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Ingreso es solo lo que la pasarela confirmó. Una orden creada o un pago pendiente nunca cuentan como venta. <SimTag>Pasarela y conciliación simuladas</SimTag>
          </span>
        }
        actions={<Segmented label="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} />}
      />

      {!f ? (
        <>
          <KpiSkeleton count={6} />
          <Skeleton className="mt-3 h-72 rounded-2xl" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Ingresos netos" value={clpCompacto(f.ingresos.neto)} hint="Confirmados − reembolsos" delta={pct(f.ingresos.neto, f.ingresosAnterior.neto)} />
            <Kpi label="Pagos iniciales" value={clpCompacto(f.ingresos.iniciales)} hint={`${f.pagos.confirmados} confirmados`} href="/ordenes?f=pagadas" />
            <Kpi label="Cobros recurrentes" value={clpCompacto(f.ingresos.recurrentes)} hint={`${f.cobros.aprobados} aprobados · ${f.cobros.rechazados} rechazados`} href="/cobros" />
            <Kpi label="Reembolsos" value={clpCompacto(f.ingresos.reembolsos)} hint={`${f.pagos.reembolsados} en el período`} tone={f.ingresos.reembolsos ? "danger" : undefined} href="/ordenes?f=devueltas" />
            <Kpi label="Costo de instalación" value={clpCompacto(f.costoInstalacion)} hint={`${f.instalaciones} visitas × ${clp(TARIFA_VISITA_DEMO)}`} />
            <Kpi label="Margen bruto" value={clpCompacto(f.margen)} hint="Ilustrativo: ingresos − instalaciones" tone={f.margen < 0 ? "danger" : "ok"} />
          </div>

          <div className="mt-3 grid items-start gap-3 xl:grid-cols-3">
            <Card title="Ingresos confirmados y costo de instalación" className="xl:col-span-2">
              <BarChart
                ariaLabel="Ingresos confirmados por período"
                format={clpCompacto}
                series={[
                  { key: "iniciales", label: "Pagos iniciales", className: "bg-brand" },
                  { key: "recurrentes", label: "Cobros recurrentes", className: "bg-accent/60" },
                ]}
                data={f.serie.map((x) => ({
                  label: f.paso === 1 ? String(Number(x.ini.slice(8))) : formatShortDate(x.ini),
                  detalle: f.paso === 1 ? capitalize(formatLongDate(x.ini)) : `Semana del ${formatShortDate(x.ini)}`,
                  values: { iniciales: x.iniciales, recurrentes: x.recurrentes },
                }))}
              />
              <div className="mt-5 border-t border-line/70 pt-4">
                <BarChart
                  ariaLabel="Costo de instalación por período (ilustrativo)"
                  format={clpCompacto}
                  height={120}
                  series={[{ key: "costo", label: "Pago a técnicos (ilustrativo)", className: "bg-amber-bright/70" }]}
                  data={f.serie.map((x) => ({
                    label: f.paso === 1 ? String(Number(x.ini.slice(8))) : formatShortDate(x.ini),
                    detalle: f.paso === 1 ? capitalize(formatLongDate(x.ini)) : `Semana del ${formatShortDate(x.ini)}`,
                    values: { costo: x.costo },
                  }))}
                />
              </div>
            </Card>

            <Card title="Del pedido al ingreso">
              <ol className="flex flex-col gap-2 text-sm">
                {[
                  ["Orden creada sin pagar", `${f.ordenes.sinPago} · ${clp(f.ordenes.montoSinPago)}`, "No es ingreso: puede abandonarse", "muted", "/ordenes?f=creadas"],
                  ["Pago pendiente", `${f.pagos.pendientes.length} · ${clp(f.pagos.pendientes.reduce((s, p) => s + p.monto, 0))}`, "Esperando respuesta de la pasarela", "amber", "/ordenes?f=pendientes"],
                  ["Pago confirmado", `${f.pagos.confirmados} · ${clp(f.ingresos.iniciales)}`, "Cuenta como ingreso", "ok", "/ordenes?f=pagadas"],
                  ["Pago rechazado", String(f.pagos.rechazados), "Se invita a reintentar", "danger", "/ordenes?f=sinpago"],
                  ["Reembolso", `${f.pagos.reembolsados} · ${clp(f.ingresos.reembolsos)}`, "Se descuenta del ingreso neto", "muted", "/ordenes?f=devueltas"],
                ].map(([t, v, h, tone, href]) => (
                  <li key={t}>
                    <Link href={href} className="flex items-start justify-between gap-3 rounded-xl bg-bg-sunken/60 p-3 transition-colors hover:bg-bg-sunken">
                      <span>
                        <span className="flex items-center gap-2 font-medium"><Pill tone={tone as "ok"}>{t}</Pill></span>
                        <span className="mt-1 block text-xs text-muted">{h}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums whitespace-nowrap">{v}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line/70 pt-4 text-sm">
                <div><dt className="text-xs text-muted">MRR actual</dt><dd className="font-mono">{clp(f.mrr)}</dd></div>
                <div><dt className="text-xs text-muted">Por cobrar (morosidad)</dt><dd className="font-mono text-amber">{clp(f.cobros.porCobrar)}</dd></div>
              </dl>
            </Card>
          </div>

          <Card
            title={<span className="flex items-center gap-2">Conciliación de pagos <DemoTag>Simulada</DemoTag></span>}
            className="mt-3"
            padded={false}
          >
            <p className="px-5 pb-3 text-sm text-muted">
              Supuesto ilustrativo: la pasarela liquida cada pago aprobado 2 días después. La conciliación real se hará contra el reporte de la pasarela elegida.
            </p>
            {f.conciliacion.length === 0 ? (
              <div className="px-5 pb-4"><Empty>Sin pagos confirmados en el período.</Empty></div>
            ) : (
              <Table head={["Transacción", "Cliente", "Orden", "Monto", "Pagado", "Liquidación", "Estado"]} minWidth={860}>
                {f.conciliacion.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td><Mono>{p.ref ?? p.id}</Mono></td>
                    <td><Link href={`/clientes/${p.clienteId}?tab=pagos`} className="hover:underline">{p.cliente}</Link></td>
                    <td><Mono className="text-muted">{p.ordenFolio}</Mono></td>
                    <td className="font-mono tabular-nums">{clp(p.monto)}</td>
                    <td className="font-mono text-xs text-muted">{formatDateTime(p.creadoEn)}</td>
                    <td className="font-mono text-xs text-muted">{p.liquidacion ? formatShortDate(p.liquidacion) : "—"}</td>
                    <td><Pill tone={CONCILIACION[p.estadoConciliacion].tone}>{CONCILIACION[p.estadoConciliacion].label}</Pill></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <p className="mt-3 text-xs text-muted">
            Montos con IVA y precios ilustrativos pendientes de aprobación. Tarifa por visita del técnico: POR DEFINIR. La boleta electrónica (DTE 39) se emitirá con un proveedor tributario aún no elegido.
          </p>
        </>
      )}
    </>
  );
}
