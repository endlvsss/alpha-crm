# Diagnóstico de arquitectura · Alpha Link GPS

**Fecha:** 27/10/2026 · **Base:** documento maestro del 27/10, Service Blueprint B2C v2, especificación de instaladores v0.2 y revisión del código y la evidencia disponibles.

**Para:** Claudio, Matías y Jorge. Sirve para decidir la arquitectura antes de construir más módulos.

Cómo leerlo:
- **[VERIFICADO]** = lo revisé en el código.
- **[EVIDENCIA]** = sale del manual o de capturas, no del código.
- **[NO VERIFICADO]** = no hay acceso.
- **[ACUERDO]**, **[PENDIENTE]** y **[PROPUESTA]**: como en el documento maestro.

---

## 1. Resumen

1. **Lo que construimos nosotros es un prototipo navegable sin backend.** El sitio y el CRM nuevo son Next.js 16. No tienen base de datos, login real, API ni integraciones, y todo vive en el navegador o en datos ficticios. Sirven para validar el flujo, el diseño y el modelo de datos, no para producción.
2. **Del CRM corporativo y del portal del cliente no tenemos código.** Lo que sabemos sale del manual, de capturas y de lo que se ve en pantalla. Su stack, su base de datos y sus APIs están **NO VERIFICADOS**. Es lo que más bloquea.
3. **Hay que reabrir una decisión.** El 27/10 por la mañana quedó registrado «CRM nuevo desde cero, en un repositorio aparte» (`docs/decisiones.md`). El documento maestro pide lo contrario: no duplicar sistemas, usuarios ni bases, y decidir con Jorge y Matías entre un módulo dentro del CRM corporativo (opción A) y un sistema vertical conectado (opción B). Mientras no se decida, el repositorio `alpha-crm` debe tratarse como **prototipo de interfaz y borrador del contrato de datos**, no como el CRM definitivo.
4. **Recomendación [PROPUESTA]:** opción A, es decir, Alpha Link como unidad dentro del CRM corporativo, siempre que Jorge dé acceso a su repositorio y a su base. Ese CRM ya resuelve contactos «Persona natural» con RUT, consentimiento según la Ley 19.628 y la Ley 21.719, login endurecido, roles en el servidor, unidades de negocio, folios y un webhook de leads. Todo eso tendríamos que reconstruirlo en la opción B. Si el acceso no llega pronto, la opción B queda como alternativa, con contrato y sincronización explícitos (sección 5).
5. **Lo más urgente del negocio** es convertir el tráfico de Instagram en leads trazables (reunión del 26/10). Hoy el sitio no envía nada a ningún CRM ni tiene Meta Pixel. El webhook de leads del CRM corporativo ya existe, así que es lo más rápido de conectar, con la autorización de Jorge.

---

## 2. Qué existe hoy

### 2.1 Sistemas

| Sistema | Dónde | Stack | Estado real | Evidencia |
|---|---|---|---|---|
| CRM corporativo | `auto-crm-rust.vercel.app` | Vercel, framework JS (inferido), plantilla «auto-crm» personalizada con Claude Code. Base de datos desconocida | En uso, orientado a B2B. Datos visibles aparentemente ficticios; 2 usuarios reales | [EVIDENCIA] manual de 19 páginas y 36 capturas en `../Guia CRM` y `../Secciones CRM` |
| Portal del cliente (GPSTracker) | `gps-tracker-nine-eta.vercel.app` | Vercel, Leaflet, datos desde Tracksolid (Jimi IoT) | Funciona con 2 vehículos de prueba. Lo hizo un proveedor externo, que no ha compartido código ni API | [EVIDENCIA] 30 capturas del 29/09 y del 08/10 |
| Service Desk | ? | ? | Se reporta que existe | [NO VERIFICADO] |
| Sitio Alpha Link GPS | este repositorio `website` | Next.js 16, sin dependencias de backend | Prototipo: landing, compra simulada, agenda y portal del técnico | [VERIFICADO] |
| CRM Alpha Link (mockup) | `alpha-crm` | Next.js 16, sin dependencias de backend | Prototipo: 12 pantallas de administración con datos ficticios | [VERIFICADO] |

