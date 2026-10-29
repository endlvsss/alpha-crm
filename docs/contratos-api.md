# Contratos provisorios · CRM Alpha Link GPS

**Estado (27/10/2026):** borrador para revisar con Adolfo, Camila y Matías. Nada de esto está implementado contra un backend: hoy lo cumple el proveedor mock (`src/services/mock`).

**Para qué sirve:** que el frontend y el backend diseñen lo mismo. Las pantallas solo hablan con las interfaces de `src/services/contracts.ts`. Para conectar la API real:

1. Se escribe un proveedor que implemente `Services`.
2. Se activa con `NEXT_PUBLIC_DATA_MODE=api`.

Ninguna pantalla cambia.

**Fuera de alcance hasta tener confirmación técnica:** tablas Supabase, migraciones, RLS, endpoints productivos, SSO, webhooks y sincronización bidireccional.

---

## 1. Entidades

Los nombres en inglés son los del contrato. Cada uno apunta a un tipo del dominio en `src/lib/domain/types.ts`. Las formas **no** están acopladas a tablas: son DTO de lectura.

| Contrato | Tipo de dominio | Campos clave | Notas |
|---|---|---|---|
| `Customer` | `Cliente` | `id`, `rut`, `estado`, `subestado`, `responsableId`, `cuentaCreadaEn`, `instaladoEn`, `activadoEn` | El estado lo calcula el sistema (D7). La activación va separada de la instalación física. |
| `Lead` | `Cliente` en estado `LEAD` | Igual que `Customer`, más `origen` y `campana` | Se separará en una entidad propia si el lead vive en el CRM matriz. |
| `Vehicle` | `Vehiculo` | `id`, `clienteId`, `patente`, `imeiGps`, `imeiTag`, `estado` | La patente es única entre vehículos vigentes. |
| `Device` | `Dispositivo` | `imei`, `tipo` (`gps`/`tag`), `estado`, `custodiaTecnicoId`, `vehiculoId`, `ultimoPulso` | El IMEI es el identificador compartido con la plataforma GPS. |
| `Order` | `Orden` | `folio`, `clienteId`, `planId`, `periodicidad`, `montoTotal`, `estado`, `pasarela` | Una orden **no** es un ingreso. |
| `Payment` | `Pago` | `id`, `ordenFolio`, `monto`, `estado` (`pendiente`/`aprobado`/`rechazado`/`reembolsado`), `ref` | Un registro por intento. Solo `aprobado` cuenta como ingreso. |
| `Subscription` | `Suscripcion` | `id`, `vehiculoId`, `planId`, `periodicidad`, `estado`, `proximoCobro`, `morosoDesde` | Una por vehículo. |
| `Installer` | `Tecnico` | `id`, `rut`, `estado`, `comunas`, `cupoDiario`, `disponibilidad`, `documentos` | `disponibilidad`: bloques por día (1 = lunes … 6 = sábado). |
| `Appointment` | `Visita` | `folio`, `tipo`, `tecnicoId`, `fecha`, `bloque`, `estado`, `checklist`, `fotos`, `observaciones` | En la API real se separa en *cita* (reserva) e *instalación* (ejecución). |
| `SupportTicket` | `Ticket` | `folio`, `clienteId`, `nivel`, `estado`, `responsableId`, `visitaFolio` | Espejo del Service Desk mientras no haya acceso. |

Montos en CLP enteros con IVA. Fechas civiles `YYYY-MM-DD`; instantes ISO 8601 con desfase de `America/Santiago`.

## 2. Servicios

| Servicio | Lecturas | Acciones (en la demo, simuladas) |
|---|---|---|
| `CustomerService` | `list`, `get` (ficha 360°), `team` | `create` (lead), `update`, `addVehicle`, `addNote` |
| `PipelineService` | `board`, `history` | `advance`: ejecuta el evento que lleva el caso a la etapa siguiente |
| `OrderService` | `list` | `startCheckout`, `sendToGateway`, `confirmPayment`, `rejectPayment`, `refund`, `createInstallationOrder` |
| `InstallerService` | `list`, `get`, `appointments`, `appointment`, `calendar`, `availableSlots` | `apply`, `setStatus`, `reviewDocument`, `update`, `book`, `advance`, `toggleChecklist`, `addPhoto`, `saveNotes`, `complete`, `fail`, `cancel` |
| `DeviceService` | `list`, `available` | `activate` |
| `BillingService` | `subscriptions`, `finance` | `cancelSubscription`, `retryCharge` |
| `SupportService` | `list` | `create`, `setStatus`, `assign` |
| `DashboardService` | `summary`, `today` | — |

Todas las acciones devuelven `Result<T>`: `{ ok: true, data }` o `{ ok: false, error }`. El error es un mensaje en español para mostrar al usuario. Las reglas de negocio están en `src/lib/domain/engine.ts` y son las mismas que debería validar el servidor:

- no hay doble reserva;
- el cupo diario se respeta;
- el técnico debe cubrir la comuna;
- el checklist debe estar completo antes del cierre;
- el reembolso solo procede antes de la instalación;
- la activación solo procede con la instalación cerrada.

## 3. Pipeline comercial (8 etapas)

```
Nuevo lead → Checkout iniciado → Pendiente de pago → Pago confirmado →
Instalación pendiente → Instalación agendada → Instalado → Activo
```

