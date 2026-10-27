import Link from "next/link";
import { resumen } from "@/data";
import { ESTADOS_CLIENTE } from "@/lib/domain/types";
import { ESTADO_CLIENTE_TONE, ESTADO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import { capitalize, clp, formatDateTime, formatLongDate, formatShortDate } from "@/lib/format";
import { Card, Dot, Empty, EstadoPill, Kpi, PageHeader, Pill } from "@/components/ui/kit";

export default async function InicioPage() {
  const r = await resumen();
  const maxSemana = Math.max(1, ...r.semanas.map((s) => s.ventas));
  const top = r.embudo[0].valor;

  return (
    <>
      <PageHeader
        eyebrow={capitalize(formatLongDate(r.hoy))}
        title="Inicio"
        description="Cómo va el negocio hoy: ventas, instalaciones y casos que necesitan a una persona."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Ventas · últimos 30 días" value={r.ventasMes} hint={clp(r.montoMes)} href="/ordenes" />
        <Kpi label="Ingreso mensual recurrente" value={clp(r.mrr)} hint="Anuales prorrateados" />
        <Kpi label="Clientes activos" value={r.activos} hint="Vehículo reportando" tone="ok" href="/clientes?estado=ACTIVO" />
        <Kpi
          label="Tickets abiertos"
          value={r.ticketsAbiertos}
          hint={r.urgentes ? `${r.urgentes} urgente${r.urgentes > 1 ? "s" : ""}` : "Ninguno urgente"}
          tone={r.urgentes ? "danger" : undefined}
          href="/soporte"
        />
        <Kpi
          label="Pago pendiente · suspendidos"
          value={`${r.morosos} · ${r.suspendidos}`}
          hint="En período de gracia"
          tone={r.morosos ? "amber" : undefined}
          href="/cobros?tab=morosidad"
        />
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-3">
        <Card title="Clientes por estado" className="xl:col-span-2" action={<Link href="/ventas" className="text-sm font-medium text-accent-ink hover:underline">Ver tablero</Link>}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {ESTADOS_CLIENTE.map((e) => (
              <li key={e}>
                <Link href={`/clientes?estado=${encodeURIComponent(e)}`} className="block rounded-xl bg-bg-sunken/60 p-3 transition-colors hover:bg-bg-sunken">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <Dot tone={ESTADO_CLIENTE_TONE[e]} />
                    <span className="truncate">{e}</span>
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold tabular-nums">{r.estados[e]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {r.abandonados} checkouts abandonados se pueden recuperar (solo los que dieron consentimiento).
          </p>
        </Card>

        <Card title="Embudo del blueprint">
          <ol className="flex flex-col gap-2.5">
            {r.embudo.map((e, i) => {
              const prev = i > 0 ? r.embudo[i - 1].valor : null;
              return (
                <li key={e.etapa}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-soft">{e.etapa}</span>
                    <span className="font-mono tabular-nums">
                      {e.valor}
                      {prev ? <span className="ml-2 text-xs text-muted">{Math.round((e.valor / prev) * 100)}%</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-bg-sunken">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${(e.valor / top) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card
          title={`Visitas de hoy (${r.hoyVisitas.length})`}
          className="xl:col-span-2"
          action={<Link href="/agenda" className="text-sm font-medium text-accent-ink hover:underline">Agenda</Link>}
          padded={false}
        >
          {r.hoyVisitas.length === 0 ? (
            <div className="px-5 pb-4">
              <Empty>No hay visitas hoy.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {r.hoyVisitas.map((v) => (
                <li key={v.folio}>
                  <Link href={`/visitas/${v.folio}`} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                    <span className="font-mono text-sm tabular-nums">{v.bloque}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{v.cliente.nombre}</span>
                      <span className="block truncate text-xs text-muted">
                        {TIPO_VISITA[v.tipo]} · {v.comuna} · {v.tecnico ?? "Sin técnico"}
                      </span>
                    </span>
                    <Pill tone={ESTADO_VISITA[v.estado].tone}>{ESTADO_VISITA[v.estado].label}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ventas por semana">
          <div className="flex h-36 items-end gap-1.5" role="img" aria-label={`Ventas de las últimas 8 semanas: ${r.semanas.map((s) => s.ventas).join(", ")}`}>
            {r.semanas.map((s) => (
              <div key={s.ini} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-xs text-muted tabular-nums">{s.ventas}</span>
                <div className="w-full rounded-t-md bg-brand" style={{ height: `${Math.max(4, (s.ventas / maxSemana) * 100)}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-xs text-muted">
            <span>{formatShortDate(r.semanas[0].ini)}</span>
            <span>Esta semana</span>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card title="Requiere atención" className="xl:col-span-1">
          <ul className="flex flex-col gap-2">
            {[...r.requierePersona, ...r.incidencias, ...r.porAgendar].map((v) => (
              <li key={v.folio}>
                <Link href={`/visitas/${v.folio}`} className="flex items-center justify-between gap-3 rounded-xl bg-bg-sunken/60 px-3 py-2.5 transition-colors hover:bg-bg-sunken">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{v.cliente.nombre}</span>
                    <span className="block truncate text-xs text-muted">{v.comuna} · {v.folio}</span>
                  </span>
                  <Pill tone={ESTADO_VISITA[v.estado].tone}>{ESTADO_VISITA[v.estado].label}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Actividad reciente" className="xl:col-span-2" padded={false}>
          <ul className="divide-y divide-line/70">
            {r.actividad.map((e) => (
              <li key={e.id}>
                <Link href={`/clientes/${e.clienteId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm transition-colors hover:bg-surface-2">
                  <span className="w-28 shrink-0 font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                  <span className="font-mono text-xs font-medium tracking-wide text-ink uppercase">{e.tipo}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{e.cliente.nombre}{e.detalle ? ` · ${e.detalle}` : ""}</span>
                  <EstadoPill estado={e.cliente.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