### 2.2 Lo que construimos, módulo por módulo

| Módulo | Existe | Dónde | Calidad / qué es | Falta para producción |
|---|---|---|---|---|
| Landing y planes | Sí | `website/src/app/(sitio)` | Completa. Precios **provisorios fijos en código** (`src/lib/plans.ts`) | Precios desde configuración aprobada; Meta Pixel; aviso de cookies |
| Captación de leads | **No** | — | `src/lib/analytics.ts` solo escribe en `window.dataLayer` | Formulario → API → CRM, con UTM y consentimiento |
| Checkout | Sí (simulado) | `website/src/app/(compra)/checkout` | Validación de RUT y patente; comunas de la RM; consentimiento. Guarda en `sessionStorage` | Orden en el servidor, precio congelado, pasarela real con webhook |
| Pago | Simulado | `checkout/pago` | Botones aprobar y rechazar | Integrar la pasarela (Webpay o Mercado Pago, **PENDIENTE**) |
| Agenda del cliente | Sí (demo) | `website/src/app/(compra)/agenda` | Bloques reales según la disponibilidad del técnico de demo; retención de 10 min; lista de espera | Reserva atómica en la base de datos; reprogramar y cancelar por el cliente |
| Portal del técnico | Sí (demo) | `website/src/app/instalador` | Pantallas I1–I9 completas; reglas en `src/lib/instalador/rules.ts`. Login de demo y datos en `localStorage` | Login real, persistencia, fotos en almacenamiento privado, permisos en el servidor |
| Back-office CRM | Sí (mockup) | `alpha-crm/src/app/(crm)` | Inicio, ventas, clientes con ficha 360°, órdenes, agenda, visitas, técnicos, dispositivos, soporte, cobros e integraciones | Todo el backend |
| Modelo de datos | Borrador | `alpha-crm/src/lib/domain/types.ts` | 14 entidades. Una sola capa de acceso (`src/data/index.ts`) facilita cambiar la fuente de datos | Ajustes de la sección 4.3 |
| Seguridad | **No** | — | No hay login, RLS, auditoría ni almacenamiento privado | Todo lo de la sección 16 del documento maestro |

### 2.3 CRM corporativo: qué tiene [EVIDENCIA]

- **Módulos:** Dashboard, Leads, Empresas, Contactos, Pipeline, Cotizaciones, Actividades, Proyectos, Equipo, Facturación, Contratos, Unidades, Usuarios y Configuración.
- **Flujo:** Lead → Cotización (horas × UF) → Proyecto → Factura (DTE 33/34) → Contrato (cuota mensual en UF).
- **Leads:** estados Nuevo, Contactado, Calificado, En propuesta, Hot y Perdido; score de 0 a 10; temperatura; próxima acción; 13 fuentes, entre ellas «Webhook».
- **Contactos:** admiten «Persona natural» con RUT, canal preferido y **consentimiento con enlace personal y versión del texto**.
- **Login:** usuario y contraseña con Turnstile, bloqueo tras 5 fallos, tope de 20 fallos por IP, sesión de 8 h y contraseña temporal obligatoria.
- **Roles:** 5 (Administrador, Gerencia comercial, Ejecutivo, Delivery y Finanzas), aplicados en el servidor.
- **Unidades de negocio:** Software, IA & Data e IoT.
- **Webhook:** `POST /api/webhook` con `x-webhook-secret`. Solo acepta nombre, correo, teléfono, empresa y notas: **sin UTM, plan, vehículo ni dirección**.
- **Defectos visibles:**
  - Fechas del Dashboard corridas un día respecto de las tablas (probable zona horaria; hay que fijar `America/Santiago`).
  - Cotizaciones y facturas vencidas que no cambian de estado.
  - Folios desordenados.
  - Valor UF ingresado a mano ($39.450, mientras que en la reunión del 22/10 se usó $41.119).
