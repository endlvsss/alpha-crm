import type { Metadata } from "next";
import Link from "next/link";
import { listTickets } from "@/data";
import type { EstadoTicket } from "@/lib/domain/types";
import { ESTADO_TICKET_TONE, ORIGEN_TICKET } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { Card, Dot, Empty, Mono, PageHeader, Patente, Pill, SimTag } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Soporte" };

// Ciclo de un ticket (tramo 3B): de izquierda a derecha.
const COLUMNAS: EstadoTicket[] = ["ABIERTO", "EN REVISIÓN", "ESPERANDO CLIENTE", "VISITA TÉCNICA", "RESUELTO"];

export default async function SoportePage() {
  const tickets = await listTickets();
  return (
    <>
      <PageHeader
        eyebrow="Soporte y cobro"
        title="Soporte"
        description={
          <>
            Tickets por GPS sin reportar, desacople de señales, instalaciones fallidas y lo que el bot no resuelve. En el tablero de ventas se ven como SOPORTE ABIERTO del cliente ACTIVO. <SimTag>Service Desk simulado</SimTag>
          </>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        <div className="grid min-w-[70rem] grid-cols-5 gap-3">
          {COLUMNAS.map((estado) => {
            const lista = tickets.filter((t) => t.estado === estado);
            return (
              <section key={estado} className="rounded-2xl bg-bg-sunken/60 p-2">
                <h2 className="flex items-center gap-2 px-2 pt-1.5 pb-2.5 text-sm font-semibold">
                  <Dot tone={ESTADO_TICKET_TONE[estado]} /> {estado}
                  <span className="ml-auto font-mono text-xs text-muted">{lista.length}</span>
                </h2>
                {lista.length === 0 ? (
                  <p className="px-2 pb-2 text-xs text-muted">Sin tickets.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lista.map((t) => (
                      <li key={t.folio}>
                        <Link href={`/clientes/${t.clienteId}?tab=soporte`} className="block rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2">
                          <span className="flex items-center justify-between gap-2">
                            <Mono className="text-muted">{t.folio}</Mono>
                            <Pill tone={t.nivel === "URGENTE" ? "danger" : t.nivel === "ATENCIÓN" ? "amber" : "muted"}>{t.nivel}</Pill>
                          </span>
                          <span className="mt-1.5 block text-sm font-semibold">{t.asunto}</span>
                          <span className="mt-0.5 block text-xs text-muted">{ORIGEN_TICKET[t.origen]}</span>
                          <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                            {t.patente && <Patente>{t.patente}</Patente>}
                            <span className="truncate">{t.cliente.nombre}</span>
                          </span>
                          <span className="mt-1 block font-mono text-xs text-muted">{formatDateTime(t.creadoEn)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card title="GPS sin reportar: 3 niveles">
          <ul className="flex flex-col gap-2 text-sm">
            <li><span className="font-semibold">Temporal:</span> <span className="text-ink-soft">se registra y se espera. Aviso solo si corresponde.</span></li>
            <li><span className="font-semibold">Persistente:</span> <span className="text-ink-soft">ticket automático y aviso al cliente.</span></li>
            <li><span className="font-semibold">Crítico:</span> <span className="text-ink-soft">alerta URGENTE y contacto rápido de una persona.</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted">Umbrales de tiempo: POR DEFINIR.</p>
        </Card>
        <Card title="Niveles de alerta interna">
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            <li><Pill tone="muted">INFO</Pill> nueva venta, instalación agendada (resumen diario)</li>
            <li><Pill tone="amber">ATENCIÓN</Pill> pago fallido, offline persistente, técnico atrasado</li>
            <li><Pill tone="danger">URGENTE</Pill> desacople o evento de seguridad: avisa de inmediato</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Canal (Telegram u otro): propuesto, no aprobado.</p>
        </Card>
        <Card title="Bot de soporte">
          <Empty>El bot (tramo 3) todavía no existe. Cuando no resuelva, creará un ticket con el contexto de la conversación.</Empty>
        </Card>
      </div>
    </>
  );
}
