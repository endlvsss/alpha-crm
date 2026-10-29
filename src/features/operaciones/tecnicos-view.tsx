"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useQuery } from "@/services";
import { TARIFA_VISITA_DEMO } from "@/services/mock/queries";
import { DOCUMENTO_TECNICO, ESTADO_DISPOSITIVO, ESTADO_TECNICO, GRUPO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import type { EstadoTecnico } from "@/lib/domain/types";
import { clp, formatDateTime, formatShortDate, relativeDay } from "@/lib/format";
import { ArrowLeftIcon, CheckIcon, CloseIcon, FileIcon, PlusIcon } from "@/components/ui/icons";
import { Avatar, Card, DemoTag, Empty, Kpi, Mono, PageHeader, Patente, Pill, Table, Tabs } from "@/components/ui/kit";
import { Confirm } from "@/components/ui/overlay";
import { KpiSkeleton, PageSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ComunasPicker, DisponibilidadEditor, DIAS, RegistroTecnicoModal } from "./tecnico-form";

const FILTROS: { key: string; label: string; estados: EstadoTecnico[] | null }[] = [
  { key: "todos", label: "Todos", estados: null },
  { key: "activos", label: "Activos", estados: ["activo"] },
  { key: "validacion", label: "En reclutamiento", estados: ["postulante", "en_validacion"] },
  { key: "inactivos", label: "Suspendidos y bajas", estados: ["suspendido", "baja"] },
];

export function TecnicosView({ filtro: f }: { filtro?: string }) {
  const { data: tecnicos } = useQuery("tecnicos", (s) => s.installers.list());
  const [registro, setRegistro] = useState(false);
  const filtro = FILTROS.find((x) => x.key === f) ?? FILTROS[0];

  const header = (
    <PageHeader
      eyebrow="Operaciones"
      title="Técnicos freelance"
      description="Reclutamiento, validación y desempeño. Cada técnico activo es un usuario con rol Instalador: en su portal solo verá sus visitas."
      actions={<button type="button" className="btn btn-primary" onClick={() => setRegistro(true)}><PlusIcon className="size-4" /> Registrar técnico</button>}
    />
  );

  if (!tecnicos) {
    return (
      <>
        {header}
        <KpiSkeleton />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }

  const activos = tecnicos.filter((t) => t.estado === "activo");
  const capacidad = activos.reduce((s, t) => s + t.cupoDiario * 6, 0);
  const proximas = activos.reduce((s, t) => s + t.proximas, 0);
  const lista = filtro.estados ? tecnicos.filter((t) => filtro.estados!.includes(t.estado)) : tecnicos;

  return (
    <>
      {header}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Técnicos activos" value={activos.length} hint={`${tecnicos.filter((t) => t.estado === "postulante" || t.estado === "en_validacion").length} en reclutamiento`} href="/tecnicos?f=activos" />
        <Kpi label="Capacidad semanal" value={capacidad} hint="Cupo diario × 6 días" />
        <Kpi label="Visitas próximas" value={proximas} hint={`${Math.round((proximas / Math.max(1, capacidad)) * 100)}% de una semana de capacidad`} href="/agenda" />
        <Kpi label="Equipos en custodia" value={tecnicos.reduce((s, t) => s + t.custodia, 0)} hint="GPS y TAG asignados a técnicos" href="/dispositivos" />
      </div>
      <Tabs current={filtro.key} items={FILTROS.map((x) => ({ key: x.key, label: x.label, href: x.key === "todos" ? "/tecnicos" : `/tecnicos?f=${x.key}`, count: x.estados ? tecnicos.filter((t) => x.estados!.includes(t.estado)).length : tecnicos.length }))} />
      {lista.length === 0 ? (
        <Empty>No hay técnicos en este filtro.</Empty>
      ) : (
        <Table head={["Técnico", "Estado", "Cobertura", "Cupo", "Completadas", "Éxito", "Próximas", "Custodia"]} minWidth={1040}>
          {lista.map((t) => (
            <tr key={t.id} className="hover:bg-surface-2">
              <td>
                <Link href={`/tecnicos/${t.id}`} className="flex items-center gap-2.5">
                  <Avatar name={t.nombre} />
                  <span>
                    <span className="block font-medium hover:underline">{t.nombre}</span>
                    <Mono className="text-muted">{t.rut}</Mono>
                  </span>
                </Link>
              </td>
              <td>
                <Pill tone={ESTADO_TECNICO[t.estado].tone}>{ESTADO_TECNICO[t.estado].label}</Pill>
                <span className="mt-0.5 block text-xs text-muted">
                  {t.validadoEn ? `desde ${formatShortDate(t.validadoEn)}` : `${t.documentos.filter((d) => d.estado === "aprobado").length}/${t.documentos.length} documentos`}
                </span>
              </td>
              <td className="max-w-72 text-ink-soft">
                <span className="line-clamp-2">{t.comunas.join(", ")}</span>
              </td>
              <td className="tabular-nums">{t.cupoDiario}/día</td>
              <td className="tabular-nums">{t.completadas}</td>
              <td className="tabular-nums">{t.exito != null ? `${t.exito}%` : "—"}</td>
              <td className="tabular-nums">{t.proximas}</td>
              <td className="tabular-nums">{t.custodia}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">Cupo máximo, tarifa por visita y proceso de validación: POR DEFINIR con Operaciones.</p>
      <RegistroTecnicoModal open={registro} onClose={() => setRegistro(false)} />
    </>
  );
}

export function TecnicoView({ id }: { id: string }) {
  const { data, loading } = useQuery(`tecnico-${id}`, (s) => s.installers.get(id));
  const { exec, pending } = useAction();
  const [confirmar, setConfirmar] = useState<EstadoTecnico | null>(null);
  const [edit, setEdit] = useState<{ cupoDiario: number; comunas: string[]; disponibilidad: Record<number, string[]> } | null>(null);

  if (loading) return <PageSkeleton />;
  if (!data) return <Empty action={<Link href="/tecnicos" className="btn btn-secondary">Volver</Link>}>No encontramos este técnico.</Empty>;

  const { tecnico: t, metricas: m, visitas, custodia, eventos, hoy } = data;
  const docsOk = t.documentos.every((d) => d.estado === "aprobado");
  const proximas = visitas.filter((v) => v.fecha && v.fecha >= hoy && ["asignada", "en_camino", "en_proceso"].includes(v.grupo));
  const form = edit ?? { cupoDiario: t.cupoDiario, comunas: t.comunas, disponibilidad: t.disponibilidad };
  const editando = edit !== null;

  return (
    <>
      <Link href="/tecnicos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> Técnicos
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={t.nombre} className="size-12 text-sm" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.025em]">{t.nombre}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Pill tone={ESTADO_TECNICO[t.estado].tone} dot>{ESTADO_TECNICO[t.estado].label}</Pill>
              <Mono>{t.rut}</Mono>
              <span>{t.telefono}</span>
              <span>{t.email}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(t.estado === "postulante" || t.estado === "en_validacion" || t.estado === "suspendido") && (
            <button type="button" className="btn btn-primary" disabled={!docsOk || pending} title={docsOk ? undefined : "Faltan documentos por aprobar"} onClick={() => exec((s) => s.installers.setStatus(t.id, "activo"), "Técnico activado")}>
              {t.estado === "suspendido" ? "Reactivar" : "Aprobar y activar"}
            </button>
          )}
          {t.estado === "activo" && <button type="button" className="btn btn-secondary" onClick={() => setConfirmar("suspendido")}>Suspender</button>}
          {t.estado !== "baja" && <button type="button" className="btn btn-ghost text-danger" onClick={() => setConfirmar("baja")}>Dar de baja</button>}
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Completadas" value={m.completadas} />
        <Kpi label="Este mes" value={m.visitasMes} />
        <Kpi label="Tasa de éxito" value={m.exito != null ? `${m.exito}%` : "—"} tone={m.exito != null && m.exito < 80 ? "amber" : "ok"} />
        <Kpi label="Fallidas · no-show" value={`${m.fallidas} · ${m.noShows}`} tone={m.fallidas ? "danger" : undefined} />
        <Kpi label="Próximas" value={m.proximas} href="/agenda" />
        <Kpi label="Pago del mes" value={clp(m.pagoMes)} hint={`${clp(TARIFA_VISITA_DEMO)} por visita · ilustrativo`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card title={<span className="flex items-center gap-2">Documentos <DemoTag>Ficticios</DemoTag></span>}>
          <ul className="flex flex-col gap-2">
            {t.documentos.map((d) => (
              <li key={d.tipo} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg-sunken/60 p-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <FileIcon className="size-4 text-muted" />
                  {DOCUMENTO_TECNICO[d.tipo]}
                </span>
                {d.estado === "pendiente" && t.estado !== "baja" ? (
                  <span className="flex gap-1">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => exec((s) => s.installers.reviewDocument(t.id, d.tipo, "aprobado"))}>
                      <CheckIcon className="size-3.5" /> Aprobar
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} aria-label={`Rechazar ${DOCUMENTO_TECNICO[d.tipo]}`} onClick={() => exec((s) => s.installers.reviewDocument(t.id, d.tipo, "rechazado"))}>
                      <CloseIcon className="size-3.5" />
                    </button>
                  </span>
                ) : (
                  <Pill tone={d.estado === "aprobado" ? "ok" : d.estado === "rechazado" ? "danger" : "amber"}>{{ aprobado: "Aprobado", rechazado: "Rechazado", pendiente: "Pendiente" }[d.estado]}</Pill>
                )}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted">Postuló</dt><dd>{formatShortDate(t.postuladoEn)}</dd></div>
            <div><dt className="text-xs text-muted">Experiencia</dt><dd>{t.experienciaAnios} años</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">Especialidades</dt><dd>{t.especialidades.join(", ") || "—"}</dd></div>
          </dl>
        </Card>

        <Card
          title="Cobertura, cupo y disponibilidad"
          className="xl:col-span-2"
          action={
            editando ? (
              <span className="flex gap-1.5">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={pending}
                  onClick={async () => {
                    const r = await exec((s) => s.installers.update(t.id, form), "Ficha actualizada");
                    if (r.ok) setEdit(null);
                  }}
                >
                  Guardar
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdit({ cupoDiario: t.cupoDiario, comunas: t.comunas, disponibilidad: t.disponibilidad })}>Editar</button>
            )
          }
        >
          <div className="grid gap-4 2xl:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-1.5 text-sm font-medium text-ink-soft">Comunas ({form.comunas.length})</p>
              {editando ? (
                <ComunasPicker value={form.comunas} onChange={(comunas) => setEdit({ ...form, comunas })} />
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {t.comunas.map((c) => <li key={c} className="rounded-md bg-bg-sunken px-2 py-0.5 text-xs">{c}</li>)}
                </ul>
              )}
              <div className="mt-4 flex items-center gap-3">
                <label htmlFor="cupo" className="text-sm font-medium text-ink-soft">Cupo diario</label>
                {editando ? (
                  <select id="cupo" className="field h-9 w-24" value={form.cupoDiario} onChange={(e) => setEdit({ ...form, cupoDiario: Number(e.target.value) })}>
                    {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
                  </select>
                ) : (
                  <span className="font-mono">{t.cupoDiario} visitas</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-sm font-medium text-ink-soft">Disponibilidad semanal</p>
              <DisponibilidadEditor value={form.disponibilidad} onChange={(disponibilidad) => setEdit({ ...form, disponibilidad })} disabled={!editando} />
              <p className="mt-1 text-xs text-muted">
                {DIAS.filter(([d]) => (t.disponibilidad[d]?.length ?? 0) > 0).length} días · {Object.values(t.disponibilidad).reduce((s, b) => s + b.length, 0)} bloques por semana
              </p>
            </div>
          </div>
        </Card>

        <Card title={`Instalaciones asignadas (${visitas.length})`} className="xl:col-span-2" padded={false}>
          {visitas.length === 0 ? (
            <div className="px-5 pb-4"><Empty>Sin visitas asignadas todavía.</Empty></div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <Table head={["Folio", "Cliente", "Tipo", "Fecha", "Estado"]} minWidth={620}>
                {visitas.map((v) => (
                  <tr key={v.folio} className="hover:bg-surface-2">
                    <td><Link href={`/visitas/${v.folio}`} className="font-mono text-sm text-accent-ink hover:underline">{v.folio}</Link></td>
                    <td>{v.cliente.nombre}<span className="block text-xs text-muted">{v.comuna}</span></td>
                    <td>{TIPO_VISITA[v.tipo]}</td>
                    <td className="whitespace-nowrap">{v.fecha ? `${formatShortDate(v.fecha)} · ${v.bloque}` : "—"}<span className="block text-xs text-muted">{v.fecha ? relativeDay(v.fecha, hoy) : ""}</span></td>
                    <td><Pill tone={GRUPO_VISITA[v.grupo].tone}>{GRUPO_VISITA[v.grupo].label}</Pill></td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <Card title={`Próximas (${proximas.length})`}>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted">Sin visitas próximas.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {proximas.slice(0, 5).map((v) => (
                  <li key={v.folio}>
                    <Link href={`/visitas/${v.folio}`} className="flex items-center justify-between gap-2 rounded-xl bg-bg-sunken/60 p-2.5 text-sm hover:bg-bg-sunken">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{v.cliente.nombre}</span>
                        <span className="text-xs text-muted">{relativeDay(v.fecha!, hoy)} · {v.bloque} · {v.comuna}</span>
                      </span>
                      <Patente>{v.vehiculo.patente}</Patente>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Equipos en custodia (${custodia.length})`}>
            {custodia.length === 0 ? (
              <p className="text-sm text-muted">Sin equipos en custodia.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {custodia.map((d) => (
                  <li key={d.imei} className="flex items-center justify-between gap-2">
                    <Mono>{d.imei}</Mono>
                    <Pill tone={ESTADO_DISPOSITIVO[d.estado].tone}>{d.tipo.toUpperCase()}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {eventos.length > 0 && (
            <Card title="Bitácora">
              <ul className="flex flex-col gap-1.5 text-sm">
                {eventos.map((e) => (
                  <li key={e.id}>
                    <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span> <span className="font-medium">{e.tipo}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Confirm
        open={confirmar !== null}
        onClose={() => setConfirmar(null)}
        onConfirm={async () => {
          if (!confirmar) return;
          const r = await exec((s) => s.installers.setStatus(t.id, confirmar), confirmar === "baja" ? "Técnico dado de baja" : "Técnico suspendido");
          if (r.ok) setConfirmar(null);
        }}
        title={confirmar === "baja" ? "¿Dar de baja al técnico?" : "¿Suspender al técnico?"}
        description={`Sus ${proximas.length} visita(s) próximas quedan «Requiere revisión» para reasignarlas. No se avisa a nadie en la demo.`}
        confirmLabel={confirmar === "baja" ? "Dar de baja" : "Suspender"}
        danger
        pending={pending}
      />
    </>
  );
}
