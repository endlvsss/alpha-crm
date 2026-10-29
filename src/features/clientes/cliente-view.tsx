"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAction, useQuery } from "@/services";
import type { ClienteDetalle } from "@/services/mock/queries";
import { getPlan } from "@/lib/plans";
import { AVANCE, ETAPA, ETAPAS, etapaSiguiente, type Etapa } from "@/lib/domain/pipeline";
import {
  CAUSA_FALLA,
  ESTADO_DISPOSITIVO,
  ESTADO_ORDEN,
  ESTADO_PAGO,
  ESTADO_SUSCRIPCION,
  ESTADO_TICKET_TONE,
  GRUPO_VISITA,
  NIVEL_TONE,
  ORIGEN_LABEL,
  ORIGEN_TICKET,
  TIPO_VISITA,
} from "@/lib/domain/labels";
import { clp, formatDateTime, formatShortDate, relativeDay } from "@/lib/format";
import { ArrowLeftIcon, ArrowRightIcon, CarIcon, NoteIcon, PencilIcon, PlusIcon, TicketIcon } from "@/components/ui/icons";
import { Card, DemoTag, Empty, EstadoPill, Facts, Mono, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { Confirm } from "@/components/ui/overlay";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SeverityChip } from "@/components/ui/severity";
import { Journey } from "@/components/cliente/journey";
import { PortalPreview } from "@/components/cliente/portal-preview";
import { useAvanzar } from "@/features/ventas/use-avanzar";
import { ReservaModal } from "@/features/operaciones/reserva-modal";
import { AgregarVehiculoModal, EditarClienteModal, TicketModal } from "./dialogs";

const TABS = [
  ["resumen", "Resumen"],
  ["vehiculos", "Vehículos y equipos"],
  ["pagos", "Pagos y suscripción"],
  ["visitas", "Instalaciones"],
  ["soporte", "Soporte"],
  ["cuenta", "Cuenta GPS"],
] as const;
type Tab = (typeof TABS)[number][0];