- **No tiene:**
  - vehículos, dispositivos ni inventario;
  - pedidos ni pagos;
  - suscripciones en CLP;
  - boleta (DTE 39);
  - agenda;
  - usuarios externos (técnicos o clientes);
  - tickets;
  - trabajos en segundo plano: las notificaciones solo se revisan cada 5 min mientras el CRM está abierto;
  - una API más allá del webhook de leads.

### 2.4 Portal del cliente (GPSTracker): qué tiene [EVIDENCIA]

- **Pantallas:** Dashboard, Mis vehículos (con botones Cortar suministro y Activar sirena), Conductores, Reporte de flota, Historial, Centro de alertas, Geocercas, Mi perfil y Notificaciones (solo por correo).
- **Administración:** Dispositivos, Usuarios, Vehículos y una terminal para consultar Tracksolid.
- **Roles:** solo «Super administrador» y «Cliente». **No es multiempresa**: no se ve una entidad empresa ni separación por organización, lo que importa para B2B.
- **Identificadores que comparte con el CRM:** **RUT** del usuario (no se puede editar), **patente**, **IMEI** del GPS y del TAG. No se ven IDs internos.
- **Alertas:** severidad Crítica, Alta, Media o Baja; estado Activa o Resuelta. Incluye el desacople GPS/TAG.
- **No se ve:** estado «suspendido» del cliente (solo ocultar el vehículo o bloquear al usuario), SIM o ICCID, ni registro de comandos.
- **Riesgos a corregir:**
  - Las capturas muestran datos reales de personas y una sesión de Super administrador en una URL pública de Vercel.
  - Los modelos de los equipos (VL103M y PB705) aparecen en pantalla. Según la regla del 16/10 no deben verse fuera del ámbito interno.

---

## 3. Qué falta (frente al documento maestro, sección 7)

| Módulo | Prototipo | Falta | Bloqueado por |
|---|---|---|---|
| A. Dashboard Alpha Link | Mockup con KPIs | Definición y fuente de cada KPI; filtros; KPIs reales | Base de datos |
| B. Clientes | Ficha 360° (mockup) | Cliente separado del lead; varios vehículos con historial de propietario; vínculo `external_portal_user_id` | Arquitectura e identidad |
| C. Embudo | Tablero por estado | Lead como entidad propia con UTM, dueño, deduplicación y tareas; captura desde la landing | Webhook o API |
| D. Pedidos y pagos | Órdenes (mockup) | Precio congelado; `payments` y `payment_events` idempotentes; webhook verificado; reembolsos | Pasarela |
| E. Suscripciones | Cobros (mockup) | Reglas configurables; licencias del dispositivo separadas de la cuota; packs | Política comercial |
| F. Catálogo e inventario | Lista de IMEI | SKU y modelos; movimientos inmutables; IMEI exclusivo; SIM | Datos de stock |
| G. Instaladores | Lista + portal (demo) | Postulación separada del alta; cobertura; tarifas y recargos; liquidaciones | Política con técnicos |
| H. Agenda | Demo en el navegador | Reserva atómica con restricción única; retención antes del pago (POR DEFINIR) | Base de datos |
| I. Portal del técnico | Completo (demo) | Servidor, login, almacenamiento privado, URL firmadas | Arquitectura |
| J. Activación | Fusionada con «INSTALADO» | Evento separado con fuente (API o manual), evidencia y responsable | API GPSTracker |
| K. Soporte | Tickets en el CRM (mockup) | Vínculo con Service Desk; categorías; SLA configurable | Acceso al Service Desk |
| L. Renovación y bajas | Parcial (morosidad) | Motivos de baja; traslado; segundo vehículo; pausa; destino del equipo | Política |
| Mensajería | No | `notification_outbox` con plantillas, consentimiento e intentos | Proveedor de correo y WhatsApp |
| Pantallas del cliente después de pagar | No | Reprogramar, cancelar, actualizar el pago, traslado, segundo vehículo | Decidir si van en el sitio o en GPSTracker |
| Facturación B2C | No | Boleta DTE 39 | Proveedor tributario |
| Seguridad | No | RBAC, RLS, auditoría, almacenamiento privado, OWASP | Arquitectura |

---

## 4. Arquitectura y base de datos

### 4.1 Contexto (C4 nivel 1, simplificado)

