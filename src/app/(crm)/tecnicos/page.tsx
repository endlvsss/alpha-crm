import type { Metadata } from "next";
import { listTecnicos } from "@/data";
import type { Tecnico } from "@/lib/domain/types";
import type { Tone } from "@/lib/domain/labels";
import { formatShortDate } from "@/lib/format";
import { Avatar, Kpi, Mono, PageHeader, Pill, Table } from "@/components/ui/kit";
import { DemoAction } from "@/components/ui/demo-action";

export const metadata: Metadata = { title: "Técnicos" };

const ESTADO: Record<Tecnico["estado"], { label: string; tone: Tone }> = {
  postulante: { label: "Postulante", tone: "muted" },
  en_validacion: { label: "En validación", tone: "amber" },
  activo: { label: "Activo", tone: "ok" },
  suspendido: { label: "Suspendido", tone: "danger" },
  baja: { label: "Baja", tone: "muted" },
};

export default async function TecnicosPage() {
  const tecnicos = await listTecnicos();
  const activos = tecnicos.filter((t) => t.estado === "activo");
  const capacidad = activos.reduce((s, t) => s + t.cupoDiario * 6, 0);
  const proximas = activos.reduce((s, t) => s + t.proximas, 0);

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Técnicos freelance"
        description="Cada técnico es un usuario con rol Instalador: solo ve sus visitas en el portal. Operaciones valida, fija el cupo máximo y asigna las comunas."
        actions={<DemoAction variant="primary" result="se crea el usuario con contraseña temporal y la ficha queda En validación.">Agregar técnico</DemoAction>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Técnicos activos" value={activos.length} hint={`${tecnicos.length - activos.length} en proceso de validación`} />
        <Kpi label="Capacidad semanal" value={capacidad} hint="Cupo diario × 6 días" />
        <Kpi label="Visitas próximas" value={proximas} hint={`${Math.round((proximas / Math.max(1, capacidad)) * 100)}% de una semana de capacidad`} />
        <Kpi label="Equipos en custodia" value={tecnicos.reduce((s, t) => s + t.custodia, 0)} hint="GPS y TAG asignados a técnicos" />
      </div>
      <Table head={["Técnico", "Estado", "Comunas", "Cupo diario", "Instaladas este mes", "Próximas", "Fallidas · no-show", "Custodia"]} minWidth={1040}>
        {tecnicos.map((t) => (
          <tr key={t.id}>
            <td>
              <span className="flex items-center gap-2.5">
                <Avatar name={t.nombre} />
                <span>
                  <span className="block font-medium">{t.nombre}</span>
                  <Mono className="text-muted">{t.rut}</Mono>
                </span>
              </span>
            </td>
            <td>
              <Pill tone={ESTADO[t.estado].tone}>{ESTADO[t.estado].label}</Pill>
              {t.validadoEn && <span className="mt-0.5 block text-xs text-muted">desde {formatShortDate(t.validadoEn)}</span>}
            </td>
            <td className="max-w-72 text-ink-soft">{t.comunas.join(", ")}</td>
            <td className="tabular-nums">{t.cupoDiario}</td>
            <td className="tabular-nums">{t.visitasMes}</td>
            <td className="tabular-nums">{t.proximas}</td>
            <td className="tabular-nums">{t.fallidas} · {t.noShows}</td>
            <td className="tabular-nums">{t.custodia}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-muted">Cupo máximo (3), tarifa por visita y proceso de validación: POR DEFINIR con Operaciones.</p>
    </>
  );
}
