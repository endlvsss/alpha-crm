"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/services";
import type { Calendario, VisitaFila } from "@/services/mock/queries";
import { addDays, BLOQUES, BLOQUE_FIN } from "@/data/seed";
import { diaSemana } from "@/lib/domain/agenda";
import { GRUPO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import { capitalize, dateParts, formatLongDate, formatShortDate, type IsoDate } from "@/lib/format";
import type { Tecnico } from "@/lib/domain/types";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { Avatar, PageHeader, Pill } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/form";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ReservaModal } from "./reserva-modal";

type Vista = "dia" | "semana" | "mes";

function lunesDe(fecha: IsoDate) {
  const d = diaSemana(fecha) || 7;
  return addDays(fecha, 1 - d);
}

/** Rango que cubre cada vista: el día, la semana (lunes a sábado) o el mes en semanas completas. */
function rangoVista(vista: Vista, ancla: IsoDate): { desde: IsoDate; dias: number } {
  if (vista === "dia") return { desde: ancla, dias: 1 };
  if (vista === "semana") return { desde: lunesDe(ancla), dias: 6 };
  const primero = `${ancla.slice(0, 8)}01`;
  const desde = lunesDe(primero);
  return { desde, dias: 42 };
}

function mover(vista: Vista, ancla: IsoDate, n: number): IsoDate {
  if (vista === "dia") {
    let d = addDays(ancla, n);
    if (diaSemana(d) === 0) d = addDays(d, n);
    return d;
  }
  if (vista === "semana") return addDays(ancla, 7 * n);
  const [y, m] = ancla.split("-").map(Number);
  const nm = new Date(Date.UTC(y, m - 1 + n, 1));
  return nm.toISOString().slice(0, 10);
}

export function AgendaView() {
  const { data: hoy } = useQuery("today", (s) => s.dashboard.today());
  const [vista, setVista] = useState<Vista>("semana");
  const [ancla, setAncla] = useState<IsoDate | null>(null);
  const [tecnicoId, setTecnicoId] = useState("");
  const [reservar, setReservar] = useState(false);
  const fecha = ancla ?? hoy ?? null;
  const r = fecha ? rangoVista(vista, fecha) : null;
  const { data: cal } = useQuery(`cal-${r?.desde}-${r?.dias}`, (s) => (r ? s.installers.calendar(r.desde, r.dias) : Promise.resolve(null)));

  const tecnicos = (cal?.tecnicos ?? []).filter((t) => !tecnicoId || t.id === tecnicoId);
  const titulo =
    !fecha || !r
      ? "…"
      : vista === "dia"
        ? capitalize(formatLongDate(fecha))
        : vista === "semana"
          ? `${formatShortDate(r.desde)} – ${formatShortDate(addDays(r.desde, 5))}`
          : capitalize(new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${fecha.slice(0, 8)}15T12:00:00Z`)));

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Agenda"
        description="Bloques de 2 horas por técnico. El cliente solo ve horarios libres; nunca elige técnico. Sin doble reserva: un bloque, una visita."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setReservar(true)}>
            <PlusIcon className="size-4" /> Reservar instalación
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Vista>
          label="Vista"
          value={vista}
          onChange={setVista}
          options={[
            { value: "dia", label: "Día" },
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <div className="flex items-center gap-1 rounded-xl bg-surface p-1">
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-ink/[0.06]" aria-label="Anterior" onClick={() => fecha && setAncla(mover(vista, fecha, -1))}>
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="min-w-40 px-2 text-center text-sm font-medium tabular-nums" aria-live="polite">{titulo}</span>
          <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-ink/[0.06]" aria-label="Siguiente" onClick={() => fecha && setAncla(mover(vista, fecha, 1))}>
            <ChevronRightIcon className="size-4" />
          </button>
          {ancla && ancla !== hoy && (
            <button type="button" className="rounded-lg px-2 py-1 text-sm text-accent-ink hover:bg-ink/[0.06]" onClick={() => setAncla(null)}>Hoy</button>
          )}
        </div>
        <label htmlFor="f-tec" className="sr-only">Técnico</label>
        <select id="f-tec" className="field h-9 w-auto" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
          <option value="">Todos los técnicos</option>
          {(cal?.tecnicos ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <Leyenda />
      </div>

      {!cal || !hoy ? (
        <TableSkeleton rows={6} />
      ) : vista === "mes" ? (
        <Mes cal={cal} tecnicos={tecnicos} mes={fecha!.slice(0, 7)} onDia={(d) => { setAncla(d); setVista("dia"); }} />
      ) : vista === "dia" ? (
        <Dia cal={cal} tecnicos={tecnicos} fecha={fecha!} />
      ) : (
        <Semana cal={cal} tecnicos={tecnicos} />
      )}

      <p className="mt-3 text-xs text-muted">
        Bloques, horizonte (21 días) y cupo por técnico son parámetros propuestos, a validar con Operaciones. En la demo se permite reservar desde hoy.
      </p>
      {reservar && <ReservaModal open onClose={() => setReservar(false)} />}
    </>
  );
}

function Leyenda() {
  return (
    <ul className="ml-auto hidden flex-wrap items-center gap-3 text-xs text-muted xl:flex" aria-label="Leyenda">
      {(["asignada", "en_proceso", "completada", "revision"] as const).map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${{ asignada: "bg-amber-bright", en_proceso: "bg-accent", completada: "bg-ok", revision: "bg-danger" }[g]}`} />
          {GRUPO_VISITA[g].label}
        </li>
      ))}
    </ul>
  );
}

