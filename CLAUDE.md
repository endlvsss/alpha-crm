@AGENTS.md

# Alpha Link GPS · CRM

CRM B2C de Alpha Link GPS. Lee `README.md` (pantallas y arquitectura), `docs/decisiones.md` y `../Especificacion-modulo-instaladores.md` (modelo de datos, estados, reglas de agenda).

- Idioma de la interfaz: español de Chile.
- Proceso de referencia: Service Blueprint B2C v2. Respeta los estados del cliente: LEAD, PAGADO, INSTALACIÓN AGENDADA, ACTIVO, SUSPENDIDO, CANCELADO, con sus subestados y eventos. Solo el sistema cambia el estado.
- Las pantallas leen y escriben solo a través de `src/services` (`useQuery`, `useAction`); el modelo vive en `src/lib/domain/types.ts` y las reglas en `src/lib/domain/engine.ts`. Contratos provisorios: `docs/contratos-api.md`.
- Modo DEMO: toda acción es simulada y queda en `localStorage` (`alg-crm:demo:v1`). No crear tablas, migraciones, endpoints, RLS ni integraciones reales hasta la confirmación técnica.
- Datos ficticios hasta tener la base. Webpay, GPSTracker, Service Desk y mensajería están simulados: márcalos como tales y no inventes integraciones reales.
- Precios, planes y políticas sin aprobar se muestran como provisorios o POR DEFINIR.
