import type { Metadata } from "next";
import Link from "next/link";
import { listDispositivos } from "@/data";
import type { Dispositivo } from "@/lib/domain/types";
import type { Tone } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { Kpi, Mono, PageHeader, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { DemoAction } from "@/components/ui/demo-action";

export const metadata: Metadata = { title: "Dispositivos" };

const ESTADO: Record<Dispositivo["estado"], { label: string; tone: Tone }> = {
  en_stock: { label: "En bodega", tone: "muted" },
  asignado: { label: "En custodia", tone: "brand" },
  instalado: { label: "Instalado", tone: "accent" },
  activo: { label: "Activo", tone: "ok" },
  falla: { label: "Con falla", tone: "danger" },
  retirado: { label: "Retirado", tone: "muted" },
};

export default async function DispositivosPage({ searchParams }: PageProps<"/dispositivos">) {
  const sp = await searchParams;
  const todos = await listDispositivos();
  const tipo = sp.tipo === "gps" || sp.tipo === "tag" ? sp.tipo : null;
  const lista = tipo ? todos.filter((d) => d.tipo === tipo) : todos;
  const count = (e: Dispositivo["estado"]) => todos.filter((d) => d.estado === e).length;

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Dispositivos"
        description={
          <>
            Inventario de equipos por IMEI: GPS 4G VL103M (señal principal) y TAG PB705 (señal de respaldo). El pulso viene de la plataforma GPS. <SimTag>Pulsos simulados</SimTag>
          </>
        }
        actions={<DemoAction result="se valida cada IMEI (15 dígitos, Luhn, sin duplicados) y el lote queda en bodega.">Cargar lote CSV</DemoAction>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Activos" value={count("activo")} tone="ok" />
        <Kpi label="En bodega" value={count("en_stock")} />
        <Kpi label="En custodia de técnicos" value={count("asignado")} />
        <Kpi label="Con falla" value={count("falla")} tone={count("falla") ? "danger" : undefined} />
        <Kpi label="Retirados" value={count("retirado")} />
      </div>
      <Tabs
        current={tipo ?? "todos"}
        items={[
          { key: "todos", label: "Todos", href: "/dispositivos", count: todos.length },
          { key: "gps", label: "GPS VL103M", href: "/dispositivos?tipo=gps", count: todos.filter((d) => d.tipo === "gps").length },
          { key: "tag", label: "TAG PB705", href: "/dispositivos?tipo=tag", count: todos.filter((d) => d.tipo === "tag").length },
        ]}
      />
      <Table head={["IMEI", "Modelo", "Estado", "Vehículo", "Custodia", "Último pulso", "Batería", "SIM"]} minWidth={1000}>
        {lista.map((d) => (
          <tr key={d.imei}>
            <td><Mono>{d.imei}</Mono></td>
            <td>{d.modelo} <span className="text-xs text-muted">· {d.tipo === "gps" ? "principal" : "respaldo"}</span></td>
            <td><Pill tone={ESTADO[d.estado].tone}>{ESTADO[d.estado].label}</Pill></td>
            <td>{d.patente && d.clienteId ? <Link href={`/clientes/${d.clienteId}?tab=vehiculos`}><Patente>{d.patente}</Patente></Link> : "—"}</td>
            <td className="text-ink-soft">{d.tecnico ?? "—"}</td>
            <td className="font-mono text-xs text-muted">{d.ultimoPulso ? formatDateTime(d.ultimoPulso) : "—"}</td>
            <td className="tabular-nums">{d.bateria != null ? `${d.bateria}%` : "—"}</td>
            <td><Mono className="text-muted">{d.simIccid ?? "—"}</Mono></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
