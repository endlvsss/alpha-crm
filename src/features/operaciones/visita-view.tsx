"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useDemo, useQuery } from "@/services";
import { enlaceEvento, RUT_TECNICO_PORTAL, URL_SITIO } from "@/services/eventos";
import { useToast } from "@/components/ui/toast";
import { BLOQUE_FIN, CHECKLIST } from "@/data/seed";
import { getPlan } from "@/lib/plans";
import { CAUSA_FALLA, ESTADO_TICKET_TONE, GRUPO_VISITA, TIPO_VISITA, type GrupoVisita } from "@/lib/domain/labels";
import type { CausaFalla } from "@/lib/domain/types";
import { formatDateTime, formatLongDate, relativeDay } from "@/lib/format";
import { ArrowLeftIcon, ArrowUpRightIcon, BoltIcon, CameraIcon, CheckIcon, ImageIcon, MapPinIcon, PhoneIcon, PlusIcon } from "@/components/ui/icons";
import { Card, DemoTag, Empty, EstadoPill, Facts, Mono, Patente, Pill } from "@/components/ui/kit";
import { Confirm, Modal } from "@/components/ui/overlay";
import { Field } from "@/components/ui/form";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ReservaModal } from "./reserva-modal";

const CAMINO: { grupo: GrupoVisita; label: string }[] = [
  { grupo: "pendiente", label: "Pendiente" },
  { grupo: "asignada", label: "Asignada" },
  { grupo: "en_camino", label: "En camino" },
  { grupo: "en_proceso", label: "En proceso" },
  { grupo: "completada", label: "Completada" },
];

const REAGENDABLE = ["por_agendar", "lista_espera", "requiere_persona", "agendada", "confirmada", "tecnico_no_disponible", "no_show_cliente"];