La etapa **se deriva** de la orden, el pago, las visitas y la activación (`src/lib/domain/pipeline.ts`). No se edita a mano: arrastrar una tarjeta ejecuta el evento del sistema. Los estados del blueprint (LEAD, PAGADO, INSTALACIÓN AGENDADA, ACTIVO, SUSPENDIDO, CANCELADO) siguen siendo el estado del cliente.

## 3b. Eventos de integración con el sitio y el portal del técnico (demo)

Contrato en `src/services/eventos.ts`, idéntico a `website/src/lib/eventos.ts`. Cada evento tiene versión (`v: 1`), un `id` (para la idempotencia), `tipo`, `emitidoEn` y `datos`.

| Evento | De → a | Cuándo | Qué hace al aplicarse |
|---|---|---|---|
| `sitio.compra` | Sitio → CRM | Compra pagada (con o sin reserva) | Crea o completa el cliente por RUT, el checkout, el pago (ref. `WEB-<folio>`), la orden de instalación y la reserva |
| `portal.visita` | Portal del técnico → CRM | Visita cerrada o fallida | Busca la visita activa por **patente**, da de alta el IMEI si no existe, registra checklist y evidencia, y cierra la visita (la activación queda pendiente) o la marca fallida con ticket |
| `crm.visita` | CRM → portal | Operaciones asigna una visita a Diego Fuentes | La agrega a la agenda del técnico como «Por confirmar», salvo que choque con otra visita en ese bloque |

**Identificadores compartidos:** RUT del cliente, patente, IMEI y RUT del técnico (`15.678.901-1`, el técnico del portal de demo).

**En la demo:** el evento viaja codificado en el fragmento de la URL (`#evento=…`), que no llega a ningún servidor. Quien lo recibe lo muestra y lo aplica con un clic, y la bandeja de entrada (`/integraciones`) guarda el `id` para no aplicarlo dos veces.

**En producción:** los mismos objetos pasan a ser webhooks firmados (HMAC), con reintentos y una tabla de fallos.

**Limitación conocida de la demo:** el CRM y el portal generan agendas de prueba independientes para Diego Fuentes. Por eso una visita enviada desde el CRM puede chocar con otra del portal en el mismo bloque, y una reserva del sitio puede chocar con la agenda del CRM. En ambos casos se avisa y la visita queda para reasignar. Con una sola base de datos esto no ocurre.

## 4. Pendiente de las APIs del equipo GPS (Adolfo y Camila)

La plataforma GPS usa Next.js, Supabase y Tracksolid. Hoy funciona con Server Actions y no expone una API.

| Necesidad | Cuándo | Propuesta de contrato |
|---|---|---|
| Crear usuario «Cliente» | Pago confirmado | `POST /customers {rut, nombre, email, telefono} → {external_portal_user_id}` |
| Crear vehículo y vincular IMEI | Instalación cerrada | `POST /vehicles {external_portal_user_id, patente, marca, modelo, anio, imei_gps, imei_tag, voltaje_base}` |
| Último pulso de un IMEI | Activación | `GET /devices/{imei}/last-report → {at, lat?, lon?, voltaje?}`. El CRM **no** guarda coordenadas. |
| Bloquear o reactivar | Morosidad, baja, regularización | `POST /customers/{id}/suspend` · `/resume` |
| Eventos | En uso | Webhook firmado: `first_report`, `offline`, `gps_tag_decoupled`, `sos` |
| Regla de corte | Siempre | Confirmar que el corte de suministro exige vehículo detenido en el servidor |

**Bloqueo:** sin esta API, la activación se confirma a mano (como en la demo) y las cuentas se crean manualmente en la plataforma.

## 5. Sincronización con el CRM matriz de Alpha

| Dato | Dirección | Estado |
|---|---|---|
| Lead de la landing (con UTM y consentimiento) | Sitio → CRM matriz (webhook existente) | El webhook solo acepta nombre, correo, teléfono, empresa y notas. Falta ampliarlo. |
| Persona / contacto | ¿Matriz → Alpha Link o al revés? | **Por decidir**: quién es la fuente de verdad. |
| KPI agregados (ventas, MRR, activos) | Alpha Link → matriz | Propuesta: un *snapshot* diario, no la sincronización registro a registro. |

## 6. Identificadores compartidos y fuente de verdad

| Entidad | Fuente de verdad (propuesta) | Identificador compartido |
|---|---|---|
| Persona | CRM matriz o Alpha Link (**por decidir**) | RUT normalizado + `customer_id` |
| Orden, pago, suscripción | Alpha Link | `order_folio`, `provider_payment_id`, `subscription_id` |
| Vehículo | Alpha Link | Patente + `vehicle_id` |
| Dispositivo | Inventario Alpha Link | IMEI |
| Usuario del portal, telemetría, alertas | Plataforma GPS | `external_portal_user_id` |
| Ticket | Service Desk | `external_ticket_id` |

## 7. Preguntas para la revisión técnica

1. ¿Qué base y qué proyecto Supabase usará el CRM Alpha Link? ¿Es la misma instancia de la plataforma GPS, en otro esquema, o una aparte?
2. ¿La plataforma GPS puede exponer los 5 endpoints de la sección 4? ¿Con qué autenticación (API key de servidor o firma)?
3. ¿Quién es la fuente de verdad de la persona: el CRM matriz o Alpha Link?
4. Roles y permisos: ¿se reutiliza el login de la plataforma GPS o del CRM matriz, o hay uno propio? El rol técnico **nunca** debe poder enviar comandos al vehículo.
5. Pasarela: ¿Webpay o Mercado Pago? Hace falta un sandbox y un webhook idempotente.
6. Service Desk: ¿dónde está y tiene API?
