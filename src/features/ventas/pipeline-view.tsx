"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { useAction, useQuery } from "@/services";
import type { FiltroPipeline, TarjetaPipeline } from "@/services/mock/queries";
import { ETAPA, AVANCE, etapaSiguiente, type Etapa } from "@/lib/domain/pipeline";
import { ORIGEN_LABEL } from "@/lib/domain/labels";
import type { Origen } from "@/lib/domain/types";
import { plans, type PlanId } from "@/lib/plans";
import { clp, formatDateTime, relativeDay } from "@/lib/format";
import { Avatar, DemoTag, Dot, Mono, PageHeader, Patente } from "@/components/ui/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, GripIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { NuevoLeadModal } from "./nuevo-lead";
import { ClienteSheet } from "./cliente-sheet";
import { useAvanzar } from "./use-avanzar";

export function PipelineView() {
  const [filtro, setFiltro] = useState<FiltroPipeline>({});
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [arrastre, setArrastre] = useState<{ id: string; etapa: Etapa } | null>(null);
  // El ref se actualiza en el mismo evento: dragover no puede esperar al render.
  const arrastreRef = useRef<{ id: string; etapa: Etapa } | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const { avanzar, dialogs, pending } = useAvanzar();
  const { exec } = useAction();

  const { data: board } = useQuery(`board-${JSON.stringify(filtro)}`, (s) => s.pipeline.board(filtro));
  const { data: equipo } = useQuery("team", (s) => s.customers.team());
  const { data: historial } = useQuery("pipeline-history", (s) => s.pipeline.history(8));

  const hayFiltros = Object.values(filtro).some(Boolean);
  const set = (k: keyof FiltroPipeline, v: string) => setFiltro((f) => ({ ...f, [k]: v || undefined }));

  function onDrop(e: DragEvent, etapa: Etapa) {
    e.preventDefault();
    setSobre(null);
    const card = board?.columnas.flatMap((c) => c.tarjetas).find((t) => t.id === arrastreRef.current?.id);
    arrastreRef.current = null;
    setArrastre(null);
    if (!card || etapaSiguiente(card.etapa) !== etapa) return;
    avanzar({ id: card.id, nombre: card.nombre, etapa: card.etapa, vehiculos: card.vehiculos });
  }

  const valorAbierto = board?.columnas.filter((c) => c.etapa !== "activo").reduce((s, c) => s + c.monto, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Pipeline comercial"
        description="Del lead a la activación. Mover una tarjeta ejecuta el evento simulado del sistema (pago, reserva, instalación o activación); solo se avanza a la etapa siguiente."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}>
            <PlusIcon className="size-4" /> Nuevo lead
          </button>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <label htmlFor="buscar-pipeline" className="sr-only">
            Buscar en el pipeline
          </label>
          <input
            id="buscar-pipeline"
            type="search"
            placeholder="Nombre, RUT, patente o comuna"
            value={filtro.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
            className="field h-9 pl-9"
          />
        </div>
        <label className="sr-only" htmlFor="f-resp">Responsable</label>
        <select id="f-resp" className="field h-9 w-auto" value={filtro.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value)}>
          <option value="">Todos los responsables</option>
          {(equipo ?? []).filter((u) => u.rol === "ventas" || u.rol === "operaciones").map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-plan">Plan</label>
        <select id="f-plan" className="field h-9 w-auto" value={filtro.planId ?? ""} onChange={(e) => set("planId", e.target.value as PlanId)}>
          <option value="">Todos los planes</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-origen">Origen</label>
        <select id="f-origen" className="field h-9 w-auto" value={filtro.origen ?? ""} onChange={(e) => set("origen", e.target.value as Origen)}>
          <option value="">Todos los orígenes</option>
          {(Object.keys(ORIGEN_LABEL) as Origen[]).map((o) => (
            <option key={o} value={o}>{ORIGEN_LABEL[o]}</option>
          ))}
        </select>
        {hayFiltros && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiltro({})}>
            Limpiar filtros
          </button>
        )}
        <p className="ml-auto text-sm text-muted" aria-live="polite">
          {board ? (
            <>
              <span className="font-semibold text-ink tabular-nums">{board.total}</span> casos · <span className="tabular-nums">{clp(valorAbierto)}</span> en órdenes abiertas
              {board.fuera > 0 && (
                <>
                  {" · "}
                  <Link href="/clientes?estado=SUSPENDIDO" className="underline underline-offset-2 hover:text-ink">
                    {board.fuera} fuera del embudo
                  </Link>
                </>
              )}
            </>
          ) : (
            "Cargando…"
          )}
        </p>
      </div>

      {/* Tablero */}
      <div className="relative -mx-4 snap-x snap-proximity overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-8 sm:px-8">
        <div className="grid min-w-[140rem] grid-cols-8 gap-3">
          {(board?.columnas ?? ETAPAS_VACIAS).map((col) => {
            const valida = arrastre ? etapaSiguiente(arrastre.etapa) === col.etapa : false;
            const over = sobre === col.etapa ? (valida ? "true" : arrastre && arrastre.etapa !== col.etapa ? "invalid" : undefined) : undefined;
            return (
              <section
                key={col.etapa}
                aria-labelledby={`col-${col.etapa}`}
                data-over={over}
                onDragOver={(e) => {
                  const actual = arrastreRef.current;
                  if (actual && etapaSiguiente(actual.etapa) === col.etapa) e.preventDefault();
                  if (sobre !== col.etapa) setSobre(col.etapa);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null);
                }}
                onDrop={(e) => onDrop(e, col.etapa)}
                className="kanban-drop flex min-h-[24rem] snap-start flex-col rounded-2xl bg-bg-sunken/60 p-2 transition-colors"
              >
                <header className="px-2 pt-1.5 pb-2.5">
                  <h2 id={`col-${col.etapa}`} className="flex items-center gap-2 text-sm font-semibold">
                    <Dot tone={ETAPA[col.etapa].tone} />
                    {ETAPA[col.etapa].label}
                    <span className="ml-auto rounded-md bg-ink/[0.07] px-1.5 font-mono text-xs text-muted">{board ? col.tarjetas.length : "–"}</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">{ETAPA[col.etapa].ayuda}</p>
                  {col.monto > 0 && <p className="mt-1 font-mono text-xs text-ink-soft tabular-nums">{clp(col.monto)}</p>}
                </header>
                {!board ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-36 rounded-xl" />
                    <Skeleton className="h-36 rounded-xl" />
                  </div>
                ) : col.tarjetas.length === 0 ? (
                  <p className="mx-1 rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                    {arrastre && valida ? "Suelta aquí para avanzar" : "Sin casos en esta etapa"}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {col.tarjetas.map((t) => (
                      <Tarjeta
                        key={t.id}
                        t={t}
                        hoy={board.hoy}
                        arrastrando={arrastre?.id === t.id}
                        onOpen={() => setAbierto(t.id)}
                        onAvanzar={() => avanzar({ id: t.id, nombre: t.nombre, etapa: t.etapa, vehiculos: t.vehiculos })}
                        onDragStart={() => {
                          arrastreRef.current = { id: t.id, etapa: t.etapa };
                          setArrastre(arrastreRef.current);
                        }}
                        onDragEnd={() => {
                          arrastreRef.current = null;
                          setArrastre(null);
                          setSobre(null);
                        }}
                        pending={pending}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Historial de la demo */}
      <section className="mt-2 rounded-2xl bg-surface p-5" aria-labelledby="hist">
        <h2 id="hist" className="flex items-center gap-2 font-display text-[0.95rem] font-bold">
          Historial de movimientos <DemoTag />
        </h2>
        {!historial ? (
          <Skeleton className="mt-3 h-16" />
        ) : historial.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aún no hay movimientos en esta demo. Arrastra una tarjeta a la columna siguiente o usa la flecha de cada tarjeta.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/70">
            {historial.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-sm">
                <span className="w-28 shrink-0 font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                <span className="font-mono text-xs font-medium tracking-wide uppercase">{e.tipo}</span>
                {e.clienteId ? (
                  <Link href={`/clientes/${e.clienteId}`} className="text-ink-soft hover:underline">
                    {e.cliente}
                  </Link>
                ) : null}
                {e.detalle && <span className="min-w-0 flex-1 truncate text-muted">{e.detalle}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ClienteSheet
        id={abierto}
        onClose={() => setAbierto(null)}
        pending={pending}
        onAvanzar={(caso) => avanzar(caso)}
        onRechazarPago={(folio) => exec((s) => s.orders.rejectPayment(folio), "Pago rechazado (simulado)")}
      />
      <NuevoLeadModal open={nuevo} onClose={() => setNuevo(false)} onCreated={(id) => setAbierto(id)} />
      {dialogs}
    </>
  );
}

const ETAPAS_VACIAS = (Object.keys(ETAPA) as Etapa[]).map((etapa) => ({ etapa, tarjetas: [] as TarjetaPipeline[], monto: 0 }));

function Tarjeta({
  t,
  hoy,
  arrastrando,
  onOpen,
  onAvanzar,
  onDragStart,
  onDragEnd,
  pending,
}: {
  t: TarjetaPipeline;
  hoy: string;
  arrastrando: boolean;
  onOpen: () => void;
  onAvanzar: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  pending: boolean;
}) {
  const siguiente = etapaSiguiente(t.etapa);
  const alerta =
    t.ordenEstado === "abandonada"
      ? { txt: "Abandonado", cls: "bg-amber-soft text-amber" }
      : t.ordenEstado === "pago_rechazado"
        ? { txt: "Pago rechazado", cls: "bg-danger-soft text-danger" }
        : t.subestado === "INCIDENCIA INSTALACIÓN"
          ? { txt: "Incidencia", cls: "bg-danger-soft text-danger" }
          : null;

  return (
    <li
      draggable={!!siguiente}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl bg-surface p-3 shadow-[0_1px_0_var(--line)] transition-[opacity,box-shadow,transform] duration-200 hover:shadow-card ${
        arrastrando ? "scale-[0.98] opacity-50" : ""
      } ${siguiente ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        {siguiente && <GripIcon className="mt-0.5 size-4 shrink-0 text-muted/60" aria-hidden="true" />}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring">
          <span className="block truncate text-sm font-semibold">{t.nombre}</span>
          <span className="block truncate text-xs text-muted">
            {t.plan ? `${t.plan} · ${t.periodicidad}` : "Sin plan elegido"}
          </span>
        </button>
        {siguiente && (
          <button
            type="button"
            onClick={onAvanzar}
            disabled={pending}
            title={`${AVANCE[t.etapa as Exclude<Etapa, "activo">].accion} → ${ETAPA[siguiente].label}`}
            className="relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted opacity-70 transition-[opacity,background-color] hover:bg-accent-soft hover:text-accent-ink group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ArrowRightIcon className="size-4" />
            <span className="sr-only">
              {AVANCE[t.etapa as Exclude<Etapa, "activo">].accion}: mover {t.nombre} a {ETAPA[siguiente].label}
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        {t.patente && <Patente>{t.patente}</Patente>}
        <span className="truncate">{t.vehiculo ?? "Sin vehículo"}</span>
        {t.vehiculos > 1 && <span className="text-muted">+{t.vehiculos - 1}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <Mono className={t.monto ? "text-ink tabular-nums" : "text-muted"}>{t.monto ? clp(t.monto) : "—"}</Mono>
        <span className="text-muted">{ORIGEN_LABEL[t.origen]}</span>
      </div>

      {alerta && <span className={`mt-2 inline-block rounded-md px-1.5 py-px text-[0.7rem] font-semibold ${alerta.cls}`}>{alerta.txt}</span>}
      {t.visita?.fecha && t.etapa === "instalacion_agendada" && (
        <p className="mt-2 font-mono text-xs text-accent-ink">
          {relativeDay(t.visita.fecha, hoy)} · {t.visita.bloque}
        </p>
      )}

      <p className="mt-2 border-t border-line/60 pt-2 text-xs text-ink-soft">
        <span className="text-muted">Siguiente:</span> {t.siguienteAccion}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        <Avatar name={t.responsable ?? "?"} className="size-5 text-[0.6rem]" />
        <span className="truncate">{t.responsable ?? "Sin responsable"}</span>
        <span className="ml-auto shrink-0">{relativeDay(t.creadoEn.slice(0, 10), hoy)}</span>
      </p>
    </li>
  );
}