export function ClienteView({ id, tab: tabParam }: { id: string; tab?: string }) {
  const { data, loading } = useQuery(`cliente-${id}`, (s) => s.customers.get(id));
  const tab: Tab = TABS.some(([k]) => k === tabParam) ? (tabParam as Tab) : "resumen";
  const { avanzar, dialogs, pending } = useAvanzar();
  const { exec } = useAction();
  const [modal, setModal] = useState<"editar" | "vehiculo" | "ticket" | "reembolso" | null>(null);
  const [reserva, setReserva] = useState<string | null>(null);

  if (loading) return <PageSkeleton kpis={0} />;
  if (!data) {
    return (
      <Empty action={<Link href="/clientes" className="btn btn-secondary">Volver a clientes</Link>}>
        No encontramos este cliente. Si lo creaste en una demo anterior, puede que la demo se haya reiniciado.
      </Empty>
    );
  }

  const { cliente: c, etapa, vehiculos, ordenes, suscripciones, visitas, tickets } = data;
  const plan = suscripciones[0] ? getPlan(suscripciones[0].planId) : ordenes[0] ? getPlan(ordenes[0].planId) : null;
  const siguiente = etapa ? etapaSiguiente(etapa) : null;
  const ordenPagada = ordenes.find((o) => o.estado === "pagada");
  const puedeReembolsar = ordenPagada && !c.instaladoEn;

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> Clientes
      </Link>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">Ficha 360°</p>
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em] sm:text-[1.75rem]">{c.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <EstadoPill estado={c.estado} subestado={c.subestado} />
            <Mono>{c.rut}</Mono>
            <span>{c.comuna}</span>
            {plan && <span>Plan {plan.name}</span>}
            {c.id.startsWith("cli-d") && <DemoTag>Creado en la demo</DemoTag>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setModal("editar")}>
            <PencilIcon className="size-4" /> Editar
          </button>
          {c.estado === "LEAD" && (
            <button type="button" className="btn btn-secondary" onClick={() => setModal("vehiculo")}>
              <CarIcon className="size-4" /> Agregar vehículo
            </button>
          )}
          {c.estado !== "LEAD" && c.estado !== "CANCELADO" && (
            <button type="button" className="btn btn-secondary" onClick={() => setModal("ticket")}>
              <TicketIcon className="size-4" /> Abrir ticket
            </button>
          )}
          {etapa && siguiente && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => avanzar({ id: c.id, nombre: c.nombre, etapa, vehiculos: vehiculos.length })}
            >
              {AVANCE[etapa as Exclude<Etapa, "activo">].accion} <ArrowRightIcon className="size-4" />
            </button>
          )}
        </div>
      </header>

      {etapa && <EtapasBar etapa={etapa} />}

      <Tabs
        current={tab}
        items={TABS.map(([key, label]) => ({
          key,
          label,
          href: `/clientes/${id}${key === "resumen" ? "" : `?tab=${key}`}`,
          count: key === "vehiculos" ? vehiculos.length : key === "visitas" ? visitas.length : key === "soporte" ? tickets.length : undefined,
        }))}
      />

      {tab === "resumen" && <Resumen data={data} onEditar={() => setModal("editar")} onReservar={setReserva} />}

      {tab === "vehiculos" && <VehiculosTab data={data} onAgregar={c.estado === "LEAD" ? () => setModal("vehiculo") : undefined} />}

      {tab === "pagos" && (
        <PagosTab
          data={data}
          onReembolsar={puedeReembolsar ? () => setModal("reembolso") : undefined}
          onCancelarSub={(sid) => exec((s) => s.billing.cancelSubscription(sid, "Solicitud del cliente (demo)"), "Suscripción cancelada (demo)")}
        />
      )}

      {tab === "visitas" &&
        (visitas.length === 0 ? (
          <Empty>Sin instalaciones: se crean cuando se confirma el pago.</Empty>
        ) : (
          <Table head={["Folio", "Tipo", "Fecha", "Técnico", "Estado", "Detalle", ""]}>
            {visitas.map((v) => (
              <tr key={v.folio} className="hover:bg-surface-2">
                <td><Link href={`/visitas/${v.folio}`} className="font-mono text-sm text-accent-ink hover:underline">{v.folio}</Link></td>
                <td>{TIPO_VISITA[v.tipo]}</td>
                <td className="whitespace-nowrap">
                  {v.fecha ? `${formatShortDate(v.fecha)} · ${v.bloque}` : "—"}
                  <span className="block text-xs text-muted">{v.fecha ? relativeDay(v.fecha, data.hoy) : ""}</span>
                </td>
                <td>{v.tecnico ?? "Sin asignar"}</td>
                <td><Pill tone={GRUPO_VISITA[v.grupo].tone}>{GRUPO_VISITA[v.grupo].label}</Pill></td>
                <td className="text-ink-soft">{v.causaFalla ? CAUSA_FALLA[v.causaFalla] : v.imei ? <Mono>{v.imei}</Mono> : "—"}</td>
                <td className="text-right">
                  {["por_agendar", "lista_espera", "requiere_persona", "tecnico_no_disponible"].includes(v.estado) && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setReserva(v.folio)}>Reservar</button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ))}

      {tab === "soporte" && <SoporteTab data={data} onNuevo={c.estado !== "LEAD" ? () => setModal("ticket") : undefined} />}

      {tab === "cuenta" && <CuentaTab data={data} />}

      <EditarClienteModal key={`e-${c.id}-${modal}`} cliente={c} open={modal === "editar"} onClose={() => setModal(null)} />
      <AgregarVehiculoModal clienteId={c.id} open={modal === "vehiculo"} onClose={() => setModal(null)} />
      <TicketModal key={`t-${modal}`} clienteId={c.id} vehiculos={vehiculos} open={modal === "ticket"} onClose={() => setModal(null)} />
      {ordenPagada && (
        <Confirm
          open={modal === "reembolso"}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const r = await exec((s) => s.orders.refund(ordenPagada.folio, "Desistió antes de la instalación"), "Reembolso registrado (simulado)");
            if (r.ok) setModal(null);
          }}
          title="¿Registrar reembolso?"
          description={`Se marca la orden ${ordenPagada.folio} como reembolsada (${clp(ordenPagada.montoTotal)}), se cancelan la suscripción y las visitas, y el cliente queda CANCELADO. No se mueve dinero: es una simulación. Política de devolución: POR DEFINIR.`}
          confirmLabel="Registrar reembolso"
          danger
        />
      )}
      {reserva && <ReservaModal key={reserva} open folio={reserva} onClose={() => setReserva(null)} />}
      {dialogs}
    </>
  );
}