function VisitaChip({ v, compact = false }: { v: VisitaFila; compact?: boolean }) {
  return (
    <Link href={`/visitas/${v.folio}`} className="block rounded-lg bg-bg-sunken px-2 py-1.5 transition-colors hover:bg-accent-soft">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-mono text-xs text-muted">{v.bloque}</span>
        <Pill tone={GRUPO_VISITA[v.grupo].tone}>{GRUPO_VISITA[v.grupo].label}</Pill>
      </span>
      <span className="mt-0.5 block truncate text-xs font-medium">{v.cliente.nombre}</span>
      {!compact && <span className="block truncate text-xs text-muted">{TIPO_VISITA[v.tipo]} · {v.comuna}</span>}
    </Link>
  );
}

function Libre({ t, fecha, bloque, hoy, ocupadas }: { t: Tecnico; fecha: IsoDate; bloque: string; hoy: IsoDate; ocupadas: number }) {
  const atiende = t.disponibilidad[diaSemana(fecha)]?.includes(bloque);
  const lleno = ocupadas >= t.cupoDiario;
  const txt = fecha < hoy ? "" : !atiende ? "no atiende" : lleno ? "cupo lleno" : "libre";
  return (
    <span className={`block rounded-lg px-2 py-1 font-mono text-xs ${txt === "libre" ? "text-ok/80" : "text-muted/60"}`} title={`${bloque}–${BLOQUE_FIN[bloque]}`}>
      {bloque} {txt && `· ${txt}`}
    </span>
  );
}