```
         Cliente                        Técnico freelance           Equipo Alpha
            |                                 |                          |
   Sitio Alpha Link GPS  ---------->  Portal del técnico        CRM corporativo Alpha
  (landing, checkout, agenda)        (móvil, solo lo suyo)    (leads, contactos, pipeline,
            |                                 |                facturas, unidades, roles)
            |                                 |                          |
            +--------> [ ALPHA LINK: órdenes, pagos, suscripciones, vehículos, ] <--+
                       [ inventario, agenda, visitas, activación, tickets     ]
                          |            |              |               |
                    Pasarela de    GPSTracker       Service Desk    Correo / WhatsApp
                      pago        (cuenta cliente,  (tickets)       (avisos operativos)
                  (Webpay o MP)    Tracksolid)
```

La caja **ALPHA LINK** es la que hay que ubicar:
- **Opción A:** dentro del CRM corporativo.
- **Opción B:** como servicio aparte.

En cualquiera de las dos, los dueños de los datos son estos:

| Dato | Dueño (fuente de verdad) | Los demás guardan |
|---|---|---|
| Persona / empresa, contacto, consentimiento | CRM corporativo | ID de referencia |
| Lead y atribución (UTM) | CRM (unidad Alpha Link) | — |
| Orden, pago, suscripción, boleta | Alpha Link | KPI agregados para la matriz |
| Vehículo, dispositivo, inventario, visita, evidencia | Alpha Link | — |
| Usuario del portal, telemetría, alertas, geocercas, comandos | GPSTracker | `external_portal_user_id`, último pulso y resumen de alertas (nunca coordenadas) |
| Ticket | Service Desk (si tiene API); si no, Alpha Link | `external_ticket_id` |

### 4.2 Opción A u opción B

| | A · módulo en el CRM corporativo | B · sistema vertical separado |
|---|---|---|
| Reutiliza | Login, roles, contactos, consentimiento, folios, unidades, webhook, facturación | Nada directamente; se integra por API |
| Usuarios | Un solo directorio | Dos directorios por sincronizar |
| Riesgo | Depende de acceso a un código que no conocemos | Duplicar clientes y tener que mantener una sincronización |
| Requiere | Repositorio, base y despliegue del CRM corporativo; acuerdo con Jorge sobre quién aprueba las migraciones | Contrato de API, IDs mapeados, sincronización idempotente, panel de errores |
| Encaja con | Documento maestro (§1.1, §8), especificación D1 del 16/10 | Reunión del 22/10 por la tarde (separar el CRM corporativo del vertical, conceptual) |

**Recomendación [PROPUESTA]:** A, con el módulo Alpha Link aislado en su propio esquema o carpeta y permisos por unidad, para que mañana pueda separarse sin reescribirlo. El mockup `alpha-crm` se porta como pantallas de esa unidad. **Decisión: Jorge y Matías.**

### 4.3 Base de datos: del mockup al modelo del documento maestro

Mapa entre lo que hay en `types.ts` y la propuesta conceptual (§11). Las tablas del CRM corporativo están **NO VERIFICADAS**: los nombres de la columna «Corporativo» salen de sus pantallas.

