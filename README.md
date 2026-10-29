# Alpha Link GPS · CRM

CRM de la línea B2C de Alpha Tecnología: ventas, instalación con técnicos freelance, soporte y cobro recurrente. Sigue el [Service Blueprint B2C v2](https://endlvsss.github.io/alpha-tecnologia-blueprint/) (repositorio `endlvsss/alpha-tecnologia-blueprint`) y la especificación del módulo de instaladores (`../Especificacion-modulo-instaladores.md`).

**Estado (27/10/2026): frontend demostrable de punta a punta, en modo DEMO.** Todavía no hay base de datos, login ni integraciones reales: todo corre en el navegador con datos ficticios.

## Desarrollo

Next.js 16 (App Router, TypeScript, Tailwind CSS 4), sin otras dependencias.

```bash
npm install
npm run dev     # http://localhost:3200
npm run lint
npx tsc --noEmit
npm run build
```

## Modo DEMO

- Los datos parten de una semilla determinista del día (unos 50 clientes en todos los estados del blueprint, 6 técnicos y el inventario).
- Cada acción (crear un lead, confirmar un pago, reservar, cerrar una instalación, activar…) es un **comando** que pasa por el motor de reglas. Se guarda en `localStorage` bajo la clave `alg-crm:demo:v1` y se reproduce al recargar.
- **Reiniciar datos** (en la franja DEMO o en `/demo`) vuelve a la semilla. Si cambia el día, la demo se reinicia sola.
- Nada sale del navegador: no hay pagos, mensajes, activaciones GPS ni asignaciones reales.
- Precios y planes son **ilustrativos** hasta la aprobación comercial.

## Conexión con el sitio y el portal del técnico (demo)

El sitio (`../website`, puerto 3000) y el CRM (puerto 3200) se conectan con eventos de integración. El contrato está en [docs/contratos-api.md §3b](docs/contratos-api.md).

- **Sitio → CRM:** en el checkout o la agenda, panel «Demo interna» → «Enviar al CRM» abre `/integraciones/entrada`. Al aplicar el evento se crean el cliente, la orden, el pago, la orden de instalación y la reserva.
- **Portal → CRM:** en una visita cerrada o fallida del portal, «Enviar resultado al CRM» registra el cierre o la falla.
- **CRM → portal:** en una instalación asignada a Diego Fuentes, «Enviar al portal del técnico» la agrega a su agenda.
- **Navegación:** el menú «Otros sistemas (demo)» abre el sitio y el portal. Las direcciones se cambian con `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_CRM_URL`.

## Pantallas

| Ruta | Qué permite |
|---|---|
| `/` | Dashboard: ingresos, ventas, activos, MRR, instalaciones y tickets con filtro de período; gráfico de ingresos, embudo, visitas de hoy, alertas operativas y actividad |
| `/demo` | Recorrido guiado de 10 pasos: lead → checkout → plan → pago → orden de instalación → reserva → instalación → activación → módulos → dashboard |
| `/ventas` | Pipeline Kanban de 8 etapas: arrastrar y soltar (o flecha sin arrastre), panel lateral, filtros, búsqueda e historial |
| `/clientes`, `/clientes/[id]` | Lista y ficha 360°: contacto (editable), vehículos e IMEI, pagos y suscripción, instalaciones, soporte, cuenta GPS, timeline unificado y notas |
| `/ordenes` | Orden creada, pago pendiente, pago confirmado y reembolso, separados; transacciones por orden |
| `/agenda` | Vista de día, semana y mes por técnico; reserva sin doble agenda |
| `/visitas`, `/visitas/[id]` | Instalaciones por estado (pendiente, asignada, en camino, en proceso, completada, cancelada, requiere revisión); detalle con checklist, fotos de ejemplo, observaciones, cierre, falla y activación |
| `/tecnicos`, `/tecnicos/[id]` | Reclutamiento y ficha: documentos, cobertura, cupo, disponibilidad semanal, métricas e instalaciones |
| `/dispositivos` | Inventario por IMEI con estado de inventario y de activación |
| `/cobros` | Suscripciones, próximas renovaciones, morosidad con reintento y cancelaciones |
| `/finanzas` | Ingresos confirmados, cobros, costo de instalación (ilustrativo) y conciliación simulada |
| `/soporte` | Tickets en tabla o tablero, con filtros, asignación y detalle (pensado para leer el Service Desk) |
| `/integraciones` | Sistemas externos, fuente de verdad e identificadores compartidos |

## Cómo está armado

```
src/
  lib/domain/          Modelo (types), etiquetas, pipeline (8 etapas derivadas),
                       agenda (cupo, cobertura, sin doble reserva) y engine
                       (comandos y reglas de negocio, sin React)
  data/seed.ts         Semilla determinista de datos ficticios
  services/
    contracts.ts       Contratos provisorios (Customer, Order, Installer…) e interfaces de servicio
    mock/              Proveedor mock: consultas puras + store de la demo
    index.tsx          ServicesProvider, useQuery y useAction (lo único que usan las pantallas)
  features/            Pantallas por módulo (cliente), con sus diálogos
  app/(crm)/           Rutas: páginas de servidor livianas que montan cada vista
  components/          Armazón, kit visual, diálogos nativos, toasts, skeletons y gráfico
```

- **Las pantallas solo usan `src/services`.** Para pasar a la API real se escribe otro proveedor que cumpla `Services` y se activa con `NEXT_PUBLIC_DATA_MODE=api`. Ver [docs/contratos-api.md](docs/contratos-api.md).
- El estado del cliente lo calcula el sistema; mover una tarjeta ejecuta el evento correspondiente (decisión D7).
- La instalación física y la activación del servicio son pasos separados (diagnóstico §4.4).
- Todos los indicadores salen del mismo conjunto de datos: un cambio en la demo se ve en todas las pantallas.

## Recorrido sugerido para mostrar a Jorge (10 min)

1. **Inicio** (`/`): estado del negocio, alertas operativas y período de 30 días.
2. **Recorrido demo** (`/demo`): crear un lead ficticio y avanzar los 8 pasos (plan Seguridad, aprobar el pago, crear la orden, reservar el primer bloque, simular la instalación, activar).
3. **Pipeline** (`/ventas`): el cliente nuevo está en «Activo». Arrastrar otra tarjeta de «Pendiente de pago» a «Pago confirmado».
4. **Ficha 360°**: abrir al cliente nuevo y mostrar vehículo, IMEI, suscripción, transacción y timeline; agregar una nota.
5. **Agenda** y **Técnicos**: la reserva ocupa el bloque; aprobar los documentos de un postulante y activarlo.
6. **Finanzas** y **Suscripciones**: el pago suma al ingreso; una orden sin pagar no; simular un cobro moroso.
7. **Integraciones**: qué falta de la plataforma GPS y del CRM matriz.
8. **Reiniciar datos** al terminar.

## Próximos pasos

0. Revisar con Adolfo, Camila y Matías la arquitectura de datos, APIs, permisos y sincronización ([docs/contratos-api.md](docs/contratos-api.md)).
1. Supabase local (requiere Docker) + Drizzle con migraciones `.sql` versionadas.
2. Login con roles Administrador, Operaciones e Instalador, con RLS.
3. Checkout del sitio → API del CRM: pago aprobado → PAGADO + CUENTA CREADA.
4. Agenda con reserva sin choques (restricción única por técnico, fecha y bloque).
5. Portal del técnico (`/instalador`, hoy en el sitio) dentro del CRM.

Decisiones y pendientes: [docs/decisiones.md](docs/decisiones.md).
