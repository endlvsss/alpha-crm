import type { Metadata } from "next";
import Link from "next/link";
import { hoy, listVisitas, type VisitaFila } from "@/data";
import { CAUSA_FALLA, ESTADO_VISITA, TIPO_VISITA, VISITA_ACTIVA } from "@/lib/domain/labels";
import { formatShortDate, relativeDay } from "@/lib/format";
import { Empty, Mono, PageHeader, Patente, Pill, Table, Tabs } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Visitas" };

// Pestañas de la pantalla A3 de la especificación.
const PESTANAS: { key: string; label: string; match: (v: VisitaFila, hoy: string) => boolean }[] = [
  { key: "por-agendar", label: "Por agendar", match: (v) => v.estado === "por_agendar" },
  { key: "espera", label: "Lista de espera", match: (v) => v.estado === "lista_espera" || v.estado === "requiere_persona" },
  { key: "agendadas", label: "Agendadas", match: (v, h) => VISITA_ACTIVA.includes(v.estado) && v.fecha !== h },
  { key: "hoy", label: "Hoy", match: (v, h) => v.fecha === h && v.estado !== "cancelada" },
  { key: "incidencia", label: "Con incidencia", match: (v) => ["fallida", "no_show_cliente", "tecnico_no_disponible"].includes(v.estado) },
  { key: "cerradas", label: "Cerradas", match: (v) => v.estado === "cerrada_ok" },
];

export default async function VisitasPage({ searchParams }: PageProps<"/visitas">) {
  const sp = await searchParams;
  const today = await hoy();
  const todas = await listVisitas();
  const tab = PESTANAS.find((p) => p.key === sp.tab) ?? PESTANAS[3];
  const visitas = todas
    .filter((v) => tab.match(v, today))
    .sort((a, b) => (tab.key === "cerradas" ? -1 : 1) * `${a.fecha ?? a.creadaEn}${a.bloque ?? ""}`.localeCompare(`${b.fecha ?? b.creadaEn}${b.bloque ?? ""}`));

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Visitas"
        description="Instalaciones, segundas visitas, visitas técnicas y traslados. Folio VIS-AAAA-NNN; una visita nunca queda «instalada» si hubo falla."
      />
      <Tabs
        current={tab.key}
        items={PESTANAS.map((p) => ({ key: p.key, label: p.label, href: `/visitas?tab=${p.key}`, count: todas.filter((v) => p.match(v, today)).length }))}
      />
      {visitas.length === 0 ? (
        <Empty>No hay visitas en esta pestaña.</Empty>
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
                {v.fecha ? <>{formatShortDate(v.fecha)} · <Mono>{v.bloque}</Mono><span className="block text-xs text-muted">{relativeDay(v.fecha, today)}</span></> : <span className="text-muted">Sin fecha</span>}
              </td>
              <td>{v.tecnico ?? <span className="text-muted">Sin asignar</span>}</td>
              <td>{v.comuna}</td>
              <td>
                <Pill tone={ESTADO_VISITA[v.estado].tone}>{ESTADO_VISITA[v.estado].label}</Pill>
                {v.causaFalla && <span className="mt-0.5 block text-xs text-danger">{CAUSA_FALLA[v.causaFalla]}</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
