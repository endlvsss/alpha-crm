"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@/services";
import { getPlan } from "@/lib/plans";
import { ESTADOS_CLIENTE, type EstadoCliente } from "@/lib/domain/types";
import { ORIGEN_LABEL } from "@/lib/domain/labels";
import { ETAPA } from "@/lib/domain/pipeline";
import { formatDateTime } from "@/lib/format";
import { Empty, EstadoPill, PageHeader, Patente, Pill, Table, Tabs } from "@/components/ui/kit";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { NuevoLeadModal } from "@/features/ventas/nuevo-lead";

export function ClientesView({ estado, q }: { estado?: EstadoCliente; q?: string }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(false);
  const [texto, setTexto] = useState(q ?? "");
  const { data: todos } = useQuery(`clientes-${q ?? ""}`, (s) => s.customers.list({ q }));
  const clientes = todos && estado ? todos.filter((c) => c.estado === estado) : todos;
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (texto.trim()) params.set("q", texto.trim());
    router.push(`/clientes${params.size ? `?${params}` : ""}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Clientes"
        description="Un cliente por persona (RUT), con todos sus vehículos. El estado lo calcula el sistema a partir de pagos, visitas y cobros."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}>
            <PlusIcon className="size-4" /> Nuevo lead
          </button>
        }
      />
      <form onSubmit={buscar} role="search" className="relative mb-4 w-full sm:w-96">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <label htmlFor="buscar-clientes" className="sr-only">Buscar clientes</label>
        <input id="buscar-clientes" type="search" className="field h-10 pl-9" placeholder="Nombre, RUT, patente, correo o comuna" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </form>
      <Tabs
        current={estado ?? "todos"}
        items={[
          { key: "todos", label: "Todos", href: `/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`, count: todos?.length },
          ...ESTADOS_CLIENTE.map((e) => ({
            key: e,
            label: e.charAt(0) + e.slice(1).toLowerCase(),
            href: `/clientes?estado=${encodeURIComponent(e)}${qs}`,
            count: todos?.filter((c) => c.estado === e).length,
          })),
        ]}
      />
      {q && (
        <p className="mb-3 text-sm text-muted">
          Resultados para «{q}» · <Link href={estado ? `/clientes?estado=${encodeURIComponent(estado)}` : "/clientes"} onClick={() => setTexto("")} className="text-accent-ink underline">limpiar búsqueda</Link>
        </p>
      )}
      {!clientes ? (
        <TableSkeleton />
      ) : clientes.length === 0 ? (
        <Empty action={<button type="button" className="btn btn-secondary" onClick={() => setNuevo(true)}>Crear un lead</button>}>
          No hay clientes con ese filtro.
        </Empty>
      ) : (
        <Table head={["Cliente", "Estado", "Etapa comercial", "Vehículo", "Plan", "Comuna", "Origen", "Alta"]} minWidth={1080}>
          {clientes.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-surface-2">
              <td>
                <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:underline">{c.nombre}</Link>
                <span className="block font-mono text-xs text-muted">{c.rut}</span>
              </td>
              <td><EstadoPill estado={c.estado} subestado={c.subestado} /></td>
              <td>{c.etapa ? <Pill tone={ETAPA[c.etapa].tone}>{ETAPA[c.etapa].label}</Pill> : <span className="text-xs text-muted">Fuera del embudo</span>}</td>
              <td>
                <span className="flex flex-wrap gap-1">
                  {c.vehiculos.length ? c.vehiculos.map((v) => <Patente key={v.id}>{v.patente}</Patente>) : <span className="text-xs text-muted">—</span>}
                </span>
              </td>
              <td className="text-ink-soft">{c.orden ? `${getPlan(c.orden.planId).name} · ${c.orden.periodicidad}` : "—"}</td>
              <td className="text-ink-soft">{c.comuna}</td>
              <td className="text-ink-soft">{ORIGEN_LABEL[c.origen]}</td>
              <td className="font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(c.creadoEn)}</td>
            </tr>
          ))}
        </Table>
      )}
      <NuevoLeadModal open={nuevo} onClose={() => setNuevo(false)} />
    </>
  );
}
