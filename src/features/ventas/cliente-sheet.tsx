"use client";

import Link from "next/link";
import { useQuery } from "@/services";
import { getPlan } from "@/lib/plans";
import { AVANCE, ETAPA, ETAPAS, etapaSiguiente, type Etapa } from "@/lib/domain/pipeline";
import { ESTADO_ORDEN, GRUPO_VISITA, ORIGEN_LABEL } from "@/lib/domain/labels";
import { clp, formatDateTime, formatShortDate } from "@/lib/format";
import { Sheet } from "@/components/ui/overlay";
import { EstadoPill, Facts, Mono, Patente, Pill } from "@/components/ui/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon } from "@/components/ui/icons";

/** Detalle rápido de un caso del pipeline, sin salir del tablero. */
export function ClienteSheet({
  id,
  onClose,
  onAvanzar,
  onRechazarPago,
  pending,
}: {
  id: string | null;
  onClose: () => void;
  onAvanzar: (caso: { id: string; nombre: string; etapa: Etapa; vehiculos: number }) => void;
  onRechazarPago: (folio: string) => void;
  pending: boolean;
}) {
  const { data } = useQuery(`sheet-${id}`, (s) => (id ? s.customers.get(id) : Promise.resolve(null)));
  const c = data?.cliente;
  const etapa = data?.etapa ?? null;
  const siguiente = etapa ? etapaSiguiente(etapa) : null;
  const orden = data?.ordenes[0];
  const visita = data?.visitas.filter((v) => v.estado !== "cancelada").at(-1);

  return (
    <Sheet
      open={id !== null}
      onClose={onClose}
      eyebrow={etapa ? ETAPA[etapa].label : "Cliente"}
      title={c?.nombre ?? <Skeleton className="h-6 w-48" />}
      footer={
        data && (
          <>
            <Link href={`/clientes/${data.cliente.id}`} className="btn btn-ghost mr-auto">
              Ficha 360° <ArrowUpRightIcon className="size-4" />
            </Link>
            {etapa === "pendiente_pago" && orden?.estado === "pendiente_pago" && (
              <button type="button" className="btn btn-danger" disabled={pending} onClick={() => onRechazarPago(orden.folio)}>
                Simular rechazo
              </button>
            )}
            {etapa && siguiente && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => onAvanzar({ id: data.cliente.id, nombre: data.cliente.nombre, etapa, vehiculos: data.vehiculos.length })}
              >
                {AVANCE[etapa as Exclude<Etapa, "activo">].accion} <ArrowRightIcon className="size-4" />
              </button>
            )}
          </>
        )
      }
    >
      {!data || !c ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {etapa && (
            <ol className="flex gap-1" aria-label="Avance en el pipeline">
              {ETAPAS.map((e, i) => {
                const idx = ETAPAS.indexOf(etapa);
                return (
                  <li key={e} title={ETAPA[e].label} className={`h-1.5 flex-1 rounded-full ${i < idx ? "bg-ok" : i === idx ? "bg-accent" : "bg-ink/[0.08]"}`}>
                    <span className="sr-only">
                      {ETAPA[e].label}
                      {i < idx ? " (completada)" : i === idx ? " (actual)" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <EstadoPill estado={c.estado} subestado={c.subestado} />
          </div>

          {data.siguienteAccion && (
            <div className="rounded-xl bg-accent-soft p-3 text-sm">
              <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">Siguiente acción</p>
              <p className="mt-0.5 font-medium text-ink">{data.siguienteAccion}</p>
              <p className="mt-0.5 text-xs text-muted">Responsable: {data.responsable ?? "Sin asignar"}</p>
            </div>
          )}

          <Facts
            items={[
              ["RUT", <Mono key="r">{c.rut}</Mono>],
              ["Teléfono", c.telefono],
              ["Correo", c.email],
              ["Comuna", c.comuna],
              ["Origen", `${ORIGEN_LABEL[c.origen]}${c.campana ? ` · ${c.campana}` : ""}`],
              ["Ingreso", formatDateTime(c.creadoEn)],
            ]}
          />

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Vehículos</h3>
            {data.vehiculos.length === 0 ? (
              <p className="text-sm text-muted">Sin vehículos registrados.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.vehiculos.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-sm">
                    <Patente>{v.patente}</Patente> {v.marca} {v.modelo} · {v.anio}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {orden && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Orden</h3>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-sunken/60 p-3 text-sm">
                <span>
                  <Mono>{orden.folio}</Mono> · {getPlan(orden.planId).name} · {orden.periodicidad}
                  <span className="block text-xs text-muted">{data.pagos.filter((p) => p.ordenFolio === orden.folio).length} intento(s) de pago</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono tabular-nums">{clp(orden.montoTotal)}</span>
                  <Pill tone={ESTADO_ORDEN[orden.estado].tone}>{ESTADO_ORDEN[orden.estado].label}</Pill>
                </span>
              </div>
            </section>
          )}

          {visita && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Instalación</h3>
              <Link href={`/visitas/${visita.folio}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-sunken/60 p-3 text-sm transition-colors hover:bg-bg-sunken">
                <span>
                  <Mono>{visita.folio}</Mono>
                  <span className="block text-xs text-muted">
                    {visita.fecha ? `${formatShortDate(visita.fecha)} · ${visita.bloque} · ${visita.tecnico}` : "Sin fecha"}
                  </span>
                </span>
                <Pill tone={GRUPO_VISITA[visita.grupo].tone}>{GRUPO_VISITA[visita.grupo].label}</Pill>
              </Link>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Últimos eventos</h3>
            <ol className="flex flex-col gap-2">
              {data.eventos.slice(0, 6).map((e) => (
                <li key={e.id} className="grid grid-cols-[6.5rem_1fr] gap-2 text-sm">
                  <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-medium tracking-wide uppercase">
                      {e.demo && <CheckIcon className="size-3 text-accent-ink" strokeWidth={3} aria-label="Acción de la demo" />}
                      {e.tipo}
                    </span>
                    {e.detalle && <span className="block truncate text-xs text-muted">{e.detalle}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Sheet>
  );
}