function Semana({ cal, tecnicos }: { cal: Calendario; tecnicos: Tecnico[] }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[68rem] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-52 px-4 py-3 text-left text-xs font-medium text-muted">Técnico</th>
            {cal.dias.map((d) => {
              const p = dateParts(d);
              return (
                <th key={d} scope="col" className="px-2 py-3 text-left">
                  <span className={`inline-flex items-baseline gap-1.5 rounded-lg px-2 py-1 ${d === cal.hoy ? "bg-accent-soft text-accent-ink" : ""}`}>
                    <span className="text-xs font-medium text-muted capitalize">{p.weekday}</span>
                    <span className="font-display text-base font-bold">{p.day}</span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tecnicos.map((t) => (
            <tr key={t.id}>
              <th scope="row" className="border-t border-line/70 px-4 py-3 text-left align-top font-normal">
                <Link href={`/tecnicos/${t.id}`} className="flex items-center gap-2.5 hover:text-accent-ink">
                  <Avatar name={t.nombre} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.nombre}</span>
                    <span className="block text-xs text-muted">Cupo {t.cupoDiario} por día</span>
                  </span>
                </Link>
              </th>
              {cal.dias.map((d) => {
                const delDia = cal.visitas.filter((v) => v.tecnicoId === t.id && v.fecha === d && v.estado !== "cancelada");
                return (
                  <td key={d} className={`border-t border-l border-line/70 p-1.5 align-top ${d < cal.hoy ? "opacity-60" : ""}`}>
                    <ul className="flex flex-col gap-1">
                      {BLOQUES.map((b) => {
                        const v = delDia.find((x) => x.bloque === b);
                        return <li key={b}>{v ? <VisitaChip v={v} /> : <Libre t={t} fecha={d} bloque={b} hoy={cal.hoy} ocupadas={delDia.length} />}</li>;
                      })}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dia({ cal, tecnicos, fecha }: { cal: Calendario; tecnicos: Tecnico[]; fecha: IsoDate }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-28 px-4 py-3 text-left text-xs font-medium text-muted">Bloque</th>
            {tecnicos.map((t) => (
              <th key={t.id} scope="col" className="px-2 py-3 text-left">
                <span className="flex items-center gap-2">
                  <Avatar name={t.nombre} className="size-7" />
                  <span className="truncate font-medium">{t.nombre}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOQUES.map((b) => (
            <tr key={b}>
              <th scope="row" className="border-t border-line/70 px-4 py-3 text-left align-top font-mono text-xs font-medium text-muted">
                {b}–{BLOQUE_FIN[b]}
              </th>
              {tecnicos.map((t) => {
                const delDia = cal.visitas.filter((v) => v.tecnicoId === t.id && v.fecha === fecha && v.estado !== "cancelada");
                const v = delDia.find((x) => x.bloque === b);
                return (
                  <td key={t.id} className="h-24 border-t border-l border-line/70 p-1.5 align-top">
                    {v ? <VisitaChip v={v} /> : <Libre t={t} fecha={fecha} bloque={b} hoy={cal.hoy} ocupadas={delDia.length} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mes({ cal, tecnicos, mes, onDia }: { cal: Calendario; tecnicos: Tecnico[]; mes: string; onDia: (d: IsoDate) => void }) {
  const ids = new Set(tecnicos.map((t) => t.id));
  const capacidad = tecnicos.filter((t) => t.estado === "activo").reduce((s, t) => s + t.cupoDiario, 0);
  const semanas = Array.from({ length: 6 }, (_, w) => cal.dias.slice(w * 7, w * 7 + 7));
  return (
    <div className="relative overflow-x-auto rounded-2xl bg-surface p-2">
      <div className="grid min-w-[46rem] grid-cols-7 gap-1">
        {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted capitalize">{d}</div>
        ))}
        {semanas.flat().map((d) => {
          const vs = cal.visitas.filter((v) => v.fecha === d && v.estado !== "cancelada" && v.tecnicoId && ids.has(v.tecnicoId));
          const fuera = !d.startsWith(mes);
          const domingo = diaSemana(d) === 0;
          const uso = capacidad ? vs.length / capacidad : 0;
          return (
            <button
              key={d}
              type="button"
              disabled={domingo}
              onClick={() => onDia(d)}
              className={`flex min-h-24 flex-col rounded-xl p-2 text-left transition-colors ${fuera ? "opacity-40" : ""} ${domingo ? "bg-transparent" : "bg-bg-sunken/60 hover:bg-bg-sunken"} ${d === cal.hoy ? "ring-2 ring-accent" : ""}`}
            >
              <span className="flex items-center justify-between">
                <span className="font-display text-sm font-bold">{Number(d.slice(8))}</span>
                {!domingo && vs.length > 0 && <span className="font-mono text-[0.7rem] text-muted">{vs.length}/{capacidad}</span>}
              </span>
              {!domingo && (
                <>
                  <span className="mt-auto flex flex-wrap gap-1 pt-2">
                    {(["asignada", "en_camino", "en_proceso", "completada", "revision"] as const).map((g) => {
                      const n = vs.filter((v) => v.grupo === g).length;
                      return n ? (
                        <span key={g} className={`rounded px-1 font-mono text-[0.7rem] ${{ asignada: "bg-amber-soft text-amber", en_camino: "bg-accent-soft text-accent-ink", en_proceso: "bg-accent-soft text-accent-ink", completada: "bg-ok-soft text-ok", revision: "bg-danger-soft text-danger" }[g]}`} title={GRUPO_VISITA[g].label}>
                          {n}
                        </span>
                      ) : null;
                    })}
                  </span>
                  <span className="mt-1.5 block h-1 rounded-full bg-ink/[0.07]" aria-hidden="true">
                    <span className={`block h-1 rounded-full ${uso >= 0.85 ? "bg-danger" : uso >= 0.5 ? "bg-amber-bright" : "bg-ok"}`} style={{ width: `${Math.min(100, uso * 100)}%` }} />
                  </span>
                  <span className="sr-only">{vs.length} visitas de {capacidad} cupos</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
