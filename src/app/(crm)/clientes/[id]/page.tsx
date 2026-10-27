import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCliente, hoy } from "@/data";
import { getPlan } from "@/lib/plans";
import {
  CAUSA_FALLA,
  ESTADO_ORDEN,
  ESTADO_SUSCRIPCION,
  ESTADO_TICKET_TONE,
  ESTADO_VISITA,
  ORIGEN_LABEL,
  ORIGEN_TICKET,
  TIPO_VISITA,
} from "@/lib/domain/labels";
import { clp, formatDateTime, formatShortDate, relativeDay } from "@/lib/format";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Card, Empty, EstadoPill, Facts, Mono, Patente, Pill, SimTag, Table, Tabs } from "@/components/ui/kit";
import { DemoAction } from "@/components/ui/demo-action";
import { SeverityChip } from "@/components/ui/severity";
import { Journey } from "@/components/cliente/journey";
import { PortalPreview } from "@/components/cliente/portal-preview";

const TABS = [
  ["resumen", "Resumen"],
  ["vehiculos", "Vehículos"],
  ["visitas", "Visitas"],
  ["pagos", "Pagos"],
  ["soporte", "Soporte"],
  ["cuenta", "Cuenta Alpha"],
] as const;
type Tab = (typeof TABS)[number][0];

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const data = await getCliente((await params).id);
  return { title: data?.cliente.nombre ?? "Cliente" };
}