| Concepto | Corporativo (evidencia) | Mockup `alpha-crm` | Acción |
|---|---|---|---|
| Cuenta / persona | Empresas, Contactos («Persona natural» + RUT) | `Cliente` | **Reutilizar** contactos; el cliente B2C pasa a ser un contacto con perfil Alpha Link |
| Consentimiento | Sí, con versión | `consentimientoMarketing: boolean` | **Reutilizar** el del corporativo |
| Lead | Leads (estados B2B, fuente, dueño) | Mezclado dentro de `Cliente` | **Separar**; agregar `utm_*`, `landing_url`, `unit_id` |
| Usuarios y roles | 5 roles | — | **Extender**: Operaciones, Inventario, Instalador, Soporte |
| Unidad de negocio | Software / IA / IoT | — | **Agregar** «Alpha Link GPS» |
| Factura | DTE 33/34 | — | **Extender** con DTE 39 (boleta), cuando se defina el proveedor |
| Vehículo | — | `Vehiculo` con `imeiGps` e `imeiTag` | **Crear** `vehicles` + `vehicle_assignments`; los IMEI pasan a `vehicle_device_installations` con rol `principal` / `respaldo` |
| Plan y precio | — | Constantes en `plans.ts` | **Crear** `plans` + `plan_prices` con vigencia y `approval_state`; nada fijo en el código |
| Orden | — | `Orden` (`pasarela: "webpay"` fijo) | **Crear** `orders` + `order_items` con precio congelado; pasarela como dato |
| Pago | — | Dentro de `Orden` | **Crear** `payments` + `payment_events` (único por `provider_event_id`) |
| Suscripción | Contratos en UF (B2B) | `Suscripcion`, `Cobro` | **Crear** `subscriptions` + `subscription_vehicles`; licencias del equipo en `renewal_events` |
| Dispositivo | — | `Dispositivo` (modelo como lista fija) | **Crear** `device_models`, `devices`, `sims`, `inventory_locations`, `inventory_movements` (inmutable) |
| Técnico | Equipo (interno, UF/hora; no sirve) | `Tecnico` | **Crear** `installer_applications`, `installers`, `installer_coverage`, `availability_slots`, `installer_payouts` |
| Visita | — | `Visita` (cita + instalación juntas) | **Separar** en `appointments` (reserva) e `installations` + `installation_evidence` |
| Activación | — | Implícita en INSTALADO → ACTIVO | **Crear** `activation_events` (fuente `api` o `manual`, responsable, evidencia) |
| Ticket | — (Service Desk aparte) | `Ticket` | **Crear** `support_tickets` / `external_ticket_links` según exista API |
| Cuenta en el portal | — | `CuentaPlataforma`, `AlertaPlataforma` | **Crear** `portal_links` (`external_portal_user_id`, estado de invitación) y un resumen de alertas, sin ubicaciones |
| Bitácora | Actividad reciente | `Evento` | **Crear** `status_history` + `service_events` (con `idempotency_key`) |
| Mensajes | Notificaciones del navegador | — | **Crear** `notification_outbox` |
| KPI para la matriz | Dashboard | `resumen()` | **Crear** `business_kpi_snapshots` |

Reglas transversales:
- UUID en todas las tablas.
- Fechas en UTC y mostradas en `America/Santiago`.
- Montos en enteros con su moneda.
- Borrado lógico.
- RLS en todas las tablas que se lean desde el navegador.
- `service_role` solo en el servidor.

### 4.4 Máquinas de estado independientes

El estado del cliente del blueprint (6 estados + 8 subestados + 2 eventos) sigue existiendo, pero **se calcula** a partir de estas máquinas y no se edita a mano. Así se mantiene la decisión D7 y se cumple el §21.4 del documento maestro.

| Entidad | Estados (propuesta) |
|---|---|
| Lead | nuevo → contactado → calificado → plan_presentado → pendiente_pago → ganado / perdido |
| Orden | creada → pendiente_pago → pagada / rechazada / expirada → reembolsada (parcial o total) |
| Pago | iniciado → aprobado / rechazado / anulado / reembolsado |
| Cita | pendiente_asignacion → reservada → confirmada → tecnico_en_camino → tecnico_llego → en_instalacion → completada; salidas: reprogramacion_solicitada, no_show_cliente, tecnico_no_presentado, fallida, cancelada |
| Instalación | iniciada → recepcion_ok → instalada → pruebas_ok → fisica_finalizada / fallida |
| Activación | pendiente → conectividad_verificada → plataforma_vinculada → cuenta_habilitada → servicio_activado / fallida |
| Suscripción | pendiente_instalacion → activa → pago_pendiente → suspendida → cancelada (pausa: POR DEFINIR) |
| Ticket | abierto → en_revision → esperando_cliente / visita_tecnica → resuelto → cerrado |

Cambio respecto de lo construido: **la instalación física terminada ya no activa el servicio por sí sola.** La especificación D9 proponía activar automáticamente, y el documento maestro (§5.3 y §7.J) lo permite solo con una integración real que verifique el pulso. Mientras tanto, la activación necesita una confirmación manual explícita.

