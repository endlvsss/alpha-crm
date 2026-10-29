"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAction, useDemo, useQuery } from "@/services";
import { ETAPAS, ETAPA, type Etapa } from "@/lib/domain/pipeline";
import { getPlan, plans, quote, type Billing, type PlanId } from "@/lib/plans";
import { computeDv, formatRut } from "@/lib/rut";
import { clp, formatDateTime, formatLongDate } from "@/lib/format";
import { ESTADO_DISPOSITIVO, ESTADO_PAGO } from "@/lib/domain/labels";
import { ArrowUpRightIcon, BoltIcon, CheckIcon, PlayIcon } from "@/components/ui/icons";
import { Card, DemoTag, EstadoPill, Mono, PageHeader, Patente, Pill } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/form";
import { Confirm } from "@/components/ui/overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservaModal } from "@/features/operaciones/reserva-modal";
import { URL_SITIO } from "@/services/eventos";

const NOMBRES = ["Martina Fuenzalida Rojas", "Joaquín Saavedra Lagos", "Isabel Cifuentes Mora", "Renato Valdés Pino"];

/** Lead ficticio listo para el recorrido, con vehículo, en una comuna con técnicos. */
function leadFicticio() {
  const body = String(13_000_000 + Math.floor(Math.random() * 8_000_000));
  const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
  const letras = "BCDFGHJKLPRSTVWXYZ";
  const patente = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join("") + String(10 + Math.floor(Math.random() * 89));
  return {
    nombre,
    rut: formatRut(body + computeDv(body)),
    email: `${nombre.split(" ")[0].toLowerCase()}.demo${Math.floor(Math.random() * 900 + 100)}@demo.alphalink.cl`,
    telefono: `+56 9 ${5000 + Math.floor(Math.random() * 4999)} ${1000 + Math.floor(Math.random() * 8999)}`,
    comuna: "Ñuñoa",
    direccion: "Av. Ficticia 1234",
    origen: "meta" as const,
    responsableId: "usr-1",
    consentimientoMarketing: true,
    vehiculo: { patente, marca: "Toyota", modelo: "Yaris", anio: 2021, color: "Gris" },
  };
}

