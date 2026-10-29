import type { Metadata } from "next";
import { Card, Mono, PageHeader, Pill, SimTag, Table } from "@/components/ui/kit";
import { Bandeja } from "@/features/integraciones/bandeja";

export const metadata: Metadata = { title: "Integraciones" };

// Ecosistema acordado el 27/10/2026: sistemas independientes conectados por
// navegación e integraciones de datos. Todo es provisorio hasta revisar con
// Adolfo, Camila y Matías bases de datos, APIs, permisos y sincronización.
const SISTEMAS = [
  {
    nombre: "Sitio Alpha Link GPS",
    rol: "Landing, checkout, agenda y portal del técnico",
    estado: "Conectado (demo)",
    detalle: "Compra, reserva y resultado de la visita llegan como eventos «sitio.compra» y «portal.visita»; el CRM envía «crm.visita» al portal. En la demo viajan por enlace; en producción, por API.",
  },
  {
    nombre: "Plataforma GPS y portal de clientes",
    rol: "Cuenta del cliente, telemetría, alertas y comandos",
    estado: "Simulado",
    detalle: "Equipo de Adolfo y Camila. Next.js + Supabase + Tracksolid. Hoy sin API pública: alta, activación y suspensión son manuales.",
  },
  {
    nombre: "CRM corporativo Alpha (matriz)",
    rol: "Leads, contactos, consentimiento, facturación B2B",
    estado: "Por conectar",
    detalle: "Ya tiene un webhook de leads (nombre, correo, teléfono, empresa, notas). Falta acordar qué se sincroniza y con qué identificador.",
  },
  {
    nombre: "Pasarela de pago",
    rol: "Pago inicial, cobro recurrente y reembolsos",
    estado: "Simulado",
    detalle: "Webpay (decisión del 15/10) o Mercado Pago (reuniones del 23 y 26/10): PENDIENTE. El modelo acepta cualquiera.",
  },
  {
    nombre: "Service Desk",
    rol: "Tickets de soporte",
    estado: "Simulado",
    detalle: "Sin acceso todavía. La vista de Soporte está pensada para leerlo por API y guardar solo el vínculo.",
  },
  {
    nombre: "Correo, WhatsApp y boleta",
    rol: "Avisos operativos y DTE 39",
    estado: "Por elegir",
    detalle: "Proveedores por definir. Las alertas del GPS no van por WhatsApp. Ningún mensaje sale en la demo.",
  },
];

/** Qué entidad necesita un identificador compartido y quién es la fuente de verdad. */
const FUENTES: [string, string, string, string][] = [
  ["Persona / cliente", "CRM corporativo (contacto) o CRM Alpha Link", "RUT normalizado + customer_id", "Por decidir"],
  ["Lead y atribución (UTM)", "CRM corporativo", "lead_id del CRM matriz", "Webhook existe"],
  ["Orden y pago", "CRM Alpha Link", "order_folio + provider_payment_id", "Contrato provisorio"],
  ["Suscripción y cobro", "CRM Alpha Link", "subscription_id", "Contrato provisorio"],
  ["Vehículo", "CRM Alpha Link", "Patente + vehicle_id", "Mapear con la plataforma GPS"],
  ["Dispositivo", "Inventario CRM Alpha Link", "IMEI (único)", "Mapear con la plataforma GPS"],
  ["Usuario del portal y telemetría", "Plataforma GPS", "external_portal_user_id (RUT en su lado)", "Sin API"],
  ["Alertas y comandos", "Plataforma GPS", "IMEI + alert_id", "Sin API"],
  ["Ticket", "Service Desk", "external_ticket_id", "Sin acceso"],
  ["Técnico y visita", "CRM Alpha Link", "installer_id, appointment_folio", "Contrato provisorio"],
];

const GPS_API: [string, string, string][] = [
  ["Crear usuario «Cliente» con RUT y correo, e invitarlo", "Pago aprobado", "CUENTA CREADA"],
  ["Crear vehículo: patente, dueño, IMEI GPS e IMEI TAG", "Instalación cerrada", "INSTALADO"],
  ["Consultar el último pulso de un IMEI (GPS y TAG)", "Activación", "ACTIVO (reemplaza la confirmación manual)"],
  ["Bloquear usuario y ocultar vehículo; reactivar", "Morosidad, baja o regularización", "SUSPENDIDO / CANCELADO / ACTIVO"],
  ["Mover un IMEI a otro vehículo", "Traslado", "VEHÍCULO ACTIVO con nueva patente"],
  ["Webhook de eventos: primer pulso, sin reportar, desacople", "En uso", "Ticket de soporte automático"],
];

export default function IntegracionesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Integraciones"
        description="Ecosistema de sistemas independientes conectados por navegación y datos. Cada conector vive detrás de un servicio con contrato provisorio: se cambia el proveedor mock por el real sin rehacer pantallas."
      />
      <div className="mb-6">
        <Bandeja />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SISTEMAS.map((s) => (
          <Card key={s.nombre} title={s.nombre} action={s.estado === "Simulado" ? <SimTag /> : <Pill tone="muted">{s.estado}</Pill>}>
            <p className="text-sm font-medium text-ink-soft">{s.rol}</p>
            <p className="mt-1.5 text-sm text-muted">{s.detalle}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold tracking-[-0.015em]">Identificador compartido y fuente de verdad</h2>
      <Table head={["Entidad", "Fuente de verdad (propuesta)", "Identificador compartido", "Estado"]} minWidth={820}>
        {FUENTES.map(([e, f, id, st]) => (
          <tr key={e}>
            <td className="font-medium">{e}</td>
            <td className="text-ink-soft">{f}</td>
            <td><Mono className="text-ink-soft">{id}</Mono></td>
            <td><Pill tone={st.startsWith("Sin") ? "danger" : st.startsWith("Por") || st.startsWith("Mapear") ? "amber" : "muted"}>{st}</Pill></td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold tracking-[-0.015em]">Lo que necesitamos de la API de la plataforma GPS</h2>
      <Table head={["Operación", "Cuándo", "Efecto en el CRM"]} minWidth={720}>
        {GPS_API.map(([op, cuando, efecto]) => (
          <tr key={op}>
            <td className="font-medium">{op}</td>
            <td className="text-ink-soft">{cuando}</td>
            <td className="font-mono text-xs tracking-wide text-ink-soft uppercase">{efecto}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-sm text-muted">
        Contratos provisorios en <Mono>src/services/contracts.ts</Mono> y <Mono>docs/contratos-api.md</Mono>. No hay sincronización bidireccional, SSO, webhooks ni migraciones hasta la confirmación técnica.
      </p>
    </>
  );
}