export function VisitaView({ folio }: { folio: string }) {
  const { data, loading } = useQuery(`visita-${folio}`, (s) => s.installers.appointment(folio));
  const { exec, pending } = useAction();
  const [modal, setModal] = useState<"reserva" | "cerrar" | "falla" | "cancelar" | null>(null);
  const { services } = useDemo();
  const toast = useToast();

  /** Abre el portal del técnico (sitio) con la visita lista para agregar a su agenda. */
  async function enviarAlPortal() {
    const r = await services.integration.visitForPortal(folio);
    if (!r.ok) {
      toast.show({ tone: "danger", title: "No se pudo enviar", description: r.error });
      return;
    }
    window.open(enlaceEvento(URL_SITIO, "/instalador/importar", r.data), "_blank", "noopener");
    toast.show({ tone: "info", title: "Visita enviada al portal (demo)", description: "Se abrió el portal del técnico en otra pestaña." });
  }

  if (loading) return <PageSkeleton kpis={0} />;
  if (!data) return <Empty action={<Link href="/visitas" className="btn btn-secondary">Volver</Link>}>No encontramos la visita {folio}.</Empty>;

  const { visita: v, tecnico, eventos, ticket, planId, hoy } = data;
  const g = v.grupo;
  const enCurso = ["en_sitio", "en_instalacion", "en_pruebas"].includes(v.estado);
  const conRele = planId !== null && planId !== "esencial";
  const items = CHECKLIST.filter((x) => x.id !== "rele" || conRele);
  const hechos = items.filter((x) => v.checklist.includes(x.id)).length;
  const idx = CAMINO.findIndex((c) => c.grupo === g);
  const porActivar = v.estado === "cerrada_ok" && v.cliente.instaladoEn && !v.cliente.activadoEn;

  return (
    <>
      <Link href="/visitas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> Instalaciones
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">{TIPO_VISITA[v.tipo]}</p>
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em]">{v.folio}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={GRUPO_VISITA[g].tone} dot>{GRUPO_VISITA[g].label}</Pill>
            {v.fecha && v.bloque && (
              <span className="text-muted">
                {formatLongDate(v.fecha)} · {v.bloque}–{BLOQUE_FIN[v.bloque]} · {relativeDay(v.fecha, hoy)}
              </span>
            )}
            {v.reprogramaciones > 0 && <span className="text-xs text-muted">· {v.reprogramaciones} reprogramación(es)</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {REAGENDABLE.includes(v.estado) && (
            <button type="button" className={`btn ${v.fecha ? "btn-secondary" : "btn-primary"}`} onClick={() => setModal("reserva")}>
              {v.fecha ? "Reprogramar" : "Reservar bloque"}
            </button>
          )}
          {["agendada", "confirmada"].includes(v.estado) && tecnico?.rut === RUT_TECNICO_PORTAL && (
            <button type="button" className="btn btn-secondary" onClick={enviarAlPortal}>
              Enviar al portal del técnico <ArrowUpRightIcon className="size-4" />
            </button>
          )}
          {v.estado === "agendada" && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => exec((s) => s.installers.advance(v.folio, "confirmada"), "Asistencia confirmada")}>
              Confirmar asistencia
            </button>
          )}
          {["agendada", "confirmada"].includes(v.estado) && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => exec((s) => s.installers.advance(v.folio, "en_camino"), "Técnico en camino")}>
              Técnico en camino
            </button>
          )}
          {v.estado === "en_camino" && (
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.installers.advance(v.folio, "en_instalacion"), "Check-in registrado")}>
              Registrar check-in
            </button>
          )}
          {["agendada", "confirmada", "en_camino", "en_instalacion", "en_pruebas"].includes(v.estado) && (
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => exec((s) => s.installers.simulateInstallation(v.folio), "Instalación simulada completa")}>
              <BoltIcon className="size-4" /> Simular todo
            </button>
          )}
          {porActivar && (
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.devices.activate(v.clienteId), "Servicio activado (demo)")}>
              Confirmar activación
            </button>
          )}
          {!["cerrada_ok", "cancelada", "fallida"].includes(v.estado) && (
            <button type="button" className="btn btn-ghost text-danger" onClick={() => setModal("cancelar")}>
              Cancelar visita
            </button>
          )}
        </div>
      </header>

      {g !== "cancelada" && (
        <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CAMINO.map((c, i) => {
            const revision = g === "revision";
            const done = revision ? i <= 3 : i < idx || g === "completada";
            const actual = !revision && i === idx && g !== "completada";
            return (
              <li key={c.grupo} className={`rounded-xl p-3 text-sm ${done ? "bg-ok-soft text-ok" : actual ? "bg-accent-soft text-accent-ink" : "bg-surface text-muted"}`}>
                <span className="flex items-center gap-1.5 font-medium">
                  {done && <CheckIcon className="size-4" />}
                  {c.label}
                </span>
              </li>
            );
          })}
          <li className={`rounded-xl p-3 text-sm ${g === "revision" ? "bg-danger-soft text-danger" : v.cliente.activadoEn && g === "completada" ? "bg-ok-soft text-ok" : porActivar ? "bg-amber-soft text-amber" : "bg-surface text-muted"}`}>
            <span className="flex items-center gap-1.5 font-medium">
              {g === "revision" ? "Requiere revisión" : v.cliente.activadoEn && g === "completada" ? <><CheckIcon className="size-4" /> Activada</> : "Activación"}
            </span>
          </li>
        </ol>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Cliente y vehículo">
          <Facts
            items={[
              ["Cliente", <Link key="c" href={`/clientes/${v.clienteId}`} className="text-accent-ink hover:underline">{v.cliente.nombre}</Link>],
              ["Estado del cliente", <EstadoPill key="e" estado={v.cliente.estado} subestado={v.cliente.subestado} />],
              ["Dirección", <span key="d" className="inline-flex items-center gap-1"><MapPinIcon className="size-3.5 text-muted" />{v.cliente.direccion}, {v.comuna}</span>],
              ["Teléfono", <span key="t" className="inline-flex items-center gap-1"><PhoneIcon className="size-3.5 text-muted" />{v.cliente.telefono}</span>],
              ["Vehículo", <span key="v" className="inline-flex items-center gap-1.5"><Patente>{v.vehiculo.patente}</Patente> {v.vehiculo.marca} {v.vehiculo.modelo}</span>],
              ["Plan", planId ? `${getPlan(planId).name}${conRele ? " · con relé y TAG" : ""}` : "—"],
              ["Origen", v.ordenFolio ?? v.ticketFolio ?? "—"],
              ["Equipo instalado", v.imei ? <Mono key="i">{v.imei}</Mono> : "—"],
            ]}
          />
        </Card>

        <Card title="Técnico">
          {tecnico ? (
            <>
              <Facts
                items={[
                  ["Nombre", <Link key="n" href={`/tecnicos/${tecnico.id}`} className="text-accent-ink hover:underline">{tecnico.nombre}</Link>],
                  ["Teléfono", tecnico.telefono],
                  ["Experiencia", `${tecnico.experienciaAnios} años`],
                  ["Cupo diario", String(tecnico.cupoDiario)],
                ]}
              />
              <p className="mt-3 text-xs text-muted">El técnico ve teléfono y dirección exacta solo desde 24 h antes hasta 48 h después del cierre.</p>
            </>
          ) : (
            <p className="text-sm text-muted">
              {v.estado === "requiere_persona"
                ? "Sin cupo compatible tras la lista de espera. Operaciones debe coordinar con el cliente."
                : v.estado === "lista_espera"
                  ? "El cliente pidió «Avísame cuando haya disponibilidad»."
                  : v.estado === "tecnico_no_disponible"
                    ? "El técnico asignado quedó no disponible: reasigna con «Reservar bloque»."
                    : "Aún sin día, bloque ni técnico."}
            </p>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2">Checklist <span className="font-mono text-xs font-normal text-muted">{hechos}/{items.length}</span></span>}>
          {!enCurso && v.checklist.length === 0 ? (
            <p className="text-sm text-muted">Se completa desde el check-in. En producción lo marca el técnico desde su portal móvil.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((it) => {
                const ok = v.checklist.includes(it.id);
                return (
                  <li key={it.id}>
                    <label className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${enCurso ? "cursor-pointer hover:bg-ink/[0.04]" : ""}`}>
                      <input
                        type="checkbox"
                        checked={ok}
                        disabled={!enCurso || pending}
                        onChange={(e) => exec((s) => s.installers.toggleChecklist(v.folio, it.id, e.target.checked))}
                        className="size-5 shrink-0 accent-[var(--ok)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={ok ? "text-ink" : "text-ink-soft"}>{it.label}</span>
                        <span className="block font-mono text-[0.7rem] tracking-wide text-muted uppercase">{it.fase}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2">Evidencia fotográfica <DemoTag>Placeholder</DemoTag></span>}
          className="xl:col-span-2"
          action={
            enCurso && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending || v.fotos >= 12} onClick={() => exec((s) => s.installers.addPhoto(v.folio))}>
                <CameraIcon className="size-4" /> Agregar foto
              </button>
            )
          }
        >
          {v.fotos === 0 ? (
            <p className="text-sm text-muted">Sin fotos. Se exigen al menos 3 para cerrar (patente, equipo y conexiones).</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: v.fotos }, (_, i) => (
                <li key={i} className="rise-in flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-bg-sunken text-muted">
                  <ImageIcon className="size-6" />
                  <span className="font-mono text-[0.7rem]">foto {i + 1}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">No se suben archivos en la demo. En producción las fotos van a almacenamiento privado con URL firmadas.</p>
        </Card>

        <Observaciones folio={v.folio} inicial={v.observaciones} editable={v.estado !== "cancelada"} />

        {enCurso && (
          <Card title="Cierre" className="xl:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Para cerrar: checklist completo, 3 fotos o más y el IMEI de los equipos instalados. La activación del servicio es un paso aparte.
              </p>
              <div className="flex flex-wrap gap-2">
                {v.estado === "en_instalacion" && (
                  <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => exec((s) => s.installers.advance(v.folio, "en_pruebas"), "En pruebas")}>
                    Pasar a pruebas
                  </button>
                )}
                <button type="button" className="btn btn-danger" onClick={() => setModal("falla")}>Reportar falla</button>
                <button type="button" className="btn btn-primary" onClick={() => setModal("cerrar")}>Finalizar instalación</button>
              </div>
            </div>
          </Card>
        )}

        {ticket && (
          <Card title="Ticket vinculado" className="xl:col-span-3">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/soporte?folio=${ticket.folio}`} className="font-mono text-accent-ink hover:underline">{ticket.folio}</Link>
              <Pill tone={ESTADO_TICKET_TONE[ticket.estado]}>{ticket.estado}</Pill>
              <span className="font-medium">{ticket.asunto}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{ticket.detalle}</p>
            {v.causaFalla && <p className="mt-1 text-sm font-medium text-danger">Causa: {CAUSA_FALLA[v.causaFalla]}</p>}
          </Card>
        )}

        <Card title="Bitácora de la visita" className="xl:col-span-3">
          {eventos.length === 0 ? (
            <p className="text-sm text-muted">Creada el {formatDateTime(v.creadaEn)}.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {eventos.map((e) => (
                <li key={e.id} className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm">
                  <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                  <span>
                    <span className="font-mono text-xs font-medium tracking-wide uppercase">{e.tipo}</span>
                    <span className="ml-2 text-xs text-muted">{e.actor}</span>
                    {e.demo && <span className="ml-2"><DemoTag /></span>}
                    {e.detalle && <span className="block text-ink-soft">{e.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modal === "reserva" && <ReservaModal key={v.folio} open folio={v.folio} onClose={() => setModal(null)} />}
      {modal === "cerrar" && <CerrarModal folio={v.folio} tecnicoId={v.tecnicoId} conTag={conRele} onClose={() => setModal(null)} />}
      {modal === "falla" && <FallaModal folio={v.folio} onClose={() => setModal(null)} />}
      <Confirm
        open={modal === "cancelar"}
        onClose={() => setModal(null)}
        onConfirm={async () => {
          const r = await exec((s) => s.installers.cancel(v.folio, "Cancelada por Operaciones (demo)"), "Visita cancelada");
          if (r.ok) setModal(null);
        }}
        title="¿Cancelar la visita?"
        description="Se libera el bloque del técnico. El cliente vuelve a «Pagado» y habrá que crear una nueva orden de instalación. No se avisa a nadie en la demo."
        confirmLabel="Cancelar visita"
        danger
      />
    </>
  );
}

function Observaciones({ folio, inicial, editable }: { folio: string; inicial: string | null; editable: boolean }) {
  const { exec, pending } = useAction();
  const [texto, setTexto] = useState(inicial ?? "");
  const cambiado = texto !== (inicial ?? "");
  return (
    <Card title="Observaciones">
      <label htmlFor="obs" className="sr-only">Observaciones de la visita</label>
      <textarea id="obs" className="field" rows={5} disabled={!editable} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Cliente pidió dejar el equipo bajo el tablero." />
      <div className="mt-2 flex justify-end">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!cambiado || pending} onClick={() => exec((s) => s.installers.saveNotes(folio, texto), "Observaciones guardadas")}>
          Guardar
        </button>
      </div>
    </Card>
  );
}

function CerrarModal({ folio, tecnicoId, conTag, onClose }: { folio: string; tecnicoId: string | null; conTag: boolean; onClose: () => void }) {
  const { exec, pending } = useAction();
  const { data: gps } = useQuery(`gps-${tecnicoId}`, (s) => s.devices.available("gps", tecnicoId));
  const { data: tags } = useQuery(`tag-${tecnicoId}`, (s) => s.devices.available("tag", tecnicoId));
  const [g, setG] = useState("");
  const [t, setT] = useState("");
  const gpsSel = g || gps?.[0]?.imei || "";
  const tagSel = t || tags?.[0]?.imei || "";

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2">Finalizar instalación <DemoTag /></span>}
      description="Se vinculan los IMEI al vehículo y la visita queda completada. La activación del servicio se confirma después (sin API de la plataforma GPS)."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Volver</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !gpsSel || (conTag && !tagSel)}
            onClick={async () => {
              const r = await exec((s) => s.installers.complete(folio, gpsSel, conTag ? tagSel : null), "Instalación completada");
              if (r.ok) onClose();
            }}
          >
            Cerrar con firma
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="GPS (señal principal)" required hint="Primero los equipos en custodia del técnico. IMEI ficticios.">
          <select className="field font-mono" value={gpsSel} onChange={(e) => setG(e.target.value)}>
            {(gps ?? []).map((d) => <option key={d.imei} value={d.imei}>{d.imei} · {d.custodiaTecnicoId ? "custodia" : "bodega"}</option>)}
          </select>
        </Field>
        {conTag && (
          <Field label="TAG (señal de respaldo)" required>
            <select className="field font-mono" value={tagSel} onChange={(e) => setT(e.target.value)}>
              {(tags ?? []).map((d) => <option key={d.imei} value={d.imei}>{d.imei} · {d.custodiaTecnicoId ? "custodia" : "bodega"}</option>)}
            </select>
          </Field>
        )}
        {gps && gps.length === 0 && <p className="text-sm font-medium text-danger">No hay GPS disponibles en inventario.</p>}
      </div>
    </Modal>
  );
}

function FallaModal({ folio, onClose }: { folio: string; onClose: () => void }) {
  const { exec, pending } = useAction();
  const [causa, setCausa] = useState<CausaFalla>("electrico");
  return (
    <Modal
      open
      onClose={onClose}
      title="Reportar falla"
      description="La visita queda «Requiere revisión», se crea un ticket automático y el cliente queda con INCIDENCIA INSTALACIÓN."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Volver</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={async () => {
              const r = await exec((s) => s.installers.fail(folio, causa), "Falla reportada · ticket creado");
              if (r.ok) onClose();
            }}
          >
            <PlusIcon className="size-4" /> Reportar y crear ticket
          </button>
        </>
      }
    >
      <fieldset className="grid gap-1.5 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-ink-soft">Causa</legend>
        {(Object.keys(CAUSA_FALLA) as CausaFalla[]).map((k) => (
          <label key={k} className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${causa === k ? "bg-danger-soft text-danger" : "bg-bg-sunken/60 hover:bg-bg-sunken"}`}>
            <input type="radio" name="causa" value={k} checked={causa === k} onChange={() => setCausa(k)} className="accent-[var(--danger)]" />
            {CAUSA_FALLA[k]}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