function EtapasBar({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.indexOf(etapa);
  return (
    <ol className="mb-5 grid grid-cols-4 gap-1.5 sm:grid-cols-8" aria-label="Etapa en el pipeline comercial">
      {ETAPAS.map((e, i) => (
        <li key={e} aria-current={i === idx ? "step" : undefined} className="min-w-0">
          <span className={`block h-1.5 rounded-full ${i < idx ? "bg-ok" : i === idx ? "bg-accent" : "bg-ink/[0.08]"}`} />
          <span className={`mt-1.5 block truncate text-xs ${i === idx ? "font-semibold text-ink" : "text-muted"}`}>{ETAPA[e].label}</span>
        </li>
      ))}
    </ol>
  );
}

// ——— Resumen ———

type Linea = { id: string; en: string; tipo: string; detalle: string | null; quien: string; grupo: "comercial" | "operaciones" | "soporte" | "nota"; demo?: boolean };

function Resumen({ data, onEditar, onReservar }: { data: ClienteDetalle; onEditar: () => void; onReservar: (folio: string) => void }) {
  const { cliente: c, vehiculos, dispositivos, suscripciones, visitas, tickets, cuenta, notas, eventos } = data;
  const [filtro, setFiltro] = useState<"todo" | Linea["grupo"]>("todo");
  const proxima = visitas.find((v) => v.fecha && ["asignada", "en_camino", "en_proceso"].includes(v.grupo));
  const pendiente = visitas.find((v) => ["por_agendar", "lista_espera", "requiere_persona", "tecnico_no_disponible"].includes(v.estado));
  const abiertos = tickets.filter((t) => t.estado !== "RESUELTO");
  const sub = suscripciones[0];

  const lineas: Linea[] = [
    ...eventos.map((e) => ({
      id: e.id,
      en: e.en,
      tipo: e.tipo,
      detalle: e.detalle,
      quien: e.actor,
      demo: e.demo,
      grupo: (e.entidad === "ticket" ? "soporte" : e.entidad === "visita" || e.entidad === "plataforma" ? "operaciones" : "comercial") as Linea["grupo"],
    })),
    ...notas.map((n) => ({ id: n.id, en: n.en, tipo: "Nota", detalle: n.texto, quien: n.autor, grupo: "nota" as const, demo: n.id.startsWith("not-d") })),
  ]
    .filter((l) => filtro === "todo" || l.grupo === filtro)
    .sort((a, b) => b.en.localeCompare(a.en));

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <Card title="Línea de vida" className="xl:col-span-3">
        <Journey data={data} />
      </Card>

      <Card title="Identificación y contacto" action={<button type="button" onClick={onEditar} className="btn btn-ghost btn-sm"><PencilIcon className="size-3.5" /> Editar</button>}>
        <Facts
          items={[
            ["Correo", c.email],
            ["Teléfono", c.telefono],
            ["Dirección", `${c.direccion || "—"}, ${c.comuna}`],
            ["Origen", `${ORIGEN_LABEL[c.origen]}${c.campana ? ` · ${c.campana}` : ""}`],
            ["Consentimiento", c.consentimientoMarketing ? "Sí (Ley 19.628 / 21.719)" : "No: solo avisos operativos"],
            ["Responsable", data.responsable ?? "Sin asignar"],
            ["Alta", formatDateTime(c.creadoEn)],
            ...(c.motivoBaja ? ([["Motivo de baja", c.motivoBaja]] as [string, string][]) : []),
          ]}
        />
      </Card>

      <Card title="Servicio">
        <ul className="flex flex-col gap-2.5 text-sm">
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted">Plan</span>
            <span>{sub ? `${getPlan(sub.planId).name} · ${sub.periodicidad}` : data.ordenes[0] ? `${getPlan(data.ordenes[0].planId).name} (sin pagar)` : "Sin plan"}</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted">Suscripción</span>
            {sub ? <Pill tone={ESTADO_SUSCRIPCION[sub.estado].tone}>{ESTADO_SUSCRIPCION[sub.estado].label}</Pill> : <span>—</span>}
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted">Próximo cobro</span>
            <span className="font-mono text-xs">{sub?.proximoCobro ? `${formatShortDate(sub.proximoCobro)} · ${clp(sub.montoPeriodo)}` : "—"}</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted">Cuenta GPS</span>
            {cuenta ? (
              <Pill tone={cuenta.estadoUsuario === "activo" ? "ok" : cuenta.estadoUsuario === "bloqueado" ? "danger" : "amber"}>
                {{ activo: "Activa", pendiente: "Invitación enviada", bloqueado: "Bloqueada" }[cuenta.estadoUsuario]}
              </Pill>
            ) : (
              <span>Se crea al pagar</span>
            )}
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted">Activación</span>
            <span>{c.activadoEn ? formatDateTime(c.activadoEn) : c.instaladoEn ? <Pill tone="amber">Por confirmar</Pill> : "—"}</span>
          </li>
        </ul>
      </Card>

      <Card title="Instalación">
        {proxima ? (
          <Link href={`/visitas/${proxima.folio}`} className="block rounded-xl bg-bg-sunken/60 p-3 text-sm transition-colors hover:bg-bg-sunken">
            <span className="flex items-center justify-between gap-2">
              <Mono>{proxima.folio}</Mono>
              <Pill tone={GRUPO_VISITA[proxima.grupo].tone}>{GRUPO_VISITA[proxima.grupo].label}</Pill>
            </span>
            <span className="mt-1 block font-medium">{formatShortDate(proxima.fecha!)} · {proxima.bloque} · {relativeDay(proxima.fecha!, data.hoy)}</span>
            <span className="block text-xs text-muted">{proxima.tecnico} · {TIPO_VISITA[proxima.tipo]}</span>
          </Link>
        ) : pendiente ? (
          <div className="rounded-xl bg-bg-sunken/60 p-3 text-sm">
            <p className="font-medium">{pendiente.folio} sin fecha</p>
            <p className="mt-0.5 text-xs text-muted">Falta elegir día, bloque y técnico.</p>
            <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => onReservar(pendiente.folio)}>Reservar</button>
          </div>
        ) : visitas.some((v) => v.estado === "cerrada_ok") ? (
          <p className="text-sm text-ink-soft">Instalado el {formatDateTime(c.instaladoEn ?? visitas.find((v) => v.estado === "cerrada_ok")!.checkOutEn!)}.</p>
        ) : (
          <p className="text-sm text-muted">Se crea la orden de instalación cuando se confirma el pago.</p>
        )}
        {abiertos.length > 0 && (
          <div className="mt-3 border-t border-line/70 pt-3">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Tickets abiertos</p>
            <ul className="flex flex-col gap-1.5">
              {abiertos.map((t) => (
                <li key={t.folio} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{t.asunto}</span>
                  <Pill tone={NIVEL_TONE[t.nivel]}>{t.nivel}</Pill>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Vehículos y equipos" className="xl:col-span-3" padded={false}>
        {vehiculos.length === 0 ? (
          <div className="px-5 pb-4"><Empty>Sin vehículos registrados.</Empty></div>
        ) : (
          <ul className="grid gap-px sm:grid-cols-2 xl:grid-cols-3">
            {vehiculos.map((v) => {
              const eq = dispositivos.filter((d) => d.vehiculoId === v.id);
              return (
                <li key={v.id} className="flex flex-col gap-1.5 px-5 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium"><Patente>{v.patente}</Patente> {v.marca} {v.modelo} · {v.anio}</span>
                  {eq.length === 0 ? (
                    <span className="text-xs text-muted">Sin equipos instalados</span>
                  ) : (
                    eq.map((d) => (
                      <span key={d.imei} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink-soft">{d.tipo === "gps" ? "Principal" : "Respaldo"} · <Mono>{d.imei}</Mono></span>
                        <Pill tone={ESTADO_DISPOSITIVO[d.estado].tone}>{ESTADO_DISPOSITIVO[d.estado].label}</Pill>
                      </span>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Timeline unificado"
        className="xl:col-span-2"
        action={
          <div role="radiogroup" aria-label="Filtrar timeline" className="flex flex-wrap gap-1">
            {(["todo", "comercial", "operaciones", "soporte", "nota"] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={filtro === g}
                onClick={() => setFiltro(g)}
                className={`rounded-lg px-2 py-1 text-xs font-medium capitalize transition-colors ${filtro === g ? "bg-ink text-bg" : "text-muted hover:bg-ink/[0.06]"}`}
              >
                {g === "todo" ? "Todo" : g === "nota" ? "Notas" : g}
              </button>
            ))}
          </div>
        }
      >
        {lineas.length === 0 ? (
          <Empty>Sin registros en este filtro.</Empty>
        ) : (
          <ol className="relative max-h-[32rem] overflow-y-auto pr-1">
            {lineas.map((l) => (
              <li key={l.id} className="relative grid grid-cols-[7rem_1fr] gap-3 border-l border-line py-2 pl-4">
                <span
                  className={`absolute top-3.5 -left-[5px] size-2.5 rounded-full ${
                    l.grupo === "nota" ? "bg-amber-bright" : l.grupo === "soporte" ? "bg-danger" : l.grupo === "operaciones" ? "bg-brand" : "bg-accent"
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono text-xs text-muted">{formatDateTime(l.en)}</span>
                <span className="min-w-0 text-sm">
                  <span className="font-mono text-xs font-medium tracking-wide uppercase">{l.tipo}</span>
                  <span className="ml-2 text-xs text-muted">{l.quien}</span>
                  {l.demo && <span className="ml-2"><DemoTag /></span>}
                  {l.detalle && <span className={`block ${l.grupo === "nota" ? "text-ink" : "text-ink-soft"}`}>{l.detalle}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Notas clienteId={c.id} notas={notas} />
    </div>
  );
}

function Notas({ clienteId, notas }: { clienteId: string; notas: ClienteDetalle["notas"] }) {
  const { exec, pending } = useAction();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 3) {
      setError("Escribe al menos 3 caracteres");
      return;
    }
    setError(null);
    const r = await exec((s) => s.customers.addNote(clienteId, texto), "Nota guardada");
    if (r.ok) setTexto("");
  }

  return (
    <Card title={<span className="flex items-center gap-2"><NoteIcon className="size-4 text-muted" /> Notas administrativas</span>}>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="nota" className="sr-only">Nueva nota</label>
        <textarea
          id="nota"
          className="field"
          placeholder="Ej. Prefiere que lo llamen después de las 18:00"
          value={texto}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setTexto(e.target.value)}
        />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <button type="submit" className="btn btn-secondary self-end" disabled={pending}>
          <PlusIcon className="size-4" /> Agregar nota
        </button>
      </form>
      <ul className="mt-3 flex flex-col gap-2">
        {notas.map((n) => (
          <li key={n.id} className="rounded-xl bg-bg-sunken/60 p-3 text-sm">
            <p className="text-ink">{n.texto}</p>
            <p className="mt-1 text-xs text-muted">{n.autor} · {formatDateTime(n.en)}</p>
          </li>
        ))}
        {notas.length === 0 && <li className="text-sm text-muted">Sin notas todavía.</li>}
      </ul>
    </Card>
  );
}

// ——— Pestañas ———

function VehiculosTab({ data, onAgregar }: { data: ClienteDetalle; onAgregar?: () => void }) {
  const { vehiculos, dispositivos, suscripciones } = data;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {vehiculos.length === 0 && <Empty action={onAgregar && <button type="button" className="btn btn-primary" onClick={onAgregar}>Agregar vehículo</button>}>Aún no registra vehículos.</Empty>}
      {vehiculos.map((v) => {
        const gps = dispositivos.find((d) => d.imei === v.imeiGps);
        const tag = dispositivos.find((d) => d.imei === v.imeiTag);
        const sub = suscripciones.find((s) => s.vehiculoId === v.id);
        return (
          <Card
            key={v.id}
            title={<span className="flex items-center gap-2">{v.marca} {v.modelo} <Patente>{v.patente}</Patente></span>}
            action={<Pill tone={v.estado === "activo" ? "ok" : v.estado === "baja" ? "muted" : "amber"}>{{ activo: "Activo", pendiente: gps ? "Por activar" : "Pendiente de instalación", baja: "De baja" }[v.estado]}</Pill>}
          >
            <Facts
              items={[
                ["Año y color", `${v.anio} · ${v.color}`],
                ["Plan", sub ? `${getPlan(sub.planId).name} · ${sub.periodicidad}` : "—"],
                ["Señal principal (GPS)", gps ? <span key="g" className="inline-flex items-center gap-1.5"><Mono>{gps.imei}</Mono> <Pill tone={ESTADO_DISPOSITIVO[gps.estado].tone}>{ESTADO_DISPOSITIVO[gps.estado].label}</Pill></span> : "Sin equipo"],
                ["Señal de respaldo (TAG)", tag ? <span key="t" className="inline-flex items-center gap-1.5"><Mono>{tag.imei}</Mono> <Pill tone={ESTADO_DISPOSITIVO[tag.estado].tone}>{ESTADO_DISPOSITIVO[tag.estado].label}</Pill></span> : sub?.planId === "esencial" ? "No incluida en Esencial" : "Sin equipo"],
                ["Último pulso", gps?.ultimoPulso ? formatDateTime(gps.ultimoPulso) : "—"],
                ["Batería del respaldo", tag?.bateria != null ? `${tag.bateria}%` : "—"],
              ]}
            />
            <p className="mt-3 text-xs text-muted">IMEI ficticios. El pulso real vendrá de la plataforma GPS cuando exista su API.</p>
          </Card>
        );
      })}
      {onAgregar && vehiculos.length > 0 && (
        <button type="button" onClick={onAgregar} className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink">
          <PlusIcon className="size-4" /> Agregar otro vehículo
        </button>
      )}
    </div>
  );
}

function PagosTab({ data, onReembolsar, onCancelarSub }: { data: ClienteDetalle; onReembolsar?: () => void; onCancelarSub: (id: string) => void }) {
  const { ordenes, pagos, suscripciones, cobros, vehiculos } = data;
  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Órdenes"
        padded={false}
        action={onReembolsar && <button type="button" className="btn btn-danger btn-sm" onClick={onReembolsar}>Registrar reembolso</button>}
      >
        {ordenes.length === 0 ? (
          <div className="px-5 pb-3"><Empty>Sin órdenes: todavía no inicia el checkout.</Empty></div>
        ) : (
          <Table head={["Folio", "Plan", "Vehículos", "Total", "Estado", "Creada"]}>
            {ordenes.map((o) => (
              <tr key={o.folio}>
                <td><Mono>{o.folio}</Mono></td>
                <td>{getPlan(o.planId).name} · {o.periodicidad}</td>
                <td>{o.vehiculos}</td>
                <td className="tabular-nums">{clp(o.montoTotal)}</td>
                <td><Pill tone={ESTADO_ORDEN[o.estado].tone}>{ESTADO_ORDEN[o.estado].label}</Pill></td>
                <td className="font-mono text-xs text-muted">{formatDateTime(o.creadaEn)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title={<span className="flex items-center gap-2">Transacciones <SimTag>Pasarela simulada</SimTag></span>} padded={false}>
        {pagos.length === 0 ? (
          <div className="px-5 pb-3"><Empty>Sin intentos de pago.</Empty></div>
        ) : (
          <Table head={["ID", "Orden", "Monto", "Estado", "Referencia", "Fecha", "Motivo"]}>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td><Mono className="text-muted">{p.id}</Mono></td>
                <td><Mono>{p.ordenFolio}</Mono></td>
                <td className="tabular-nums">{clp(p.monto)}</td>
                <td><Pill tone={ESTADO_PAGO[p.estado].tone}>{ESTADO_PAGO[p.estado].label}</Pill></td>
                <td><Mono className="text-muted">{p.ref ?? "—"}</Mono></td>
                <td className="font-mono text-xs text-muted">{formatDateTime(p.creadoEn)}</td>
                <td className="text-xs text-muted">{p.motivo ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {suscripciones.length > 0 && (
        <Card title="Suscripciones" padded={false}>
          <Table head={["Vehículo", "Plan", "Monto del período", "Estado", "Próximo cobro", ""]}>
            {suscripciones.map((s) => (
              <tr key={s.id}>
                <td><Patente>{vehiculos.find((v) => v.id === s.vehiculoId)?.patente}</Patente></td>
                <td>{getPlan(s.planId).name} · {s.periodicidad}</td>
                <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
                <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
                <td className="font-mono text-xs">{s.proximoCobro ? formatShortDate(s.proximoCobro) : "—"}</td>
                <td className="text-right">
                  {s.estado !== "cancelada" && s.estado !== "pendiente_instalacion" && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCancelarSub(s.id)}>Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {cobros.length > 0 && (
        <Card title="Cobros recurrentes" padded={false}>
          <Table head={["Fecha", "Monto", "Intento", "Resultado"]} minWidth={480}>
            {cobros.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">{formatShortDate(c.fecha)}</td>
                <td className="tabular-nums">{clp(c.monto)}</td>
                <td>{c.intento}</td>
                <td><Pill tone={c.estado === "aprobado" ? "ok" : "danger"}>{c.estado === "aprobado" ? "Aprobado" : "Rechazado"}</Pill></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <p className="text-xs text-muted">Montos ilustrativos con IVA, calculados con precios provisorios pendientes de aprobación comercial.</p>
    </div>
  );
}

function SoporteTab({ data, onNuevo }: { data: ClienteDetalle; onNuevo?: () => void }) {
  const { tickets, alertas, vehiculos } = data;
  return (
    <div className="flex flex-col gap-3">
      <Card title="Tickets" padded={false} action={onNuevo && <button type="button" className="btn btn-secondary btn-sm" onClick={onNuevo}><PlusIcon className="size-3.5" /> Nuevo ticket</button>}>
        {tickets.length === 0 ? (
          <div className="px-5 pb-3"><Empty>Sin tickets de soporte.</Empty></div>
        ) : (
          <Table head={["Folio", "Asunto", "Origen", "Prioridad", "Estado", "Responsable", "Creado"]}>
            {tickets.map((t) => (
              <tr key={t.folio}>
                <td><Link href={`/soporte?folio=${t.folio}`} className="font-mono text-sm text-accent-ink hover:underline">{t.folio}</Link></td>
                <td>{t.asunto}<span className="block text-xs text-muted">{t.detalle}</span></td>
                <td>{ORIGEN_TICKET[t.origen]}</td>
                <td><Pill tone={NIVEL_TONE[t.nivel]}>{t.nivel}</Pill></td>
                <td><Pill tone={ESTADO_TICKET_TONE[t.estado]}>{t.estado}</Pill></td>
                <td className="text-ink-soft">{t.responsable ?? "—"}</td>
                <td className="font-mono text-xs text-muted">{formatDateTime(t.creadoEn)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title={<span className="flex items-center gap-2">Alertas de la plataforma <SimTag /></span>} padded={false}>
        {alertas.length === 0 ? (
          <div className="px-5 pb-3"><Empty>Sin alertas.</Empty></div>
        ) : (
          <Table head={["Alerta", "Severidad", "Vehículo", "Fecha", "Estado"]} minWidth={560}>
            {alertas.map((a) => (
              <tr key={a.id}>
                <td>{a.tipo}</td>
                <td><SeverityChip level={a.severidad} /></td>
                <td><Patente>{vehiculos.find((v) => v.id === a.vehiculoId)?.patente}</Patente></td>
                <td className="font-mono text-xs text-muted">{formatDateTime(a.en)}</td>
                <td>{a.resuelta ? <Pill tone="ok">Resuelta</Pill> : <Pill tone="danger">Activa</Pill>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function CuentaTab({ data }: { data: ClienteDetalle }) {
  const { cliente, eventos } = data;
  return (
    <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
      <PortalPreview data={data} />
      <Card title={<span className="flex items-center gap-2">Sincronización con la plataforma GPS <SimTag>Pendiente de API</SimTag></span>}>
        <p className="mb-3 text-sm text-muted">
          Lo que el CRM debe hacer en la plataforma en cada momento. Hoy queda registrado aquí; con la API del equipo GPS se ejecutará solo.
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          {[
            ["Pago aprobado", "Crear usuario «Cliente» con RUT y correo, e invitarlo", cliente.cuentaCreadaEn],
            ["Check-out OK", "Crear vehículo con patente e IMEI de GPS y TAG", cliente.instaladoEn],
            ["Activación", "Confirmar el pulso del IMEI y habilitar el servicio", cliente.activadoEn],
            ["Suspensión o baja", "Bloquear el usuario y ocultar el vehículo", cliente.estado === "SUSPENDIDO" || cliente.estado === "CANCELADO" ? eventos.find((e) => e.tipo === cliente.estado)?.en ?? null : null],
          ].map(([momento, accion, at]) => (
            <li key={momento} className="rounded-xl bg-bg-sunken/60 p-3">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{momento}</span>
                {at ? <Pill tone="ok">Hecho (demo)</Pill> : <Pill tone="muted">Pendiente</Pill>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{accion}{at ? ` · ${formatDateTime(at)}` : ""}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
