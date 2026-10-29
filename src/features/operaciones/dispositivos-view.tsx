"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useQuery } from "@/services";
import { ESTADO_DISPOSITIVO } from "@/lib/domain/labels";
import type { Dispositivo } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { Empty, Kpi, Mono, PageHeader, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { DemoAction } from "@/components/ui/demo-action";
import { SearchIcon } from "@/components/ui/icons";

const ACTIVACION: Record<Dispositivo["estado"], { label: string; tone: "ok" | "amber" | "muted" | "danger" }> = {
  activo: { label: "Activado", tone: "ok" },
  instalado: { label: "Pendiente", tone: "amber" },
  en_stock: { label: "—", tone: "muted" },
  asignado: { label: "—", tone: "muted" },
  falla: { label: "No activable", tone: "danger" },
  retirado: { label: "Desactivado", tone: "muted" },
};

export function DispositivosView({ tipo: tipoParam }: { tipo?: string }) {
  const { data: todos } = useQuery("dispositivos", (s) => s.devices.list());
  const { exec, pending } = useAction();
  const [estado, setEstado] = useState<Dispositivo["estado"] | "">("");
  const [q, setQ] = useState("");
  const tipo = tipoParam === "gps" || tipoParam === "tag" ? tipoParam : null;

  const header = (
    <PageHeader
      eyebrow="Operaciones"
      title="Dispositivos"
      description={
        <>
          Inventario por IMEI: GPS VL103M (señal principal) y TAG PB705 (señal de respaldo). IMEI de prueba. El pulso y la activación real vendrán de la plataforma GPS. <SimTag>Pulsos simulados</SimTag>
        </>
      }
      actions={<DemoAction result="se valida cada IMEI (15 dígitos, Luhn, sin duplicados) y el lote queda en bodega.">Cargar lote CSV</DemoAction>}
    />
  );
  if (!todos) {
    return (
      <>
        {header}
        <KpiSkeleton count={5} />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }

  const count = (e: Dispositivo["estado"]) => todos.filter((d) => d.estado === e).length;
  const nq = q.trim().toLowerCase();
  const lista = todos
    .filter((d) => !tipo || d.tipo === tipo)
    .filter((d) => !estado || d.estado === estado)
    .filter((d) => !nq || `${d.imei} ${d.patente ?? ""} ${d.clienteNombre ?? ""} ${d.tecnico ?? ""}`.toLowerCase().includes(nq));

  return (
    <>
      {header}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Activos" value={count("activo")} tone="ok" />
        <Kpi label="Instalados por activar" value={count("instalado")} tone={count("instalado") ? "amber" : undefined} />
        <Kpi label="En bodega" value={count("en_stock")} />
        <Kpi label="En custodia de técnicos" value={count("asignado")} href="/tecnicos" />
        <Kpi label="Con falla" value={count("falla")} tone={count("falla") ? "danger" : undefined} />
        <Kpi label="Retirados" value={count("retirado")} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          current={tipo ?? "todos"}
          items={[
            { key: "todos", label: "Todos", href: "/dispositivos", count: todos.length },
            { key: "gps", label: "GPS VL103M", href: "/dispositivos?tipo=gps", count: todos.filter((d) => d.tipo === "gps").length },
            { key: "tag", label: "TAG PB705", href: "/dispositivos?tipo=tag", count: todos.filter((d) => d.tipo === "tag").length },
          ]}
        />
        <div className="mb-5 flex flex-wrap gap-2">
          <label htmlFor="f-estado" className="sr-only">Estado de inventario</label>
          <select id="f-estado" className="field h-9 w-auto" value={estado} onChange={(e) => setEstado(e.target.value as Dispositivo["estado"] | "")}>
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_DISPOSITIVO) as Dispositivo["estado"][]).map((e) => <option key={e} value={e}>{ESTADO_DISPOSITIVO[e].label}</option>)}
          </select>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <label htmlFor="buscar-imei" className="sr-only">Buscar dispositivo</label>
            <input id="buscar-imei" type="search" className="field h-9 pl-9" placeholder="IMEI, patente, cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      {lista.length === 0 ? (
        <Empty>No hay equipos con ese filtro.</Empty>
      ) : (
        <Table head={["IMEI", "Modelo", "Inventario", "Activación", "Vehículo", "Instalado", "Custodia", "Último pulso", "Batería", ""]} minWidth={1180}>
          {lista.map((d) => (
            <tr key={d.imei} className="hover:bg-surface-2">
              <td><Mono>{d.imei}</Mono>{d.simIccid && <span className="block font-mono text-[0.7rem] text-muted">SIM {d.simIccid}</span>}</td>
              <td>{d.modelo} <span className="text-xs text-muted">· {d.tipo === "gps" ? "principal" : "respaldo"}</span></td>
              <td><Pill tone={ESTADO_DISPOSITIVO[d.estado].tone}>{ESTADO_DISPOSITIVO[d.estado].label}</Pill></td>
              <td>{ACTIVACION[d.estado].label === "—" ? <span className="text-muted">—</span> : <Pill tone={ACTIVACION[d.estado].tone}>{ACTIVACION[d.estado].label}</Pill>}</td>
              <td>
                {d.patente && d.clienteId ? (
                  <Link href={`/clientes/${d.clienteId}?tab=vehiculos`} className="inline-flex flex-col gap-0.5 hover:underline">
                    <Patente>{d.patente}</Patente>
                    <span className="text-xs text-muted">{d.clienteNombre}</span>
                  </Link>
                ) : "—"}
              </td>
              <td className="font-mono text-xs text-muted">{d.instaladoEn ? formatDateTime(d.instaladoEn) : "—"}</td>
              <td className="text-ink-soft">{d.tecnico ?? "—"}</td>
              <td className="font-mono text-xs text-muted">{d.ultimoPulso ? formatDateTime(d.ultimoPulso) : "—"}</td>
              <td className="tabular-nums">{d.bateria != null ? `${d.bateria}%` : "—"}</td>
              <td className="text-right">
                {d.estado === "instalado" && d.clienteId && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec((s) => s.devices.activate(d.clienteId!), "Servicio activado (demo)")}>
                    Activar (demo)
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">La activación real depende de la API de la plataforma GPS (pendiente con el equipo de Adolfo y Camila). En la demo la confirma una persona.</p>
    </>
  );
}
