"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useQuery } from "@/services";
import type { TicketFila } from "@/services/mock/queries";
import { ESTADO_TICKET_TONE, NIVEL_TONE, ORIGEN_TICKET } from "@/lib/domain/labels";
import type { EstadoTicket, Nivel, OrigenTicket } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { Card, Dot, Empty, Kpi, Mono, PageHeader, Patente, Pill, SimTag } from "@/components/ui/kit";
import { Modal, Sheet } from "@/components/ui/overlay";
import { Field, Segmented } from "@/components/ui/form";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { TicketModal } from "@/features/clientes/dialogs";

const ESTADOS: EstadoTicket[] = ["ABIERTO", "EN REVISIÓN", "ESPERANDO CLIENTE", "VISITA TÉCNICA", "RESUELTO"];
const NIVELES: Nivel[] = ["URGENTE", "ATENCIÓN", "INFO"];

/** Horas desde la creación (o hasta la resolución). */
function edad(t: TicketFila) {
  const fin = t.resueltoEn ? new Date(t.resueltoEn) : new Date();
  const h = Math.max(0, Math.round((fin.getTime() - new Date(t.creadoEn).getTime()) / 3_600_000));
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} días`;
}

export function SoporteView({ folio }: { folio?: string }) {
  const { data: tickets } = useQuery("tickets", (s) => s.support.list());
  const { data: equipo } = useQuery("team", (s) => s.customers.team());
  const { exec, pending } = useAction();
  const [vista, setVista] = useState<"tabla" | "tablero">("tabla");
  const [f, setF] = useState<{ estado: string; nivel: string; resp: string; origen: string; q: string }>({ estado: "abiertos", nivel: "", resp: "", origen: "", q: "" });
  const [abierto, setAbierto] = useState<string | null>(folio ?? null);
  const [nuevo, setNuevo] = useState(false);

  const header = (
    <PageHeader
      eyebrow="Postventa"
      title="Soporte"
      description={
        <>
          Vista de consulta de tickets: GPS sin reportar, desacople de señales, instalaciones fallidas y lo que el bot no resuelva. Pensada para leer el Service Desk existente cuando haya acceso, sin duplicar su backend. <SimTag>Service Desk simulado</SimTag>
        </>
      }
      actions={
        <>
          <Segmented label="Vista" value={vista} onChange={setVista} options={[{ value: "tabla", label: "Tabla" }, { value: "tablero", label: "Tablero" }]} />
          <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}><PlusIcon className="size-4" /> Nuevo ticket</button>
        </>
      }
    />
  );
  if (!tickets) {
    return (
      <>
        {header}
        <KpiSkeleton />
        <div className="mt-3"><TableSkeleton /></div>
      </>
    );
  }

  const abiertos = tickets.filter((t) => t.estado !== "RESUELTO");
  const q = f.q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = tickets
    .filter((t) => (f.estado === "abiertos" ? t.estado !== "RESUELTO" : !f.estado || t.estado === f.estado))
    .filter((t) => !f.nivel || t.nivel === f.nivel)
    .filter((t) => !f.resp || (f.resp === "none" ? !t.responsableId : t.responsableId === f.resp))
    .filter((t) => !f.origen || t.origen === f.origen)
    .filter((t) => !q || `${t.folio} ${t.asunto} ${t.cliente.nombre} ${t.patente ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q))
    .sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel) || b.creadoEn.localeCompare(a.creadoEn));
  const sel = tickets.find((t) => t.folio === abierto) ?? null;

  const cambiarEstado = (t: TicketFila, estado: EstadoTicket) => exec((s) => s.support.setStatus(t.folio, estado), `${t.folio} → ${estado}`);
  const asignar = (t: TicketFila, id: string) => exec((s) => s.support.assign(t.folio, id || null), "Responsable actualizado");

  return (
    <>
      {header}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Abiertos" value={abiertos.length} />
        <Kpi label="Urgentes" value={abiertos.filter((t) => t.nivel === "URGENTE").length} tone={abiertos.some((t) => t.nivel === "URGENTE") ? "danger" : undefined} />
        <Kpi label="Sin responsable" value={abiertos.filter((t) => !t.responsableId).length} tone={abiertos.some((t) => !t.responsableId) ? "amber" : undefined} />
        <Kpi label="Con visita técnica" value={abiertos.filter((t) => t.estado === "VISITA TÉCNICA").length} href="/visitas?tab=asignada" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <label htmlFor="buscar-tk" className="sr-only">Buscar tickets</label>
          <input id="buscar-tk" type="search" className="field h-9 pl-9" placeholder="Folio, asunto, cliente…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        {vista === "tabla" && (
          <>
            <label htmlFor="f-est" className="sr-only">Estado</label>
            <select id="f-est" className="field h-9 w-auto" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option value="abiertos">Abiertos</option>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </>
        )}
        <label htmlFor="f-niv" className="sr-only">Prioridad</label>
        <select id="f-niv" className="field h-9 w-auto" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}>
          <option value="">Toda prioridad</option>
          {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label htmlFor="f-resp" className="sr-only">Responsable</label>
        <select id="f-resp" className="field h-9 w-auto" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}>
          <option value="">Todo responsable</option>
          <option value="none">Sin responsable</option>
          {(equipo ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <label htmlFor="f-ori" className="sr-only">Origen</label>
        <select id="f-ori" className="field h-9 w-auto" value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })}>
          <option value="">Todo origen</option>
          {(Object.keys(ORIGEN_TICKET) as OrigenTicket[]).map((o) => <option key={o} value={o}>{ORIGEN_TICKET[o]}</option>)}
        </select>
      </div>

      {vista === "tabla" ? (
        lista.length === 0 ? (
          <Empty>No hay tickets con esos filtros.</Empty>
        ) : (
          <div className="relative overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  {["Folio", "Asunto", "Cliente", "Origen", "Prioridad", "Estado", "Responsable", "Antigüedad"].map((h) => (
                    <th key={h} scope="col" className="px-4 pt-3.5 pb-2.5 font-medium first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-line/70 [&_td]:px-4 [&_td]:py-2.5 [&_td:first-child]:pl-5">
                {lista.map((t) => (
                  <tr key={t.folio} className="hover:bg-surface-2">
                    <td><button type="button" onClick={() => setAbierto(t.folio)} className="font-mono text-sm text-accent-ink hover:underline">{t.folio}</button></td>
                    <td className="max-w-72"><span className="block truncate font-medium">{t.asunto}</span><span className="block truncate text-xs text-muted">{t.detalle}</span></td>
                    <td>
                      <Link href={`/clientes/${t.clienteId}?tab=soporte`} className="hover:underline">{t.cliente.nombre}</Link>
                      {t.patente && <span className="mt-0.5 block"><Patente>{t.patente}</Patente></span>}
                    </td>
                    <td className="text-ink-soft">{ORIGEN_TICKET[t.origen]}</td>
                    <td><Pill tone={NIVEL_TONE[t.nivel]}>{t.nivel}</Pill></td>
                    <td>
                      <label className="sr-only" htmlFor={`e-${t.folio}`}>Estado de {t.folio}</label>
                      <select id={`e-${t.folio}`} className="field h-8 w-auto py-0 text-xs" value={t.estado} disabled={pending} onChange={(e) => cambiarEstado(t, e.target.value as EstadoTicket)}>
                        {ESTADOS.map((e) => <option key={e}>{e}</option>)}
                      </select>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`r-${t.folio}`}>Responsable de {t.folio}</label>
                      <select id={`r-${t.folio}`} className="field h-8 w-auto py-0 text-xs" value={t.responsableId ?? ""} disabled={pending} onChange={(e) => asignar(t, e.target.value)}>
                        <option value="">Sin asignar</option>
                        {(equipo ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </td>
                    <td className="font-mono text-xs text-muted">{edad(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
          <div className="grid min-w-[72rem] grid-cols-5 gap-3">
            {ESTADOS.map((estado) => {
              const col = lista.filter((t) => t.estado === estado);
              return (
                <section key={estado} className="rounded-2xl bg-bg-sunken/60 p-2" aria-labelledby={`tk-${estado}`}>
                  <h2 id={`tk-${estado}`} className="flex items-center gap-2 px-2 pt-1.5 pb-2.5 text-sm font-semibold">
                    <Dot tone={ESTADO_TICKET_TONE[estado]} /> {estado}
                    <span className="ml-auto font-mono text-xs text-muted">{col.length}</span>
                  </h2>
                  {col.length === 0 ? (
                    <p className="px-2 pb-2 text-xs text-muted">Sin tickets.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {col.map((t) => (
                        <li key={t.folio}>
                          <button type="button" onClick={() => setAbierto(t.folio)} className="block w-full rounded-xl bg-surface p-3 text-left transition-colors hover:bg-surface-2">
                            <span className="flex items-center justify-between gap-2">
                              <Mono className="text-muted">{t.folio}</Mono>
                              <Pill tone={NIVEL_TONE[t.nivel]}>{t.nivel}</Pill>
                            </span>
                            <span className="mt-1.5 block text-sm font-semibold">{t.asunto}</span>
                            <span className="mt-0.5 block text-xs text-muted">{ORIGEN_TICKET[t.origen]} · {t.responsable ?? "Sin responsable"}</span>
                            <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                              {t.patente && <Patente>{t.patente}</Patente>}
                              <span className="truncate">{t.cliente.nombre}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card title="GPS sin reportar: 3 niveles">
          <ul className="flex flex-col gap-2 text-sm">
            <li><span className="font-semibold">Temporal:</span> <span className="text-ink-soft">se registra y se espera.</span></li>
            <li><span className="font-semibold">Persistente:</span> <span className="text-ink-soft">ticket automático y aviso al cliente.</span></li>
            <li><span className="font-semibold">Crítico:</span> <span className="text-ink-soft">alerta URGENTE y contacto de una persona.</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted">Umbrales de tiempo: POR DEFINIR.</p>
        </Card>
        <Card title="Niveles de alerta interna">
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            <li><Pill tone="muted">INFO</Pill> nueva venta, instalación agendada</li>
            <li><Pill tone="amber">ATENCIÓN</Pill> pago fallido, offline persistente, técnico atrasado</li>
            <li><Pill tone="danger">URGENTE</Pill> desacople o evento de seguridad</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Canal interno: propuesto, no aprobado.</p>
        </Card>
        <Card title="Integración con el Service Desk">
          <p className="text-sm text-ink-soft">Cuando haya acceso, esta vista leerá los tickets del Service Desk por API y guardará solo el vínculo (<Mono>external_ticket_id</Mono>) con el cliente y el vehículo.</p>
          <p className="mt-2 text-xs text-muted">Pendiente: dónde está, quién lo mantiene y si tiene API (ver Integraciones).</p>
        </Card>
      </div>

      <Sheet open={sel !== null} onClose={() => setAbierto(null)} eyebrow={sel?.folio} title={sel?.asunto ?? ""}
        footer={sel && (
          <>
            <Link href={`/clientes/${sel.clienteId}?tab=soporte`} className="btn btn-ghost mr-auto">Ficha del cliente</Link>
            {sel.estado !== "RESUELTO" ? (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => cambiarEstado(sel, "RESUELTO")}>Marcar resuelto</button>
            ) : (
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => cambiarEstado(sel, "ABIERTO")}>Reabrir</button>
            )}
          </>
        )}
      >
        {sel && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Pill tone={NIVEL_TONE[sel.nivel]}>{sel.nivel}</Pill>
              <Pill tone={ESTADO_TICKET_TONE[sel.estado]}>{sel.estado}</Pill>
              <span className="text-muted">{ORIGEN_TICKET[sel.origen]}</span>
            </div>
            <p className="text-ink-soft">{sel.detalle || "Sin detalle."}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-muted">Cliente</dt><dd><Link href={`/clientes/${sel.clienteId}`} className="text-accent-ink hover:underline">{sel.cliente.nombre}</Link></dd></div>
              <div><dt className="text-xs text-muted">Vehículo</dt><dd>{sel.patente ? <Patente>{sel.patente}</Patente> : "—"}</dd></div>
              <div><dt className="text-xs text-muted">Creado</dt><dd className="font-mono text-xs">{formatDateTime(sel.creadoEn)}</dd></div>
              <div><dt className="text-xs text-muted">Antigüedad</dt><dd className="font-mono text-xs">{edad(sel)}</dd></div>
              {sel.visitaFolio && <div className="col-span-2"><dt className="text-xs text-muted">Visita vinculada</dt><dd><Link href={`/visitas/${sel.visitaFolio}`} className="font-mono text-accent-ink hover:underline">{sel.visitaFolio}</Link></dd></div>}
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Estado">
                <select className="field" value={sel.estado} disabled={pending} onChange={(e) => cambiarEstado(sel, e.target.value as EstadoTicket)}>
                  {ESTADOS.map((e) => <option key={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Responsable">
                <select className="field" value={sel.responsableId ?? ""} disabled={pending} onChange={(e) => asignar(sel, e.target.value)}>
                  <option value="">Sin asignar</option>
                  {(equipo ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}
      </Sheet>

      {nuevo && <NuevoTicket onClose={() => setNuevo(false)} />}
    </>
  );
}

/** Elegir el cliente y luego abrir el formulario de ticket. */
function NuevoTicket({ onClose }: { onClose: () => void }) {
  const { data: clientes } = useQuery("clientes-ticket", async (s) => (await s.customers.list()).filter((c) => c.estado !== "LEAD" && c.estado !== "CANCELADO"));
  const [clienteId, setClienteId] = useState("");
  const [paso, setPaso] = useState<1 | 2>(1);
  const c = clientes?.find((x) => x.id === clienteId);
  if (paso === 2 && c) return <TicketModal open clienteId={c.id} vehiculos={c.vehiculos} onClose={onClose} />;
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo ticket"
      description="Elige el cliente. Solo clientes que ya pagaron."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!clienteId} onClick={() => setPaso(2)}>Continuar</button>
        </>
      }
    >
      <Field label="Cliente">
        <select className="field" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Elige…</option>
          {(clientes ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.vehiculos.map((v) => v.patente).join(", ")}</option>)}
        </select>
      </Field>
    </Modal>
  );
}
