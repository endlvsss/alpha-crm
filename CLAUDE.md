@AGENTS.md

# Alpha Link GPS · CRM

CRM B2C de Alpha Link GPS. Lee `README.md` (pantallas y arquitectura), `docs/decisiones.md` y `../Especificacion-modulo-instaladores.md` (modelo de datos, estados, reglas de agenda).

- Idioma de la interfaz: español de Chile.
- Proceso de referencia: Service Blueprint B2C v2. Respeta los estados del cliente: LEAD, PAGADO, INSTALACIÓN AGENDADA, ACTIVO, SUSPENDIDO, CANCELADO, con sus subestados y eventos. Solo el sistema cambia el estado.
- Las pantallas leen únicamente desde `src/data/index.ts`; el modelo vive en `src/lib/domain/types.ts`.
- Datos ficticios hasta tener la base. Webpay, GPSTracker, Service Desk y mensajería están simulados: márcalos como tales y no inventes integraciones reales.
- Precios, planes y políticas sin aprobar se muestran como provisorios o POR DEFINIR.