---

## 5. Integraciones

| Con | Para qué | Qué existe | Qué hay que pedir |
|---|---|---|---|
| CRM corporativo | Leads de la landing; contactos y consentimiento; KPI | Webhook `POST /api/webhook` (5 campos) | Acceso al repositorio y la base; ampliar el webhook con UTM, plan, comuna y consentimiento, o una API versionada |
| GPSTracker | Crear el usuario Cliente al pagar; crear el vehículo y vincular los IMEI al instalar; consultar el último pulso en las pruebas; bloquear o reactivar; traer alertas de desacople y equipos sin reporte | Nada expuesto | API o webhooks del proveedor. **Si el proveedor no la abre:** leer Tracksolid directamente para el pulso (con cuenta y credenciales de Alpha) y crear las cuentas a mano mientras tanto |
| Tracksolid (Jimi) | Pulso y estado del IMEI | GPSTracker ya lo consume | Credenciales de la cuenta Alpha y límites de la API |
| Pasarela | Pago inicial, cobro recurrente, reembolsos | Nada | **Decidir Webpay o Mercado Pago**, cuenta y RUT titular, recurrencia, sandbox |
| Service Desk | Tickets de soporte y visitas técnicas | Se reporta que existe | Acceso, API y modelo de ticket |
| Boleta electrónica | DTE 39 para personas | Nada | Proveedor (o el que use hoy el CRM corporativo) |
| Correo / WhatsApp | Confirmaciones, recordatorios, morosidad | El CRM corporativo envía correo (proveedor desconocido) | Proveedor y plantillas; WhatsApp no es imprescindible para el MVP |
| Meta Pixel / GA4 | Medir el embudo | Eventos en `dataLayer` | ID del píxel, aviso de cookies, eventos `Purchase` solo desde el servidor |

Patrón común:
- Bandeja de salida (outbox) con reintentos.
- `idempotency_key` en cada evento.
- Tabla de fallos de integración.
- Nunca escribir directamente en la base de otro sistema.
- Nunca enviar RUT, dirección, fotos, IMEI ni ubicación a herramientas de marketing.

---

## 6. Contradicciones a resolver

| Tema | Una fuente dice | Otra dice | Estado |
|---|---|---|---|
| Pasarela | **Webpay**, mensual y anual (decisión del 15/10, ya en el código) | **Mercado Pago** como prioridad (reuniones del 23/10 y el 26/10) | **PENDIENTE**. El modelo debe aceptar cualquier proveedor |
| Arquitectura | CRM nuevo en un repositorio aparte (27/10, `docs/decisiones.md`) | No duplicar; opción A o B con Jorge y Matías (documento maestro); extender el CRM corporativo (especificación D1, 16/10) | **PENDIENTE** |
| Precios | `plans.ts`: Esencial 59.990 + 8.990/mes, etc. | 23/10: 99.990 + 14.990; lanzamiento 79.990 + 12.990; familiar ~9.990 por vehículo | **Ninguno aprobado**. Hay que alinear el sitio con lo último discutido o dejarlo marcado como referencial |
| Plan «Flota» | Plan B2C en el sitio | B2B es un segmento aparte con pipeline consultivo | **PENDIENTE**: ¿se reemplaza por un pack familiar? |
| Corte de suministro y sirena | Se ofrecen en la landing (15/10) | Prueba en un auto real después del 28/10; ningún comando operativo desde el CRM | **Revisar** que la landing no lo prometa antes del piloto |
| Activación | Automática si pasan las pruebas (D9) | Solo con verificación real; si no, manual | Se adopta el documento maestro |
| Recordatorios | 24 h, 5 h y 2 h (blueprint) | 24 h y 2 h, como propuesta | **PENDIENTE**, configurable |
| Recargo por distancia | No está en el checkout | CLP 500/km después de 30 km (citado, no aprobado) | **PENDIENTE**: origen, ida o ida y vuelta |
| Blueprint v2 | Starter·Pro·Max, monitoreo 24/7, bot 24/7, avisos por app y WhatsApp | Decisiones del 15/10 y reglas del sitio | Publicar una **v3 del blueprint** |

