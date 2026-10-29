"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/services";
import type { VisitaFila } from "@/services/mock/queries";
import { CAUSA_FALLA, GRUPO_VISITA, TIPO_VISITA, type GrupoVisita } from "@/lib/domain/labels";
import { formatShortDate, relativeDay } from "@/lib/format";
import { Empty, Kpi, Mono, PageHeader, Patente, Pill, Table, Tabs } from "@/components/ui/kit";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { CalendarIcon, SearchIcon } from "@/components/ui/icons";
import { ReservaModal } from "./reserva-modal";

const PESTANAS: { key: string; label: string; match: (v: VisitaFila, hoy: string) => boolean }[] = [
  { key: "hoy", label: "Hoy", match: (v, h) => v.fecha === h && v.estado !== "cancelada" },
  ...(Object.keys(GRUPO_VISITA) as GrupoVisita[]).map((g) => ({ key: g, label: GRUPO_VISITA[g].label, match: (v: VisitaFila) => v.grupo === g })),
];

export function VisitasView({ tab: tabParam }: { tab?: string }) {
  const { data } = useQuery("visitas", async (s) => ({ visitas: await s.installers.appointments(), hoy: await s.dashboard.today() }));
  const [q, setQ] = useState("");
  const [reservar, setReservar] = useState(false);
  const tab = PESTANAS.find((p) => p.key === tabParam) ?? PESTANAS[0];

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Operaciones" title="Instalaciones" />
        <KpiSkeleton />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }
  const { visitas: todas, hoy } = data;
  const plainQ = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visitas = todas
    .filter((v) => tab.match(v, hoy))
    .filter((v) => !plainQ || `${v.cliente.nombre} ${v.folio} ${v.vehiculo.patente} ${v.comuna} ${v.tecnico ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(plainQ))
    .sort((a, b) => (tab.key === "completada" ? -1 : 1) * `${a.fecha ?? a.creadaEn}${a.bloque ?? ""}`.localeCompare(`${b.fecha ?? b.creadaEn}${b.bloque ?? ""}`));
  const count = (g: GrupoVisita) => todas.filter((v) => v.grupo === g).length;

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Instalaciones"
        description="Instalaciones, segundas visitas, visitas técnicas y traslados. Una visita nunca queda «completada» si hubo falla: pasa a revisión con ticket."
        actions={
          <>
            <Link href="/agenda" className="btn btn-secondary"><CalendarIcon className="size-4" /> Agenda</Link>
            <button type="button" className="btn btn-primary" onClick={() => setReservar(true)}>Reservar instalación</button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pendientes de agenda" value={count("pendiente")} tone={count("pendiente") ? "brand" : undefined} href="/visitas?tab=pendiente" hint="Pagadas sin día ni técnico" />
        <Kpi label="Asignadas" value={count("asignada")} href="/visitas?tab=asignada" hint="Con técnico y bloque" />
        <Kpi label="En terreno ahora" value={count("en_camino") + count("en_proceso")} tone="accent" href="/visitas?tab=en_proceso" hint="En camino o instalando" />
        <Kpi label="Requieren revisión" value={count("revision")} tone={count("revision") ? "danger" : undefined} href="/visitas?tab=revision" hint="Falla, no-show o sin técnico" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs current={tab.key} items={PESTANAS.map((p) => ({ key: p.key, label: p.label, href: `/visitas?tab=${p.key}`, count: todas.filter((v) => p.match(v, hoy)).length }))} />
        <div className="relative mb-5 w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <label htmlFor="buscar-visitas" className="sr-only">Buscar instalaciones</label>
          <input id="buscar-visitas" type="search" className="field h-9 pl-9" placeholder="Cliente, folio, patente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {visitas.length === 0 ? (
        <Empty>No hay instalaciones en esta pestaña{q ? " con esa búsqueda" : ""}.</Empty>
      ) : (
        <Table head={["Folio", "Cliente", "Tipo", "Fecha y bloque", "Técnico", "Comuna", "Estado"]} minWidth={980}>
          {visitas.map((v) => (
            <tr key={v.folio} className="hover:bg-surface-2">
              <td><Link href={`/visitas/${v.folio}`} className="font-mono text-sm text-accent-ink hover:underline">{v.folio}</Link></td>
              <td>
                <Link href={`/clientes/${v.clienteId}`} className="font-medium hover:underline">{v.cliente.nombre}</Link>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Patente>{v.vehiculo.patente}</Patente> {v.vehiculo.marca} {v.vehiculo.modelo}</span>
              </td>
              <td>{TIPO_VISITA[v.tipo]}</td>
              <td className="whitespace-nowrap">
                {v.fecha ? <>{formatShortDate(v.fecha)} · <Mono>{v.bloque}</Mono><span className="block text-xs text-muted">{relativeDay(v.fecha, hoy)}</span></> : <span className="text-muted">Sin fecha</span>}
              </td>
              <td>{v.tecnico ?? <span className="text-muted">Sin asignar</span>}</td>
              <td>{v.comuna}</td>
              <td>
                <Pill tone={GRUPO_VISITA[v.grupo].tone}>{GRUPO_VISITA[v.grupo].label}</Pill>
                {v.causaFalla && <span className="mt-0.5 block text-xs text-danger">{CAUSA_FALLA[v.causaFalla]}</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {reservar && <ReservaModal open onClose={() => setReservar(false)} />}
    </>
  );
}
