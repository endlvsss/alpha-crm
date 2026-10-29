# Decisiones del CRM

Registro de decisiones para quien continúe el desarrollo. Las decisiones de negocio abiertas se marcan **POR DEFINIR**, como en el blueprint.

## Tomadas

| Fecha | Decisión | Por qué |
|---|---|---|
| 27/10/2026 | CRM nuevo, no extender el CRM actual (`auto-crm-rust`) | El CRM actual está pensado para venta consultiva B2B (cotizaciones en UF, proyectos). No hay acceso a su código. |
| 27/10/2026 | Alcance: solo Alpha Link GPS B2C (tramos 1 a 4B) | El journey de empresas y flotas se hará aparte. El modelo deja espacio para sumar otra unidad de negocio. |
| 27/10/2026 | Supabase (Postgres, login, almacenamiento de fotos) + Drizzle con migraciones `.sql` versionadas | SQL legible y revisable, fácil de entregar al equipo de desarrollo. |
| 27/10/2026 | Repositorio propio; el sitio se conecta por API | Entrega más simple a los socios y al equipo. |
| 27/10/2026 | El portal del técnico (`/instalador`) se mueve del sitio al CRM | Mismo login, roles y base (decisión D1 de la especificación). |
| 27/10/2026 | Primero el mockup visual con datos ficticios | Sin acceso a GPSTracker ni a la base todavía; sirve para validar con los socios. |
| 27/10/2026 | Ecosistema de sistemas independientes, conectados por navegación e integraciones (reunión del 27/10) | Arquitectura definitiva de bases, APIs, permisos y sincronización: a revisar con Adolfo, Camila y Matías. |
| 27/10/2026 | Frontend en modo DEMO con capa de servicios y proveedor mock intercambiable | Permite demostrar el flujo completo sin backend; el proveedor real se conecta sin rehacer pantallas. |
| 27/10/2026 | Pipeline de 8 etapas derivado de eventos; mover una tarjeta ejecuta el evento simulado | Mantiene la decisión D7 (el estado lo calcula el sistema). |
| 27/10/2026 | La instalación física y la activación del servicio son pasos separados | Sin API de la plataforma GPS, la activación la confirma una persona (diagnóstico §4.4). |
| 15/10/2026 | Planes Esencial · Seguridad · Flota, precios provisorios | Decisión del cliente. |
| 15/10/2026 | Corte de suministro y sirena se ofrecen, solo con el vehículo detenido | Decisión del cliente. |
| 15/10/2026 | Pago con Webpay, mensual o anual (anual: 10 meses pagados, 12 de uso) | Decisión del cliente. |

## GPSTracker (cuenta del cliente)

GPSTracker es la plataforma donde el cliente ve su vehículo. La desarrolló un proveedor externo y hoy no tenemos su código ni su API. Por eso el CRM guarda un espejo simulado (`CuentaPlataforma`, `AlertaPlataforma`, pulsos en `Dispositivo`), y `/integraciones` lista lo que hay que pedirle al proveedor. GPSTracker obtiene los datos de los equipos desde la API de Tracksolid (Jimi IoT). Si el proveedor no la abre, la alternativa es leer Tracksolid directamente.

## POR DEFINIR (afectan al CRM)

- Período de gracia (~15 días, referencial) y regla de SUSPENDIDO a CANCELADO.
- CANCELACIÓN SOLICITADA: ¿subestado o se pasa directo a CANCELADO? Devolución o penalidad.
- Reprogramaciones permitidas, espera antes del no-show, cobro de visita y plazo de la segunda visita.
- Umbrales de GPS sin reportar (temporal, persistente, crítico) y SLA por nivel.
- Cupo máximo por técnico, tarifa por visita y proceso de validación.
- Canal de alertas internas (Telegram propuesto, no aprobado) y proveedor de correo y WhatsApp.
- Beneficio por segundo vehículo y condiciones del traslado.
