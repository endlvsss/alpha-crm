import type { Metadata } from "next";
import { Card, PageHeader, Pill, SimTag, Table } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Integraciones" };

// Lo que el CRM necesita de cada sistema externo. Hoy todo es simulado; cada
// conector vive detrás de una interfaz para cambiarlo por el real sin tocar pantallas.
const SISTEMAS = [
  {
    nombre: "Sitio Alpha Link GPS",
    rol: "Landing, checkout y agenda del cliente",
    estado: "Por conectar",
    detalle: "El checkout envía la orden con plan, vehículo, dirección, UTM y consentimiento. La agenda lee horarios reales y reserva en el CRM.",
  },
  {
    nombre: "Webpay (Transbank)",
    rol: "Pago inicial y cobro recurrente",
    estado: "Simulado",
    detalle: "Pago aprobado o rechazado → orden. Cobro mensual o anual, reintento y enlace para actualizar el medio de pago. Faltan contrato y credenciales.",
  },
  {
    nombre: "GPSTracker",
    rol: "Cuenta del cliente y datos del GPS",
    estado: "Simulado",
    detalle: "Sin acceso al código ni a la API por ahora. Los datos que necesita el CRM están listados abajo para pedírselos al proveedor.",
  },
  {
    nombre: "Service Desk",
    rol: "Tickets de soporte",
    estado: "Simulado",
    detalle: "Mientras no haya acceso, los tickets viven en el CRM. Si se conecta, el CRM espeja su estado (ABIERTO → RESUELTO).",
  },
  {
    nombre: "Correo",
    rol: "Confirmaciones, recordatorios e invitaciones",
    estado: "Por elegir",
    detalle: "Pago, reserva, recordatorios 24/5/2 h, técnico en camino, «ya está protegido», morosidad.",
  },
  {
    nombre: "WhatsApp Business",
    rol: "Avisos operativos",
    estado: "Por elegir",
    detalle: "El MVP puede partir solo con correo. Las alertas del GPS no van por WhatsApp.",
  },
];

const GPS_API: [string, string, string][] = [
  ["Crear usuario «Cliente» con RUT y correo, e invitarlo", "Pago aprobado", "CUENTA CREADA"],
  ["Consultar el último pulso de un IMEI (GPS y TAG)", "Pruebas del técnico", "Reemplaza la confirmación manual (D9)"],
  ["Crear vehículo: patente, dueño, IMEI GPS e IMEI TAG", "Check-out OK", "INSTALADO → ACTIVO"],
  ["Bloquear usuario y ocultar vehículo; reactivar", "Morosidad, baja o regularización", "SUSPENDIDO / CANCELADO / ACTIVO"],
  ["Mover un IMEI a otro vehículo", "Traslado (4B)", "VEHÍCULO ACTIVO con nueva patente"],
  ["Recibir alertas: sin reportar, desacople, críticas (webhook)", "En uso", "Ticket de soporte (3B)"],
];

export default function IntegracionesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Integraciones"
        description="Con qué sistemas habla el CRM y en qué momento del blueprint. Todo lo marcado como simulado se reemplaza por el servicio real sin rehacer pantallas."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SISTEMAS.map((s) => (
          <Card key={s.nombre} title={s.nombre} action={s.estado === "Simulado" ? <SimTag /> : <Pill tone="muted">{s.estado}</Pill>}>
            <p className="text-sm font-medium text-ink-soft">{s.rol}</p>
            <p className="mt-1.5 text-sm text-muted">{s.detalle}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold tracking-[-0.015em]">Lo que necesitamos de la API de GPSTracker</h2>
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
        GPSTracker ya obtiene los datos de los equipos desde la API de Tracksolid (Jimi IoT). Si el proveedor no abre su API, una alternativa es leer los pulsos directamente desde Tracksolid con una cuenta propia de Alpha.
      </p>
    </>
  );
}