export function DemoView({ clienteId }: { clienteId?: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const { reset, acciones } = useDemo();
  const { data } = useQuery(`demo-${clienteId}`, (s) => (clienteId ? s.customers.get(clienteId) : Promise.resolve(null)));
  const [checkout, setCheckout] = useState(false);
  const [planId, setPlanId] = useState<PlanId>("seguridad");
  const [billing, setBilling] = useState<Billing>("mensual");
  const [reserva, setReserva] = useState<string | null>(null);
  const [reiniciar, setReiniciar] = useState(false);

  const etapa: Etapa | null = data?.etapa ?? null;
  const idx = etapa ? ETAPAS.indexOf(etapa) : -1;
  const orden = data?.ordenes[0];
  const visita = data?.visitas.filter((v) => v.tipo === "instalacion" && v.estado !== "cancelada").at(-1);
  const cancelado = data && !etapa;

  const hecho = [
    !!data,
    !!orden || checkout,
    !!orden,
    idx >= ETAPAS.indexOf("pago_confirmado"),
    idx >= ETAPAS.indexOf("instalacion_pendiente"),
    idx >= ETAPAS.indexOf("instalacion_agendada"),
    idx >= ETAPAS.indexOf("instalado"),
    idx >= ETAPAS.indexOf("activo"),
  ];
  const actual = hecho.findIndex((x) => !x);

  async function crearLead() {
    const r = await exec((s) => s.customers.create(leadFicticio()), (d) => `Lead ficticio creado (${d.id})`);
    if (r.ok) router.replace(`/demo?cliente=${r.data.id}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Recorrido demo"
        title="De lead a cliente activo"
        description="Diez pasos con un cliente ficticio. Cada paso usa los mismos servicios que el resto del CRM, así que lo que hagas aquí aparece en el pipeline, la ficha, la agenda, los dispositivos, las finanzas y el inicio."
        actions={
          <>
            {clienteId && (
              <Link href="/demo" className="btn btn-secondary">
                Empezar con otro cliente
              </Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setReiniciar(true)}>
              Reiniciar datos ({acciones})
            </button>
          </>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-[1fr_22rem]">
        <ol className="flex flex-col gap-2">
          <Paso n={1} titulo="Crear un lead ficticio" hecho={hecho[0]} actual={actual === 0}>
            {data ? (
              <p className="text-sm text-ink-soft">
                <Link href={`/clientes/${data.cliente.id}`} className="font-medium text-accent-ink hover:underline">{data.cliente.nombre}</Link> · <Mono>{data.cliente.rut}</Mono> · {data.cliente.comuna}
                {data.vehiculos[0] && <> · <Patente>{data.vehiculos[0].patente}</Patente></>}
              </p>
            ) : clienteId ? (
              <Skeleton className="h-5 w-72" />
            ) : (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={crearLead}>
                <BoltIcon className="size-4" /> Crear lead ficticio
              </button>
            )}
          </Paso>

          <Paso n={2} titulo="Convertirlo en checkout" hecho={hecho[1]} actual={actual === 1}>
            {actual === 1 && (
              <button type="button" className="btn btn-primary" onClick={() => setCheckout(true)}>
                Abrir checkout
              </button>
            )}
            {hecho[1] && <p className="text-sm text-ink-soft">Checkout abierto para {data?.cliente.nombre.split(" ")[0]}.</p>}
          </Paso>

          <Paso n={3} titulo="Seleccionar un plan ilustrativo" hecho={hecho[2]} actual={actual === 2}>
            {actual === 2 ? (
              <div className="flex flex-col gap-3">
                <Segmented label="Periodicidad" value={billing} onChange={setBilling} options={[{ value: "mensual", label: "Mensual" }, { value: "anual", label: "Anual" }]} />
                <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-2">
                  {plans.filter((p) => p.maxVehicles >= (data?.vehiculos.length ?? 1) && p.minVehicles <= (data?.vehiculos.length ?? 1)).map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={p.id === planId} onClick={() => setPlanId(p.id)} className={`rounded-xl p-3 text-left text-sm transition-colors ${p.id === planId ? "bg-accent-soft ring-2 ring-accent" : "bg-bg-sunken/60 hover:bg-bg-sunken"}`}>
                      <span className="font-display font-bold">{p.name}</span>
                      <span className="block text-xs text-muted">{p.tagline}</span>
                      <span className="mt-1 block font-mono tabular-nums">{clp(quote(p, billing, 1).dueToday)} hoy</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.orders.startCheckout(data!.cliente.id, planId, billing), (d) => `Orden ${d.folio} creada`)}>
                    Crear orden
                  </button>
                  <DemoTag>Precios ilustrativos, pendientes de aprobación</DemoTag>
                </div>
              </div>
            ) : orden ? (
              <p className="text-sm text-ink-soft">
                <Mono>{orden.folio}</Mono> · {getPlan(orden.planId).name} · {orden.periodicidad} · {clp(orden.montoTotal)}
              </p>
            ) : null}
          </Paso>

          <Paso n={4} titulo="Simular la confirmación de pago" hecho={hecho[3]} actual={actual === 3}>
            {actual === 3 && orden && (
              <div className="flex flex-wrap items-center gap-2">
                {orden.estado !== "pendiente_pago" ? (
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.orders.sendToGateway(orden.folio), "Enviado a la pasarela (simulada)")}>
                    {orden.estado === "pago_rechazado" ? "Reintentar pago" : "Enviar a la pasarela"}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.orders.confirmPayment(orden.folio), "Pago confirmado (simulado)")}>
                      Aprobar pago
                    </button>
                    <button type="button" className="btn btn-danger" disabled={pending} onClick={() => exec((s) => s.orders.rejectPayment(orden.folio), "Pago rechazado (simulado)")}>
                      Rechazar
                    </button>
                  </>
                )}
                <span className="text-xs text-muted">Ningún cobro real: la pasarela está simulada.</span>
              </div>
            )}
            {data && data.pagos.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.pagos.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 rounded-lg bg-bg-sunken/60 px-2 py-1 text-xs">
                    <Mono>{p.id}</Mono> <Pill tone={ESTADO_PAGO[p.estado].tone}>{ESTADO_PAGO[p.estado].label}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Paso>

          <Paso n={5} titulo="Crear la orden de instalación" hecho={hecho[4]} actual={actual === 4}>
            {actual === 4 && (
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.orders.createInstallationOrder(data!.cliente.id), (d) => `Orden de instalación ${d.folios.join(", ")}`)}>
                Crear orden de instalación
              </button>
            )}
            {visita && hecho[4] && <p className="text-sm text-ink-soft"><Link href={`/visitas/${visita.folio}`} className="font-mono text-accent-ink hover:underline">{visita.folio}</Link> · {visita.comuna}</p>}
          </Paso>

          <Paso n={6} titulo="Reservar un bloque con un técnico compatible" hecho={hecho[5]} actual={actual === 5}>
            {actual === 5 && visita && (
              <button type="button" className="btn btn-primary" onClick={() => setReserva(visita.folio)}>
                Abrir asistente de reserva
              </button>
            )}
            {visita?.fecha && hecho[5] && (
              <p className="text-sm text-ink-soft">
                {formatLongDate(visita.fecha)} · {visita.bloque} · {visita.tecnico}
              </p>
            )}
          </Paso>

          <Paso n={7} titulo="Simular la ejecución de la instalación" hecho={hecho[6]} actual={actual === 6}>
            {actual === 6 && visita && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.installers.simulateInstallation(visita.folio), "Instalación simulada: check-in, checklist, fotos, pruebas y cierre")}>
                  Simular instalación completa
                </button>
                <Link href={`/visitas/${visita.folio}`} className="btn btn-secondary">Hacerlo paso a paso</Link>
              </div>
            )}
            {hecho[6] && visita && <p className="text-sm text-ink-soft">Cerrada con IMEI <Mono>{visita.imei}</Mono>.</p>}
          </Paso>

          <Paso n={8} titulo="Activar el dispositivo en modo demo" hecho={hecho[7]} actual={actual === 7}>
            {actual === 7 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec((s) => s.devices.activate(data!.cliente.id), "Servicio activado (demo, sin llamar a la plataforma GPS)")}>
                  Confirmar activación
                </button>
                <span className="text-xs text-muted">Sin API de la plataforma GPS, la confirma una persona.</span>
              </div>
            )}
            {hecho[7] && data && (
              <ul className="flex flex-wrap gap-2">
                {data.dispositivos.map((d) => (
                  <li key={d.imei} className="flex items-center gap-1.5 rounded-lg bg-bg-sunken/60 px-2 py-1 text-xs">
                    <Mono>{d.imei}</Mono> <Pill tone={ESTADO_DISPOSITIVO[d.estado].tone}>{ESTADO_DISPOSITIVO[d.estado].label}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Paso>

          <Paso n={9} titulo="Ver al cliente en todos los módulos" hecho={hecho[7]} actual={actual === -1}>
            {data && (
              <div className="flex flex-wrap gap-2">
                {[
                  [`/clientes/${data.cliente.id}`, "Ficha 360°"],
                  ["/ventas", "Pipeline"],
                  [`/clientes/${data.cliente.id}?tab=vehiculos`, "Vehículo y equipos"],
                  [`/clientes/${data.cliente.id}?tab=pagos`, "Suscripción y transacción"],
                  ["/ordenes", "Órdenes y pagos"],
                  ["/agenda", "Agenda"],
                  ["/dispositivos", "Dispositivos"],
                  ["/cobros", "Suscripciones"],
                  ["/finanzas", "Finanzas"],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="btn btn-secondary btn-sm">
                    {label} <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                ))}
              </div>
            )}
          </Paso>

          <Paso n={10} titulo="Ver los cambios en el inicio y la actividad reciente" hecho={hecho[7]} actual={false} ultimo>
            <Link href="/" className="btn btn-secondary btn-sm">
              Ir al inicio <ArrowUpRightIcon className="size-3.5" />
            </Link>
            <p className="mt-1.5 text-xs text-muted">Los indicadores de ventas, pagos, instalaciones, activaciones y suscripciones salen del mismo conjunto de datos.</p>
          </Paso>
        </ol>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-6">
          <Card title="Estado del caso">
            {!data ? (
              <p className="text-sm text-muted">{clienteId ? "Cargando…" : "Crea el lead para empezar."}</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <EstadoPill estado={data.cliente.estado} subestado={data.cliente.subestado} />
                {cancelado ? (
                  <p className="text-danger">El caso salió del embudo (cancelado o suspendido). Empieza con otro cliente.</p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {ETAPAS.map((e, i) => (
                      <li key={e} className={`flex items-center gap-2 ${i === idx ? "font-semibold text-ink" : i < idx ? "text-ok" : "text-muted"}`}>
                        <span className={`inline-flex size-4 items-center justify-center rounded-full ${i < idx ? "bg-ok text-bg" : i === idx ? "bg-accent" : "bg-ink/[0.08]"}`}>
                          {i < idx && <CheckIcon className="size-3" strokeWidth={3} />}
                        </span>
                        {ETAPA[e].label}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </Card>
          {data && (
            <Card title="Bitácora del caso">
              <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {data.eventos.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-mono text-muted">{formatDateTime(e.en)}</span>
                    <span className="ml-1.5 font-mono font-medium uppercase">{e.tipo}</span>
                    {e.detalle && <span className="block text-muted">{e.detalle}</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <Card title="Con el sitio y el portal del técnico">
            <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-ink-soft">
              <li>Compra y reserva en el <a href={`${URL_SITIO}/checkout`} target="_blank" rel="noreferrer" className="text-accent-ink underline">checkout del sitio</a>.</li>
              <li>En «Demo interna», «Enviar al CRM» y aplicar el evento aquí.</li>
              <li>En el <a href={`${URL_SITIO}/instalador`} target="_blank" rel="noreferrer" className="text-accent-ink underline">portal del técnico</a> (Diego Fuentes), cerrar la visita y «Enviar resultado al CRM».</li>
              <li>Confirmar la activación en la ficha del cliente.</li>
            </ol>
            <p className="mt-2 text-xs text-muted">Desde una instalación de Diego en el CRM, «Enviar al portal del técnico» hace el camino inverso.</p>
          </Card>
          <p className="flex items-start gap-2 rounded-xl bg-amber-soft p-3 text-xs text-amber">
            <PlayIcon className="mt-0.5 size-3.5 shrink-0" />
            Todo ocurre en este navegador. No se cobran pagos, no se envían mensajes ni se activan equipos reales.
          </p>
        </aside>
      </div>

      {reserva && <ReservaModal key={reserva} open folio={reserva} onClose={() => setReserva(null)} />}
      <Confirm
        open={reiniciar}
        onClose={() => setReiniciar(false)}
        onConfirm={() => {
          reset();
          setReiniciar(false);
          router.replace("/demo");
        }}
        title="¿Reiniciar la demo?"
        description="Vuelven los datos semilla de hoy y se borra todo lo hecho en esta sesión."
        confirmLabel="Reiniciar datos"
        danger
      />
    </>
  );
}

function Paso({ n, titulo, hecho, actual, children, ultimo = false }: { n: number; titulo: string; hecho: boolean; actual: boolean; children?: ReactNode; ultimo?: boolean }) {
  return (
    <li className={`relative rounded-2xl p-4 pl-14 transition-colors ${actual ? "bg-surface ring-2 ring-accent" : "bg-surface"} ${!hecho && !actual ? "opacity-70" : ""}`} aria-current={actual ? "step" : undefined}>
      <span className={`absolute top-4 left-4 inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold ${hecho ? "bg-ok text-bg" : actual ? "bg-accent text-on-brand" : "bg-ink/[0.08] text-ink-soft"}`}>
        {hecho ? <CheckIcon className="size-3.5" strokeWidth={3} /> : n}
      </span>
      {!ultimo && <span className="absolute top-12 bottom-[-0.5rem] left-[1.84rem] w-px bg-line" aria-hidden="true" />}
      <h2 className="font-display text-[0.95rem] font-bold">{titulo}</h2>
      {children && <div className="mt-2">{children}</div>}
    </li>
  );
}