export default async function ClientePage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getCliente(id);
  if (!data) notFound();
  const today = await hoy();
  const tab: Tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : "resumen";
  const { cliente, vehiculos, ordenes, suscripciones, cobros, visitas, tickets, alertas, dispositivos, eventos } = data;
  const plan = suscripciones[0] ? getPlan(suscripciones[0].planId) : ordenes[0] ? getPlan(ordenes[0].planId) : null;

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> Clientes
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em] sm:text-[1.75rem]">{cliente.nombre}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <EstadoPill estado={cliente.estado} subestado={cliente.subestado} />
            <Mono>{cliente.rut}</Mono>
            <span>{cliente.comuna}</span>
            {plan && <span>Plan {plan.name}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cliente.estado === "PAGADO" && (
            <DemoAction variant="primary" result="se reenvía por correo el enlace personal para elegir día y bloque.">
              Reenviar enlace de agenda
            </DemoAction>
          )}
          {cliente.subestado === "CHECKOUT ABANDONADO" && cliente.consentimientoMarketing && (
            <DemoAction variant="primary" result="se envía el correo de recuperación con el carrito guardado.">
              Recuperar checkout
            </DemoAction>
          )}
          {["ACTIVO", "INSTALACIÓN AGENDADA"].includes(cliente.estado) && (
            <DemoAction result="se crea un ticket de soporte ligado al cliente y su vehículo.">Abrir ticket</DemoAction>
          )}
        </div>
      </header>

      <Tabs
        current={tab}
        items={TABS.map(([key, label]) => ({
          key,
          label,
          href: `/clientes/${id}${key === "resumen" ? "" : `?tab=${key}`}`,
          count:
            key === "vehiculos" ? vehiculos.length : key === "visitas" ? visitas.length : key === "soporte" ? tickets.length : undefined,
        }))}
      />

      {tab === "resumen" && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title="Línea de vida" className="xl:col-span-3">
            <Journey data={data} />
          </Card>
          <Card title="Datos del cliente">
            <Facts
              items={[
                ["Correo", cliente.email],
                ["Teléfono", cliente.telefono],
                ["Dirección", `${cliente.direccion}, ${cliente.comuna}`],
                ["Origen", `${ORIGEN_LABEL[cliente.origen]}${cliente.campana ? ` · ${cliente.campana}` : ""}`],
                ["Consentimiento comercial", cliente.consentimientoMarketing ? "Sí (Ley 19.628 / 21.719)" : "No: solo avisos operativos"],
                ["Alta", formatDateTime(cliente.creadoEn)],
                ...(cliente.motivoBaja ? ([["Motivo de baja", cliente.motivoBaja]] as [string, string][]) : []),
              ]}
            />
          </Card>
          <Card title="Bitácora" className="xl:col-span-2" padded={false}>
            <ol className="relative px-5 pb-3">
              {eventos.map((e) => (
                <li key={e.id} className="grid grid-cols-[7.5rem_1fr] gap-3 border-l border-line py-2 pl-4 relative">
                  <span className="absolute top-3.5 -left-[5px] size-2.5 rounded-full bg-accent" aria-hidden="true" />
                  <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                  <span className="min-w-0 text-sm">
                    <span className="font-mono text-xs font-medium tracking-wide uppercase">{e.tipo}</span>
                    <span className="ml-2 text-xs text-muted">{e.actor}{e.entidadRef ? ` · ${e.entidadRef}` : ""}</span>
                    {e.detalle && <span className="block text-ink-soft">{e.detalle}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {tab === "vehiculos" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {vehiculos.length === 0 && <Empty>Aún no registra vehículos.</Empty>}
          {vehiculos.map((v) => {
            const gps = dispositivos.find((d) => d.imei === v.imeiGps);
            const tag = dispositivos.find((d) => d.imei === v.imeiTag);
            return (
              <Card
                key={v.id}
                title={<span className="flex items-center gap-2">{v.marca} {v.modelo} <Patente>{v.patente}</Patente></span>}
                action={<Pill tone={v.estado === "activo" ? "ok" : v.estado === "baja" ? "muted" : "amber"}>{{ activo: "Activo", pendiente: "Pendiente de instalación", baja: "De baja" }[v.estado]}</Pill>}
              >
                <Facts
                  items={[
                    ["Año y color", `${v.anio} · ${v.color}`],
                    ["Plan", plan?.name ?? "—"],
                    ["Señal principal (GPS VL103M)", v.imeiGps ? <Mono key="g">{v.imeiGps}</Mono> : "Sin equipo"],
                    ["Señal de respaldo (TAG PB705)", v.imeiTag ? <Mono key="t">{v.imeiTag}</Mono> : plan?.id === "esencial" ? "No incluida en Esencial" : "Sin equipo"],
                    ["Último pulso", gps?.ultimoPulso ? formatDateTime(gps.ultimoPulso) : "—"],
                    ["Batería del respaldo", tag?.bateria != null ? `${tag.bateria}%` : "—"],
                  ]}
                />
              </Card>
            );
          })}
        </div>
      )}

      {tab === "visitas" &&
        (visitas.length === 0 ? (
          <Empty>Sin visitas: el cliente aún no paga.</Empty>
        ) : (
          <Table head={["Folio", "Tipo", "Fecha", "Técnico", "Estado", "Detalle"]}>
            {visitas.map((v) => (
              <tr key={v.folio} className="hover:bg-surface-2">
                <td><Link href={`/visitas/${v.folio}`} className="font-mono text-sm text-accent-ink hover:underline">{v.folio}</Link></td>
                <td>{TIPO_VISITA[v.tipo]}</td>
                <td className="whitespace-nowrap">{v.fecha ? `${formatShortDate(v.fecha)} · ${v.bloque}` : "—"}<span className="block text-xs text-muted">{v.fecha ? relativeDay(v.fecha, today) : ""}</span></td>
                <td>{v.tecnico ?? "Sin asignar"}</td>
                <td><Pill tone={ESTADO_VISITA[v.estado].tone}>{ESTADO_VISITA[v.estado].label}</Pill></td>
                <td className="text-ink-soft">{v.causaFalla ? CAUSA_FALLA[v.causaFalla] : v.imei ? <Mono>{v.imei}</Mono> : "—"}</td>
              </tr>
            ))}
          </Table>
        ))}

      {tab === "pagos" && (
        <div className="flex flex-col gap-3">
          <Card title="Órdenes" padded={false}>
            {ordenes.length === 0 ? (
              <div className="px-5 pb-3"><Empty>Sin órdenes: solo visitó la landing.</Empty></div>
            ) : (
              <Table head={["Folio", "Plan", "Vehículos", "Total", "Estado", "Webpay", "Fecha"]}>
                {ordenes.map((o) => (
                  <tr key={o.folio}>
                    <td><Mono>{o.folio}</Mono></td>
                    <td>{getPlan(o.planId).name} · {o.periodicidad}</td>
                    <td>{o.vehiculos}</td>
                    <td className="tabular-nums">{clp(o.montoTotal)}</td>
                    <td><Pill tone={ESTADO_ORDEN[o.estado].tone}>{ESTADO_ORDEN[o.estado].label}</Pill></td>
                    <td><Mono className="text-muted">{o.pagoRef ?? "—"}</Mono></td>
                    <td className="font-mono text-xs text-muted">{formatDateTime(o.pagadaEn ?? o.creadaEn)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          {suscripciones.length > 0 && (
            <Card title="Suscripciones" padded={false}>
              <Table head={["Vehículo", "Plan", "Monto del período", "Estado", "Próximo cobro"]}>
                {suscripciones.map((s) => (
                  <tr key={s.id}>
                    <td><Patente>{vehiculos.find((v) => v.id === s.vehiculoId)?.patente}</Patente></td>
                    <td>{getPlan(s.planId).name} · {s.periodicidad}</td>
                    <td className="tabular-nums">{clp(s.montoPeriodo)}</td>
                    <td><Pill tone={ESTADO_SUSCRIPCION[s.estado].tone}>{ESTADO_SUSCRIPCION[s.estado].label}</Pill></td>
                    <td className="font-mono text-xs">{s.proximoCobro ? formatShortDate(s.proximoCobro) : "—"}</td>
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
        </div>
      )}

      {tab === "soporte" && (
        <div className="flex flex-col gap-3">
          {tickets.length === 0 ? (
            <Empty>Sin tickets de soporte.</Empty>
          ) : (
            <Table head={["Folio", "Asunto", "Origen", "Nivel", "Estado", "Creado"]}>
              {tickets.map((t) => (
                <tr key={t.folio}>
                  <td><Mono>{t.folio}</Mono></td>
                  <td>{t.asunto}<span className="block text-xs text-muted">{t.detalle}</span></td>
                  <td>{ORIGEN_TICKET[t.origen]}</td>
                  <td><Pill tone={t.nivel === "URGENTE" ? "danger" : t.nivel === "ATENCIÓN" ? "amber" : "muted"}>{t.nivel}</Pill></td>
                  <td><Pill tone={ESTADO_TICKET_TONE[t.estado]}>{t.estado}</Pill></td>
                  <td className="font-mono text-xs text-muted">{formatDateTime(t.creadoEn)}</td>
                </tr>
              ))}
            </Table>
          )}
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
      )}

      {tab === "cuenta" && (
        <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
          <PortalPreview data={data} />
          <Card title="Sincronización con GPSTracker">
            <p className="mb-3 text-sm text-muted">
              Lo que el CRM hace en la plataforma en cada momento del blueprint. Hoy queda registrado aquí; con la API conectada se ejecuta solo.
            </p>
            <ol className="flex flex-col gap-2 text-sm">
              {[
                ["Pago aprobado", "Crear usuario «Cliente» e invitarlo por correo", cliente.cuentaCreadaEn],
                ["Pruebas del técnico", "Leer el último pulso del GPS y del TAG", cliente.instaladoEn],
                ["Check-out OK", "Crear el vehículo con patente e IMEI", cliente.instaladoEn],
                ["Suspensión o baja", "Bloquear el usuario y ocultar el vehículo", cliente.estado === "SUSPENDIDO" || cliente.estado === "CANCELADO" ? eventos.find((e) => e.tipo === cliente.estado)?.en ?? null : null],
              ].map(([momento, accion, at]) => (
                <li key={momento} className="rounded-xl bg-bg-sunken/60 p-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{momento}</span>
                    {at ? <Pill tone="ok">Hecho</Pill> : <Pill tone="muted">Pendiente</Pill>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{accion}{at ? ` · ${formatDateTime(at)}` : ""}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