---

## 7. Roadmap por prioridad

| Fase | Qué | Depende de | Quién (propuesta) |
|---|---|---|---|
| **P0.0 Bloqueante** (esta semana; checkpoint del 28/10) | Acceso al repositorio y la base del CRM corporativo, a GPSTracker y al Service Desk · decidir A o B · decidir la pasarela · acordar el contrato de datos con Matías · definir quién aprueba las migraciones | Jorge, Matías | Claudio prepara las preguntas (sección 8) |
| **P0.1 Captación** (urgente por Instagram) | Formulario de lead en la landing → ruta del servidor → webhook del CRM corporativo, con UTM y consentimiento · Meta Pixel con aviso de cookies (`PageView`, `Lead`) | Secreto del webhook y autorización de Jorge; ID del píxel | Claudio (sitio); Matías (webhook si se amplía) |
| **P0.2 Contrato de datos** (puede partir ya) | `docs/data-contract.md`: entidades, estados, DTOs en TypeScript, errores, dueños · refactorizar el mockup según §4.3 y §4.4 | Nada | Claudio; revisa Matías |
| **P0.3 Catálogo, órdenes y pagos** | Planes y precios configurables con aprobación · órdenes con precio congelado · pasarela en sandbox con webhook verificado e idempotente · checkout bloqueado por un flag hasta tener precios aprobados | P0.0 (pasarela, arquitectura) | Matías (backend) + Claudio (UI) |
| **P0.4 Técnicos, agenda e inventario** | Postulación y aprobación de técnicos · cobertura y bloques · reserva atómica · stock serializado y custodia | P0.0 | — |
| **P0.5 Portal del técnico y activación** | Pasar `/instalador` al servidor con login y almacenamiento privado · activación verificada (manual o por API) · vínculo con la cuenta del portal | P0.4, GPSTracker | — |
| **P0.6 Postventa y gerencia** | Service Desk · suscripciones y morosidad · bajas, traslado y segundo vehículo · KPI hacia la matriz | P0.3–P0.5 | — |
| **P0.7 Salida a producción** | Revisión OWASP Top 10 · pruebas de RLS, permisos, webhooks y concurrencia · respaldos y rollback · piloto en un auto real · precios, contrato y seguros aprobados | Todo lo anterior | — |
| **P1** | Pack familiar, flotas B2B (pipeline corporativo), liquidaciones, renovaciones de licencias | — | — |
| **P2** | Automatizaciones avanzadas, reportes de flota, nuevas regiones, sensores (solo si se valida su factibilidad) | — | — |

El contrato de datos (P0.2) **no depende** de la decisión A o B: sirve en los dos casos y evita que Claudio y Matías diseñen modelos distintos.

---

## 8. Preguntas para el checkpoint del 28/10

1. **Arquitectura:** ¿Alpha Link va dentro del CRM corporativo (A) o como sistema aparte (B)? ¿Quién hospeda cada uno y quién aprueba las migraciones?
2. **Acceso:** ¿podemos tener acceso de desarrollo al repositorio y la base del CRM corporativo? ¿Qué base usa (Supabase, otra)? ¿Hay un entorno de pruebas?
3. **Webhook:** ¿autoriza conectar ya la landing al webhook de leads? ¿Se puede ampliar con UTM, plan, comuna y consentimiento?
4. **GPSTracker:** ¿quién negocia con el proveedor la API o los webhooks? Si no, ¿usamos Tracksolid directamente con la cuenta de Alpha?
5. **Service Desk:** ¿dónde está, quién lo mantiene y si tiene API.
6. **Pasarela:** ¿Webpay o Mercado Pago? ¿Con qué cuenta y RUT titular?
7. **Precios:** ¿qué oferta se publica y desde cuándo? ¿Se mantiene un plan «Flota» en B2C?
8. **Boleta:** ¿qué proveedor de DTE 39?
9. **Reparto:** ¿qué parte toma Matías (backend, autenticación, pagos) y qué parte Claudio (interfaz, flujo, contrato)?
