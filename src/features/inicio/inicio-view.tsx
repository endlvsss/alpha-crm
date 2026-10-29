"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/services";
import type { Periodo } from "@/services/contracts";
import { GRUPO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import { capitalize, clp, formatDateTime, formatLongDate, formatShortDate } from "@/lib/format";
import { BarChart, clpCompacto } from "@/components/ui/bar-chart";
import { Card, DemoTag, Dot, Empty, EstadoPill, Kpi, PageHeader, Pill, pct } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/form";
import { KpiSkeleton, Skeleton } from "@/components/ui/skeleton";
import { AlertIcon, ArrowRightIcon, PlusIcon } from "@/components/ui/icons";
import { NuevoLeadModal } from "@/features/ventas/nuevo-lead";

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "mes", label: "Este mes" },
  { value: "90d", label: "90 días" },
];

export function InicioView() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [nuevo, setNuevo] = useState(false);
  const { data: r } = useQuery(`resumen-${periodo}`, (s) => s.dashboard.summary(periodo));

  return (
    <>
      <PageHeader
        eyebrow={r ? capitalize(formatLongDate(r.hoy)) : "Inicio"}
        title="Inicio"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Ventas, instalaciones, cobros y casos que necesitan a una persona. <DemoTag>Datos ficticios</DemoTag>
          </span>
        }
        actions={
          <>
            <Segmented label="Período" value={periodo} onChange={setPeriodo} options={PERIODOS} />
            <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}>
              <PlusIcon className="size-4" /> Nuevo lead
            </button>
          </>
        }
      />

      {!r ? (
        <>
          <KpiSkeleton count={6} />
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Ingresos" value={clpCompacto(r.ingresos.neto)} hint={`${clp(r.ingresos.recurrentes)} recurrentes`} delta={pct(r.ingresos.neto, r.ingresosAnterior.neto)} href="/finanzas" />
            <Kpi label="Ventas" value={r.ventas} hint="Pagos iniciales confirmados" delta={pct(r.ventas, r.ventasAnterior)} href="/ordenes?f=pagadas" />
            <Kpi label="Clientes activos" value={r.clientesActivos} hint={`+${r.nuevasContrataciones} en el período`} tone="ok" href="/clientes?estado=ACTIVO" />
            <Kpi label="MRR" value={clpCompacto(r.suscripciones.mrr)} hint={`${r.suscripciones.activas} suscripciones activas`} href="/cobros" />
            <Kpi label="Por agendar · agendadas" value={`${r.instalaciones.pendientes} · ${r.instalaciones.agendadas}`} hint={`${r.instalaciones.completadas} completadas en el período`} tone={r.instalaciones.pendientes ? "brand" : undefined} href="/visitas" />
            <Kpi label="Tickets abiertos" value={r.tickets.abiertos} hint={r.tickets.urgentes ? `${r.tickets.urgentes} urgente${r.tickets.urgentes > 1 ? "s" : ""}` : "Ninguno urgente"} tone={r.tickets.urgentes ? "danger" : undefined} href="/soporte" />
          </div>

          <div className="mt-3 grid items-start gap-3 xl:grid-cols-3">
            <Card
              title="Ingresos confirmados"
              className="xl:col-span-2"
              action={<Link href="/finanzas" className="text-sm font-medium text-accent-ink hover:underline">Finanzas</Link>}
            >
              <BarChart
                ariaLabel={`Ingresos confirmados por ${r.paso === 1 ? "día" : "semana"}, ${PERIODOS.find((p) => p.value === periodo)?.label}`}
                format={clpCompacto}
                series={[
                  { key: "iniciales", label: "Pagos iniciales", className: "bg-brand" },
                  { key: "recurrentes", label: "Cobros recurrentes", className: "bg-accent/60" },
                ]}
                data={r.serie.map((x) => ({
                  label: r.paso === 1 ? String(Number(x.ini.slice(8))) : formatShortDate(x.ini),
                  detalle: r.paso === 1 ? capitalize(formatLongDate(x.ini)) : `Semana del ${formatShortDate(x.ini)} al ${formatShortDate(x.fin)}`,
                  values: { iniciales: x.iniciales, recurrentes: x.recurrentes },
                }))}
              />
              <p className="mt-3 text-xs text-muted">
                Solo pagos aprobados y cobros aprobados, menos reembolsos. Las órdenes sin pagar nunca cuentan como ingreso.
              </p>
            </Card>

            <Card title="Embudo del período">
              <ol className="flex flex-col gap-3">
                {r.embudo.map((e, i) => {
                  const top = Math.max(1, r.embudo[0].valor);
                  const prev = i > 0 ? r.embudo[i - 1].valor : null;
                  return (
                    <li key={e.etapa}>
                      <Link href={e.href} className="group block">
                        <span className="flex items-baseline justify-between text-sm">
                          <span className="text-ink-soft group-hover:text-ink">{e.etapa}</span>
                          <span className="font-mono tabular-nums">
                            {e.valor}
                            {prev ? <span className="ml-2 text-xs text-muted">{Math.round((e.valor / prev) * 100)}%</span> : null}
                          </span>
                        </span>
                        <span className="mt-1 block h-2 rounded-full bg-bg-sunken">
                          <span className="block h-2 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (e.valor / top) * 100)}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-muted">Cada etapa cuenta lo que ocurrió dentro del período; el porcentaje es contra la etapa anterior.</p>
            </Card>
          </div>

          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <Card title={`Visitas de hoy (${r.hoyVisitas.length})`} padded={false} action={<Link href="/agenda" className="text-sm font-medium text-accent-ink hover:underline">Agenda</Link>}>
              {r.hoyVisitas.length === 0 ? (
                <div className="px-5 pb-4"><Empty>No hay visitas hoy.</Empty></div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {r.hoyVisitas.map((v) => (
                    <li key={v.folio}>
                      <Link href={`/visitas/${v.folio}`} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                        <span className="font-mono text-sm tabular-nums">{v.bloque}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{v.cliente.nombre}</span>
                          <span className="block truncate text-xs text-muted">{TIPO_VISITA[v.tipo]} · {v.comuna} · {v.tecnico ?? "Sin técnico"}</span>
                        </span>
                        <Pill tone={GRUPO_VISITA[v.grupo].tone}>{GRUPO_VISITA[v.grupo].label}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Suscripciones y cobro">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Activas", r.suscripciones.activas, "/cobros", undefined],
                  ["Renuevan en 30 días", r.suscripciones.renuevan, "/cobros", undefined],
                  ["Cobros pendientes", r.suscripciones.cobrosPendientes, "/cobros?tab=morosidad", r.suscripciones.cobrosPendientes ? "text-amber" : undefined],
                  ["Monto por cobrar", clpCompacto(r.suscripciones.montoPendiente), "/cobros?tab=morosidad", undefined],
                ].map(([label, valor, href, cls]) => (
                  <Link key={label as string} href={href as string} className="rounded-xl bg-bg-sunken/60 p-3 transition-colors hover:bg-bg-sunken">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className={`mt-0.5 font-display text-xl font-bold tabular-nums ${cls ?? ""}`}>{valor}</dd>
                  </Link>
                ))}
              </dl>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Clientes por estado</p>
                <ul className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(r.estados) as [keyof typeof r.estados, number][]).map(([e, n]) => (
                    <li key={e}>
                      <Link href={`/clientes?estado=${encodeURIComponent(e)}`} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-ink/[0.05]">
                        <span className="block truncate text-[0.7rem] font-semibold text-muted">{e}</span>
                        <span className="font-mono text-sm tabular-nums">{n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card title={<span className="flex items-center gap-2"><AlertIcon className="size-4 text-amber" /> Alertas operativas ({r.alertas.length})</span>} padded={false} className="lg:col-span-2 xl:col-span-1">
              {r.alertas.length === 0 ? (
                <div className="px-5 pb-4"><Empty>Nada pendiente. Buen trabajo.</Empty></div>
              ) : (
                <ul className="max-h-[22rem] divide-y divide-line/70 overflow-y-auto">
                  {r.alertas.map((a) => (
                    <li key={a.id}>
                      <Link href={a.href} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                        <Dot tone={a.tone} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.titulo}</span>
                          <span className="block truncate text-xs text-muted">{a.detalle}</span>
                        </span>
                        <ArrowRightIcon className="size-4 shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Actividad reciente" className="mt-3" padded={false} action={<Link href="/ventas" className="text-sm font-medium text-accent-ink hover:underline">Pipeline</Link>}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th scope="col" className="px-5 pt-1 pb-2 font-medium">Cuándo</th>
                    <th scope="col" className="px-3 pt-1 pb-2 font-medium">Evento</th>
                    <th scope="col" className="px-3 pt-1 pb-2 font-medium">Cliente</th>
                    <th scope="col" className="px-3 pt-1 pb-2 font-medium">Detalle</th>
                    <th scope="col" className="px-5 pt-1 pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-line/70">
                  {r.actividad.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-2.5 font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(e.en)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-medium tracking-wide uppercase">{e.tipo}</span>
                        {e.demo && <span className="ml-2"><DemoTag /></span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {e.cliente ? <Link href={`/clientes/${e.cliente.id}`} className="hover:underline">{e.cliente.nombre}</Link> : e.entidad === "tecnico" ? <Link href={`/tecnicos/${e.entidadRef}`} className="hover:underline">Técnico</Link> : "—"}
                      </td>
                      <td className="max-w-80 truncate px-3 py-2.5 text-ink-soft">{e.detalle ?? "—"}</td>
                      <td className="px-5 py-2.5">{e.cliente && <EstadoPill estado={e.cliente.estado} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <NuevoLeadModal open={nuevo} onClose={() => setNuevo(false)} />
    </>
  );
}
