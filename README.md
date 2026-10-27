# Alpha Link GPS · CRM

CRM de la línea B2C de Alpha Tecnología: ventas, instalación con técnicos freelance, soporte y cobro recurrente. Sigue el [Service Blueprint B2C v2](https://endlvsss.github.io/alpha-tecnologia-blueprint/) (repositorio `endlvsss/alpha-tecnologia-blueprint`) y la especificación del módulo de instaladores (`../Especificacion-modulo-instaladores.md`).

**Estado (27/10/2026): mockup navegable con datos ficticios.** Todavía no hay base de datos, login ni integraciones reales.

## Desarrollo

Next.js 16 (App Router, TypeScript, Tailwind CSS 4).

```bash
npm install
npm run dev   # http://localhost:3200
```

## Pantallas

| Ruta | Qué muestra | Tramo del blueprint |
|---|---|---|
| `/` | Inicio: ventas, ingreso recurrente, embudo, visitas de hoy, casos que requieren persona, actividad | Todos |
| `/ventas` | Tablero con los 6 estados principales y sus subestados | 1–4 |
| `/clientes` | Lista con filtro por estado y búsqueda por nombre, RUT, patente o comuna (sin importar tildes) | – |
| `/clientes/[id]` | Ficha 360°: línea de vida, datos, bitácora, vehículos e IMEI, visitas, pagos, soporte y **Cuenta Alpha** (lo que ve el cliente en GPSTracker y qué se sincroniza) | 1–4B |
| `/ordenes` | Órdenes del checkout y pagos Webpay | 1 |
| `/agenda` | Semana por técnico y bloque de 2 h | 2 |
| `/visitas`, `/visitas/[id]` | Por agendar, lista de espera, agendadas, hoy, con incidencia, cerradas; detalle con evidencia y bitácora | 2, 2B, 2C |
| `/tecnicos` | Técnicos freelance, estado de validación, cupo, carga y custodia | 2 |
| `/dispositivos` | Inventario por IMEI (GPS VL103M y TAG PB705), último pulso y batería | 2, 3B |
| `/soporte` | Tickets por estado (ABIERTO → RESUELTO), niveles de GPS sin reportar y de alerta interna | 3, 3B |
| `/cobros` | Suscripciones, morosidad con período de gracia, cancelaciones y suspendidos | 4, 4B |
| `/integraciones` | Sistemas externos y lo que necesitamos de la API de GPSTracker | – |

Los botones de acción (reprogramar, reasignar, reenviar enlace…) muestran qué haría el sistema, pero no guardan nada.

## Cómo está armado

```
src/
  lib/domain/types.ts   Modelo de datos: una interfaz por tabla (pasa tal cual a SQL)
  lib/domain/labels.ts  Etiquetas y tonos de cada estado
  data/seed.ts          Generador determinista de datos ficticios (~50 clientes en todos los estados)
  data/index.ts         Capa de acceso a datos: lo único que leen las pantallas
  app/(crm)/            Pantallas
  components/           Armazón, kit visual y piezas de la ficha del cliente
```

- **Las pantallas solo leen desde `src/data/index.ts`.** Para pasar a Supabase se reescriben esas funciones con Drizzle y las pantallas no cambian.
- Los datos dependen de la fecha de hoy (hora de Santiago): la agenda siempre se ve vigente y la misma fecha produce los mismos datos.
- El estado del cliente lo calcula el sistema; no se edita a mano (decisión D7 de la especificación).
- Mismo diseño que el sitio de Alpha Link GPS: tema oscuro por defecto con opción clara y la misma clave de tema (`alg-theme-v2`).

## Próximos pasos

1. Supabase local (requiere Docker) + Drizzle con migraciones `.sql` versionadas.
2. Login con roles Administrador, Operaciones e Instalador, con RLS.
3. Checkout del sitio → API del CRM: pago aprobado → PAGADO + CUENTA CREADA.
4. Agenda con reserva sin choques (restricción única por técnico, fecha y bloque).
5. Portal del técnico (`/instalador`, hoy en el sitio) dentro del CRM.

Decisiones y pendientes: [docs/decisiones.md](docs/decisiones.md).
