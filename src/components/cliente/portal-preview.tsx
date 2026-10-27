import type { ClienteDetalle } from "@/data";
import { BLOQUE_FIN } from "@/data/seed";
import { formatDateTime } from "@/lib/format";
import { getPlan } from "@/lib/plans";
import { BellIcon, CarIcon, ClockIcon, PowerIcon, SirenIcon } from "@/components/ui/icons";
import { Patente, Pill, SimTag } from "@/components/ui/kit";
import { SeverityChip } from "@/components/ui/severity";

/**
 * Lo que ve el cliente en su cuenta de la plataforma GPS (GPSTracker), armado con
 * los datos que el CRM le envía. Nunca se muestran datos GPS falsos: sin
 * instalación, la cuenta dice «Instalación pendiente».
 */
export function PortalPreview({ data }: { data: ClienteDetalle }) {
  const { cliente, vehiculos, dispositivos, alertas, cuenta, suscripciones, visitas } = data;
  const activos = vehiculos.filter((v) => v.estado === "activo");
  const plan = suscripciones[0] ? getPlan(suscripciones[0].planId) : null;
  const bloqueada = cuenta?.estadoUsuario === "bloqueado";
  const proxima = visitas.find((v) => v.fecha && ["agendada", "confirmada", "en_camino"].includes(v.estado));

  return (
    <div className="overflow-hidden rounded-2xl bg-bg-sunken">
      {/* Barra de la plataforma */}
      <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand text-on-brand">
            <CarIcon className="size-3.5" />
          </span>
          Cuenta Alpha
        </span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <BellIcon className="size-4" />
          {cliente.nombre.split(" ").slice(0, 2).join(" ")}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {bloqueada ? (
          <div className="rounded-xl bg-danger-soft p-4 text-sm text-danger">
            <p className="font-semibold">Cuenta suspendida</p>
            <p className="mt-1">
              {cliente.estado === "CANCELADO"
                ? "El servicio terminó. Los datos se conservan según la política de retención (POR DEFINIR)."
                : "Hay un pago pendiente. Al regularizarlo, el servicio se reactiva automáticamente."}
            </p>
          </div>
        ) : activos.length === 0 ? (
          <div className="rounded-xl bg-surface p-5">
            <p className="font-mono text-xs font-medium tracking-[0.14em] text-accent-ink uppercase">Instalación pendiente</p>
            <p className="mt-1 font-display text-lg font-bold">Tu vehículo aún no tiene GPS instalado</p>
            <p className="mt-1 text-sm text-muted">
              {proxima
                ? `Tu técnico llega el ${proxima.fecha} entre ${proxima.bloque} y ${BLOQUE_FIN[proxima.bloque!]}.`
                : "Elige el día y el bloque de tu instalación para empezar."}{" "}
              Cuando el técnico termine, aquí verás tu vehículo en el mapa.
            </p>
            {plan && <p className="mt-3 text-xs text-muted">Plan {plan.name}</p>}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
            <ul className="flex flex-col gap-2">
              {activos.map((v) => {
                const gps = dispositivos.find((d) => d.imei === v.imeiGps);
                const tag = dispositivos.find((d) => d.imei === v.imeiTag);
                const offline = !gps?.ultimoPulso || alertas.some((a) => a.vehiculoId === v.id && !a.resuelta && a.tipo === "GPS sin reportar");
                return (
                  <li key={v.id} className="rounded-xl bg-surface p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{v.marca} {v.modelo}</span>
                      <Patente>{v.patente}</Patente>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-bg-sunken/70 p-2">
                        <dt className="text-muted">Último reporte</dt>
                        <dd className={`mt-0.5 font-medium ${offline ? "text-danger" : ""}`}>
                          {gps?.ultimoPulso ? formatDateTime(gps.ultimoPulso) : "Sin datos"}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-bg-sunken/70 p-2">
                        <dt className="text-muted">Señal de respaldo</dt>
                        <dd className="mt-0.5 font-medium">{tag ? `${tag.bateria ?? "—"}% batería` : "No incluida"}</dd>
                      </div>
                    </dl>
                    {v.imeiTag && (
                      <div className="mt-2.5 flex gap-2">
                        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger-soft py-1.5 text-xs font-semibold text-danger">
                          <PowerIcon className="size-3.5" /> Cortar suministro
                        </span>
                        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink/[0.07] py-1.5 text-xs font-semibold">
                          <SirenIcon className="size-3.5" /> Activar sirena
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
              {activos.some((v) => v.imeiTag) && (
                <li className="px-1 text-xs text-muted">El corte de suministro solo se usa con el vehículo detenido.</li>
              )}
            </ul>
            <div className="flex flex-col gap-3">
              <MapPlaceholder count={activos.length} />
              <div className="rounded-xl bg-surface p-3.5">
                <p className="text-sm font-semibold">Últimas alertas</p>
                {alertas.length === 0 ? (
                  <p className="mt-1.5 text-xs text-muted">Sin alertas.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {alertas.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate">{a.tipo}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <SeverityChip level={a.severidad} />
                          <span className="font-mono text-muted">{formatDateTime(a.en)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <ClockIcon className="size-3.5" /> Las alertas llegan por correo y al panel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-2 bg-surface/60 px-4 py-2 text-xs text-muted">
        <SimTag>Vista simulada</SimTag>
        Armada con los datos que el CRM enviaría al GPSTracker. Usuario en la plataforma:
        <Pill tone={cuenta?.estadoUsuario === "activo" ? "ok" : cuenta?.estadoUsuario === "bloqueado" ? "danger" : "amber"}>
          {cuenta ? { activo: "Activo", pendiente: "Pendiente (invitación enviada)", bloqueado: "Bloqueado" }[cuenta.estadoUsuario] : "Sin cuenta"}
        </Pill>
      </p>
    </div>
  );
}

/** Mapa estilizado: no se muestran posiciones inventadas como si fueran reales. */
function MapPlaceholder({ count }: { count: number }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-deep">
      <svg className="absolute inset-0 size-full text-on-deep-muted/25" aria-hidden="true">
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <path d="M-10 120 C 80 90, 140 150, 260 100 S 420 60, 520 110" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-lg bg-bg/80 px-3 py-1.5 text-xs font-medium text-ink">
          Mapa en vivo de GPSTracker · {count} vehículo{count > 1 ? "s" : ""}
        </span>
      </span>
    </div>
  );
}
