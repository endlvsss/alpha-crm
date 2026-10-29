"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useAction, useQuery } from "@/services";
import type { PasoIntegracion } from "@/services/contracts";
import { eventoDesdeHash, URL_SITIO, type Evento } from "@/services/eventos";
import { getPlan } from "@/lib/plans";
import { clp, formatDateTime } from "@/lib/format";
import { AlertIcon, ArrowUpRightIcon, CheckIcon, MinusIcon } from "@/components/ui/icons";
import { Card, DemoTag, Empty, Facts, Mono, PageHeader, Patente, Pill } from "@/components/ui/kit";
import { Skeleton } from "@/components/ui/skeleton";

function subscribe(fn: () => void) {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}

const ORIGEN: Record<Evento["tipo"], string> = {
  "sitio.compra": "Sitio · checkout y agenda",
  "portal.visita": "Portal del técnico",
  "crm.visita": "CRM",
};

/** Recepción de un evento del sitio o del portal: vista previa, aplicar y resultado. */
export function EntradaView() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => null);
  const leido = hash === null ? null : eventoDesdeHash(hash);
  const evento = leido?.ok ? leido.evento : null;
  const { exec, pending } = useAction();
  const { data: previo } = useQuery(`entrada-${evento?.id}`, (s) => (evento ? s.integration.applied(evento.id) : Promise.resolve(null)));
  const [resultado, setResultado] = useState<{ pasos: PasoIntegracion[]; clienteId: string | null; visitaFolio: string | null } | null>(null);

  async function aplicar() {
    if (!evento) return;
    const r = await exec((s) => s.integration.receive(evento));
    if (r.ok) setResultado(r.data);
  }

  return (
    <>
      <PageHeader
        eyebrow="Integraciones"
        title="Evento recibido"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            En producción esto llega solo, como webhook firmado. En la demo viaja en el enlace y se aplica con un clic. <DemoTag>Simulado</DemoTag>
          </span>
        }
        actions={<Link href="/integraciones" className="btn btn-secondary">Bandeja de entrada</Link>}
      />

      {hash === null ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : !leido ? (
        <Empty action={<a href={URL_SITIO} className="btn btn-secondary" target="_blank" rel="noreferrer">Abrir el sitio <ArrowUpRightIcon className="size-4" /></a>}>
          No hay ningún evento en este enlace. Se abre desde «Enviar al CRM» en el panel «Demo interna» del sitio o del portal del técnico.
        </Empty>
      ) : !leido.ok ? (
        <Empty>{leido.error}</Empty>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-[1.4fr_1fr]">
          <Card
            title={
              <span className="flex flex-wrap items-center gap-2">
                {ORIGEN[leido.evento.tipo]} <Mono className="text-xs font-normal text-muted">{leido.evento.tipo} · v{leido.evento.v}</Mono>
              </span>
            }
            action={<span className="font-mono text-xs text-muted">{formatDateTime(leido.evento.emitidoEn)}</span>}
          >
            <Vista evento={leido.evento} />
            <p className="mt-4 font-mono text-[0.7rem] text-muted">id {leido.evento.id}</p>
          </Card>

          <Card title="Aplicar en el CRM">
            {previo ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-ok"><CheckIcon className="size-4" /> Ya aplicado el {formatDateTime(previo.recibidoEn)}</p>
                <p className="text-muted">El id del evento ya está en la bandeja: no se aplica dos veces (idempotencia).</p>
                {previo.clienteId && <Link href={`/clientes/${previo.clienteId}`} className="btn btn-secondary self-start">Ver ficha del cliente</Link>}
              </div>
            ) : resultado ? null : leido.evento.tipo === "crm.visita" ? (
              <p className="text-sm text-muted">Este evento sale del CRM hacia el portal del técnico.</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted">
                  {leido.evento.tipo === "sitio.compra"
                    ? "Se crea (o completa) el cliente, su orden, el pago, la orden de instalación y la reserva, con los mismos comandos que usa Operaciones."
                    : "Se registra el check-in, el checklist, la evidencia y el cierre (o la falla) en la visita del vehículo. La activación queda para confirmar."}
                </p>
                <button type="button" className="btn btn-primary self-start" disabled={pending} onClick={aplicar}>
                  Aplicar en el CRM (demo)
                </button>
              </div>
            )}
            {resultado && (
              <div className="flex flex-col gap-3">
                <ol className="flex flex-col gap-2">
                  {resultado.pasos.map((p, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${p.estado === "ok" ? "bg-ok-soft text-ok" : p.estado === "aviso" ? "bg-amber-soft text-amber" : "bg-ink/[0.07] text-muted"}`}>
                        {p.estado === "ok" ? <CheckIcon className="size-3" strokeWidth={3} /> : p.estado === "aviso" ? <AlertIcon className="size-3" /> : <MinusIcon className="size-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium">{p.label}</span>
                        {p.detalle && <span className="block text-xs text-muted">{p.detalle}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
                  {resultado.clienteId && <Link href={`/clientes/${resultado.clienteId}`} className="btn btn-primary btn-sm">Ficha 360°</Link>}
                  {resultado.visitaFolio && <Link href={`/visitas/${resultado.visitaFolio}`} className="btn btn-secondary btn-sm">Instalación {resultado.visitaFolio}</Link>}
                  <Link href="/ventas" className="btn btn-ghost btn-sm">Pipeline</Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function Vista({ evento }: { evento: Evento }) {
  if (evento.tipo === "sitio.compra") {
    const d = evento.datos;
    return (
      <Facts
        items={[
          ["Cliente", `${d.cliente.nombre} · ${d.cliente.rut}`],
          ["Contacto", `${d.cliente.email} · ${d.cliente.telefono}`],
          ["Dirección", `${[d.direccion.calle, d.direccion.detalle].filter(Boolean).join(", ")}, ${d.direccion.comuna}`],
          ["Vehículos", <span key="v" className="flex flex-wrap gap-1">{d.vehiculos.map((v) => <Patente key={v.patente}>{v.patente}</Patente>)}</span>],
          ["Plan", `${getPlan(d.plan).name} · ${d.periodicidad}`],
          ["Orden del sitio", d.orden ? <span key="o" className="inline-flex items-center gap-1.5"><Mono>{d.orden.folio}</Mono> {clp(d.orden.total)} <Pill tone={d.orden.estado === "pagada" ? "ok" : d.orden.estado === "rechazada" ? "danger" : "amber"}>{d.orden.estado}</Pill></span> : "Sin orden"],
          ["Reserva", d.reserva ? `${d.reserva.fecha} · ${d.reserva.bloque}${d.reserva.tecnicoRut ? " · técnico del portal" : " · disponibilidad ficticia"}` : d.listaEspera ? "Lista de espera" : "Sin reserva"],
          ["Consentimiento", d.consentimientoMarketing ? "Sí" : "No: solo avisos operativos"],
        ]}
      />
    );
  }
  if (evento.tipo === "portal.visita") {
    const d = evento.datos;
    return (
      <Facts
        items={[
          ["Vehículo", <Patente key="p">{d.patente}</Patente>],
          ["Resultado", <Pill key="r" tone={d.resultado === "cerrada_ok" ? "ok" : "danger"}>{d.resultado === "cerrada_ok" ? "Instalación cerrada" : "Instalación fallida"}</Pill>],
          ["IMEI GPS", d.imeiGps ? <Mono key="i">{d.imeiGps}</Mono> : "—"],
          ["Checklist", `${d.checklistOk}/${d.checklistTotal}`],
          ["Fotos y firma", `${d.fotos} fotos · ${d.firma ? "con firma" : "sin firma"}`],
          ["Causa", d.causa ?? "—"],
          ["Folio en el portal", d.folioPortal],
          ["Cerrada", formatDateTime(d.cerradaEn)],
        ]}
      />
    );
  }
  const d = evento.datos;
  return <Facts items={[["Visita", d.folio], ["Fecha", `${d.fecha} · ${d.bloque}`], ["Cliente", d.cliente.nombre], ["Vehículo", d.vehiculo.patente]]} />;
}
