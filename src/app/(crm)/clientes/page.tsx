import type { Metadata } from "next";
import Link from "next/link";
import { listClientes } from "@/data";
import { getPlan } from "@/lib/plans";
import { ESTADOS_CLIENTE, type EstadoCliente } from "@/lib/domain/types";
import { ORIGEN_LABEL } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { Empty, EstadoPill, PageHeader, Patente, Table, Tabs } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Clientes" };

function isEstado(v: unknown): v is EstadoCliente {
  return typeof v === "string" && (ESTADOS_CLIENTE as readonly string[]).includes(v);
}

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  const estado = isEstado(sp.estado) ? sp.estado : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const todos = await listClientes({ q });
  const clientes = estado ? todos.filter((c) => c.estado === estado) : todos;
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Clientes"
        description="Un cliente por persona (RUT), con todos sus vehículos. El estado lo calcula el sistema."
      />
      <Tabs
        current={estado ?? "todos"}
        items={[
          { key: "todos", label: "Todos", href: `/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`, count: todos.length },
          ...ESTADOS_CLIENTE.map((e) => ({
            key: e,
            label: e.charAt(0) + e.slice(1).toLowerCase(),
            href: `/clientes?estado=${encodeURIComponent(e)}${qs}`,
            count: todos.filter((c) => c.estado === e).length,
          })),
        ]}
      />
      {q && (
        <p className="mb-3 text-sm text-muted">
          Resultados para «{q}» · <Link href="/clientes" className="text-accent-ink underline">limpiar búsqueda</Link>
        </p>
      )}
      {clientes.length === 0 ? (
        <Empty>No hay clientes con ese filtro.</Empty>
      ) : (
        <Table head={["Cliente", "Estado", "Vehículo", "Plan", "Comuna", "Origen", "Alta"]} minWidth={960}>
          {clientes.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-surface-2">
              <td>
                <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:underline">
                  {c.nombre}
                </Link>
                <span className="block font-mono text-xs text-muted">{c.rut}</span>
              </td>
              <td><EstadoPill estado={c.estado} subestado={c.subestado} /></td>
              <td>
                <span className="flex flex-wrap gap-1">
                  {c.vehiculos.map((v) => <Patente key={v.id}>{v.patente}</Patente>)}
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
    </>
  );
}
