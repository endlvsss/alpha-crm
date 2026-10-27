import type { Metadata } from "next";
import Link from "next/link";
import { agendaSemana } from "@/data";
import { BLOQUES, BLOQUE_FIN } from "@/data/seed";
import { ESTADO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import { dateParts, formatShortDate } from "@/lib/format";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Avatar, PageHeader, Pill } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const offset = Math.max(-4, Math.min(4, Number(sp.semana) || 0));
  const { hoy, dias, tecnicos } = await agendaSemana(offset);

  const nav = (n: number) => (n === 0 ? "/agenda" : `/agenda?semana=${n}`);

  return (
    <>
      <PageHeader
        eyebrow="Operaciones"
        title="Agenda"
        description="Una fila por técnico activo y un bloque de 2 horas por celda. El cliente solo ve los horarios libres; nunca ve al técnico."
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-surface p-1">
            <Link href={nav(offset - 1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-ink/[0.06]" aria-label="Semana anterior">
              <ChevronLeftIcon className="size-4" />
            </Link>
            <span className="px-2 text-sm font-medium tabular-nums">
              {formatShortDate(dias[0])} – {formatShortDate(dias[5])}
            </span>
            <Link href={nav(offset + 1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-ink/[0.06]" aria-label="Semana siguiente">
              <ChevronRightIcon className="size-4" />
            </Link>
            {offset !== 0 && (
              <Link href="/agenda" className="rounded-lg px-2 py-1 text-sm text-accent-ink hover:bg-ink/[0.06]">
                Hoy
              </Link>
            )}
          </div>
        }
      />

      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[68rem] table-fixed border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-52 px-4 py-3 text-left text-xs font-medium text-muted">Técnico</th>
              {dias.map((d) => {
                const p = dateParts(d);
                const esHoy = d === hoy;
                return (
                  <th key={d} scope="col" className="px-2 py-3 text-left">
                    <span className={`inline-flex items-baseline gap-1.5 rounded-lg px-2 py-1 ${esHoy ? "bg-accent-soft text-accent-ink" : ""}`}>
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
                  <span className="flex items-center gap-2.5">
                    <Avatar name={t.nombre} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.nombre}</span>
                      <span className="block text-xs text-muted">Cupo {t.cupoDiario} por día</span>
                    </span>
                  </span>
                </th>
                {dias.map((d) => {
                  const delDia = t.visitas.filter((v) => v.fecha === d);
                  const lleno = delDia.filter((v) => v.estado !== "cancelada").length >= t.cupoDiario;
                  return (
                    <td key={d} className={`border-t border-l border-line/70 p-1.5 align-top ${d < hoy ? "opacity-60" : ""}`}>
                      <ul className="flex flex-col gap-1">
                        {BLOQUES.map((b) => {
                          const v = delDia.find((x) => x.bloque === b);
                          if (v) {
                            return (
                              <li key={b}>
                                <Link href={`/visitas/${v.folio}`} className="block rounded-lg bg-bg-sunken px-2 py-1.5 transition-colors hover:bg-accent-soft">
                                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                    <span className="font-mono text-xs text-muted">{b}</span>
                                    <Pill tone={ESTADO_VISITA[v.estado].tone}>{ESTADO_VISITA[v.estado].label}</Pill>
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs font-medium">{v.cliente.nombre}</span>
                                  <span className="block truncate text-xs text-muted">{TIPO_VISITA[v.tipo]} · {v.comuna}</span>
                                </Link>
                              </li>
                            );
                          }
                          return (
                            <li key={b} className="rounded-lg px-2 py-1 font-mono text-xs text-muted/70" title={`${b}–${BLOQUE_FIN[b]}`}>
                              {b} {lleno ? "· lleno" : d >= hoy ? "· libre" : ""}
                            </li>
                          );
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
      <p className="mt-3 text-xs text-muted">
        Bloques, anticipación mínima (24 h), horizonte (21 días) y retención (10 min) son parámetros propuestos, a validar con Operaciones.
      </p>
    </>
  );
}
