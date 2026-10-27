import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisita, hoy } from "@/data";
import { BLOQUE_FIN } from "@/data/seed";
import { getPlan } from "@/lib/plans";
import { CAUSA_FALLA, ESTADO_TICKET_TONE, ESTADO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import type { EstadoVisita } from "@/lib/domain/types";
import { formatDateTime, formatLongDate, relativeDay } from "@/lib/format";
import { ArrowLeftIcon, CameraIcon, CheckIcon, SignatureIcon } from "@/components/ui/icons";
import { Card, EstadoPill, Facts, Mono, Patente, Pill, SimTag } from "@/components/ui/kit";
import { DemoAction } from "@/components/ui/demo-action";

export async function generateMetadata({ params }: PageProps<"/visitas/[id]">): Promise<Metadata> {
  return { title: `Visita ${(await params).id}` };
}

// Camino principal de una visita (sección 6.2 de la especificación).
const CAMINO: { estado: EstadoVisita; label: string }[] = [
  { estado: "agendada", label: "Agendada" },
  { estado: "confirmada", label: "Confirmada" },
  { estado: "en_camino", label: "En camino" },
  { estado: "en_instalacion", label: "Check-in e instalación" },
  { estado: "en_pruebas", label: "Pruebas" },
  { estado: "cerrada_ok", label: "Check-out" },
];

export default async function VisitaPage({ params }: PageProps<"/visitas/[id]">) {
  const data = await getVisita((await params).id);
  if (!data) notFound();
  const today = await hoy();
  const { visita: v, tecnico, eventos, ticket, planId } = data;
  const paso = CAMINO.findIndex((c) => c.estado === v.estado);
  const cerrada = v.estado === "cerrada_ok";
  const fallida = v.estado === "fallida";
  const sinAgenda = ["por_agendar", "lista_espera", "requiere_persona"].includes(v.estado);
  const conRele = planId !== null && planId !== "esencial";

  return (
    <>
      <Link href="/visitas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> Visitas
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">{TIPO_VISITA[v.tipo]}</p>
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em]">{v.folio}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={ESTADO_VISITA[v.estado].tone} dot>{ESTADO_VISITA[v.estado].label}</Pill>
            {v.fecha && <span className="text-muted">{formatLongDate(v.fecha)} · {v.bloque}–{BLOQUE_FIN[v.bloque!]} · {relativeDay(v.fecha, today)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sinAgenda && (
            <DemoAction variant="primary" result="se reserva el bloque con el técnico de menor carga y se avisa al cliente y al técnico.">
              Reserva manual
            </DemoAction>
          )}
          {["agendada", "confirmada"].includes(v.estado) && (
            <>
              <DemoAction result="se libera el bloque y se envía al cliente el enlace para elegir otro horario.">Reprogramar</DemoAction>
              <DemoAction result="se busca otro técnico compatible y libre; si no hay, se avisa al cliente con un enlace.">Reasignar técnico</DemoAction>
            </>
          )}
          {fallida && (
            <DemoAction variant="primary" result="se crea una segunda visita ligada al ticket y se envía el enlace de agenda.">Crear segunda visita</DemoAction>
          )}
          {cerrada && <DemoAction result="queda marcada como revisada por muestreo (no bloquea la activación).">Revisión de calidad</DemoAction>}
        </div>
      </header>

      {!sinAgenda && (
        <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CAMINO.map((c, i) => {
            const done = cerrada || (paso >= 0 && i <= paso) || (fallida && i <= 3);
            const failHere = fallida && i === 4;
            return (
              <li key={c.estado} className={`rounded-xl p-3 text-sm ${failHere ? "bg-danger-soft text-danger" : done ? "bg-ok-soft text-ok" : "bg-surface text-muted"}`}>
                <span className="flex items-center gap-1.5 font-medium">
                  {done && <CheckIcon className="size-4" />}
                  {failHere ? "Falla en pruebas" : c.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Cliente y vehículo">
          <Facts
            items={[
              ["Cliente", <Link key="c" href={`/clientes/${v.clienteId}`} className="text-accent-ink hover:underline">{v.cliente.nombre}</Link>],
              ["Estado del cliente", <EstadoPill key="e" estado={v.cliente.estado} subestado={v.cliente.subestado} />],
              ["Dirección", `${v.cliente.direccion}, ${v.comuna}`],
              ["Teléfono", v.cliente.telefono],
              ["Vehículo", <span key="v" className="inline-flex items-center gap-1.5"><Patente>{v.vehiculo.patente}</Patente> {v.vehiculo.marca} {v.vehiculo.modelo}</span>],
              ["Plan", planId ? getPlan(planId).name : "—"],
              ["Origen", v.ordenFolio ?? v.ticketFolio ?? "—"],
            ]}
          />
        </Card>

        <Card title="Técnico">
          {tecnico ? (
            <Facts
              items={[
                ["Nombre", tecnico.nombre],
                ["Teléfono", tecnico.telefono],
                ["Comunas", tecnico.comunas.slice(0, 4).join(", ") + (tecnico.comunas.length > 4 ? "…" : "")],
                ["Cupo diario", String(tecnico.cupoDiario)],
              ]}
            />
          ) : (
            <p className="text-sm text-muted">
              {v.estado === "requiere_persona"
                ? "No hay cupo compatible tras las alternativas automáticas y la lista de espera. Operaciones debe coordinar con el cliente."
                : v.estado === "lista_espera"
                  ? "El cliente pidió «Avísame cuando haya disponibilidad». Se le avisará en orden de llegada cuando se libere un cupo."
                  : "El cliente aún no elige día y bloque."}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">El técnico ve teléfono y dirección exacta solo desde 24 h antes hasta 48 h después del cierre.</p>
        </Card>

        <Card title={<span className="flex items-center gap-2">Evidencia <SimTag /></span>}>
          {v.checkInEn ? (
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2"><CameraIcon className="size-4 text-muted" /> Check-in · patente verificada · 5 fotos · {formatDateTime(v.checkInEn)}</li>
              {(cerrada || fallida) && <li className="flex items-center gap-2"><CameraIcon className="size-4 text-muted" /> Ubicación del equipo y conexiones · 2 fotos</li>}
              {v.imei && <li className="flex items-center gap-2"><CheckIcon className="size-4 text-ok" /> IMEI <Mono>{v.imei}</Mono> (Luhn OK, en custodia)</li>}
              {cerrada && (
                <>
                  <li className="flex items-center gap-2"><CheckIcon className="size-4 text-ok" /> Pruebas: conexión, posición, comunicación, estado{conRele ? ", corte y sirena (vehículo detenido)" : ""}</li>
                  <li className="flex items-center gap-2"><CheckIcon className="size-4 text-ok" /> GPSTracker confirma el pulso del IMEI</li>
                  <li className="flex items-center gap-2"><SignatureIcon className="size-4 text-muted" /> Firma y conformidad de quien recibe · {formatDateTime(v.checkOutEn!)}</li>
                </>
              )}
              {fallida && <li className="font-medium text-danger">Causa: {CAUSA_FALLA[v.causaFalla!]}</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin evidencia todavía: se registra en el portal del técnico desde el check-in.</p>
          )}
        </Card>

        {ticket && (
          <Card title="Ticket vinculado" className="xl:col-span-3">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Mono>{ticket.folio}</Mono>
              <Pill tone={ESTADO_TICKET_TONE[ticket.estado]}>{ticket.estado}</Pill>
              <span className="font-medium">{ticket.asunto}</span>
            </p>
            <p className="mt-1 text-sm text-muted">{ticket.detalle}</p>
          </Card>
        )}

        <Card title="Bitácora de la visita" className="xl:col-span-3">
          {eventos.length === 0 ? (
            <p className="text-sm text-muted">Creada el {formatDateTime(v.creadaEn)} al aprobarse el pago.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {eventos.map((e) => (
                <li key={e.id} className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm">
                  <span className="font-mono text-xs text-muted">{formatDateTime(e.en)}</span>
                  <span>
                    <span className="font-mono text-xs font-medium tracking-wide uppercase">{e.tipo}</span>
                    <span className="ml-2 text-xs text-muted">{e.actor}</span>
                    {e.detalle && <span className="block text-ink-soft">{e.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
