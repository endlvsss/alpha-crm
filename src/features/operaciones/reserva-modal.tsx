"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "@/services";
import { BLOQUE_FIN } from "@/data/seed";
import { HORIZONTE_DIAS } from "@/lib/domain/agenda";
import { capitalize, dateParts, formatLongDate, type IsoDate } from "@/lib/format";
import { GRUPO_VISITA, TIPO_VISITA } from "@/lib/domain/labels";
import { Modal } from "@/components/ui/overlay";
import { Avatar, DemoTag, Empty, Patente, Pill } from "@/components/ui/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, MapPinIcon } from "@/components/ui/icons";

/**
 * Reserva de una visita: orden pagada → día → bloque → técnico compatible.
 * Solo se ofrecen bloques con técnico activo, que cubra la comuna, atienda ese
 * día, tenga cupo y no tenga el bloque tomado. El servicio vuelve a validar.
 */
export function ReservaModal({
  open,
  onClose,
  folio: folioInicial,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  folio?: string;
  onDone?: () => void;
}) {
  const { exec, pending } = useAction();
  const [folio, setFolio] = useState<string | null>(folioInicial ?? null);
  const [fecha, setFecha] = useState<IsoDate | null>(null);
  const [bloque, setBloque] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);

  const { data: pendientes } = useQuery("reserva-pendientes", async (s) =>
    (await s.installers.appointments()).filter((v) => v.grupo === "pendiente" || v.estado === "tecnico_no_disponible" || v.estado === "requiere_persona"),
  );
  const { data: detalle } = useQuery(`reserva-visita-${folio}`, (s) => (folio ? s.installers.appointment(folio) : Promise.resolve(null)));
  const { data: slots } = useQuery(`reserva-slots-${folio}`, (s) => (folio ? s.installers.availableSlots(folio) : Promise.resolve([])));

  const dias = useMemo(() => {
    const map = new Map<IsoDate, number>();
    for (const s of slots ?? []) map.set(s.fecha, (map.get(s.fecha) ?? 0) + 1);
    return [...map.entries()];
  }, [slots]);
  const delDia = (slots ?? []).filter((s) => s.fecha === fecha);
  const slot = delDia.find((s) => s.bloque === bloque);

  function cerrar() {
    setFolio(folioInicial ?? null);
    setFecha(null);
    setBloque(null);
    setTecnicoId(null);
    onClose();
  }

  async function confirmar() {
    if (!folio || !fecha || !bloque || !tecnicoId) return;
    const r = await exec((s) => s.installers.book(folio, tecnicoId, fecha, bloque), `Reservado: ${formatLongDate(fecha)} · ${bloque}`);
    if (r.ok) {
      cerrar();
      onDone?.();
    }
  }

  const v = detalle?.visita;
  const paso = !folio ? 1 : !fecha ? 2 : !bloque ? 3 : 4;

  return (
    <Modal
      open={open}
      onClose={cerrar}
      width="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          {v?.fecha ? "Reprogramar visita" : "Reservar instalación"} <DemoTag>Simulado</DemoTag>
        </span>
      }
      description="El cliente y el técnico no reciben avisos en la demo. Bloques de 2 h, cupo diario por técnico y horizonte de 21 días (propuestos)."
      footer={
        <>
          <span className="mr-auto text-xs text-muted">Paso {Math.min(paso, 4)} de 4</span>
          <button type="button" className="btn btn-secondary" onClick={cerrar}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!tecnicoId || pending} onClick={confirmar}>
            Confirmar reserva
          </button>
        </>
      }
    >
      <ol className="flex flex-col gap-5">
        {/* 1 · Orden pagada */}
        <li>
          <Paso n={1} titulo="Cliente y orden pagada" hecho={!!folio} />
          {folio && v ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bg-sunken/60 p-3">
              <span className="min-w-0">
                <span className="block font-medium">{v.cliente.nombre}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Patente>{v.vehiculo.patente}</Patente> {v.vehiculo.marca} {v.vehiculo.modelo} · {TIPO_VISITA[v.tipo]} · {v.folio}
                  {v.ordenFolio && ` · ${v.ordenFolio}`}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                  <MapPinIcon className="size-3.5" /> {v.cliente.direccion}, {v.comuna}
                </span>
              </span>
              {!folioInicial && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFolio(null); setFecha(null); setBloque(null); setTecnicoId(null); }}>
                  Cambiar
                </button>
              )}
            </div>
          ) : folio ? (
            <Skeleton className="mt-2 h-16" />
          ) : !pendientes ? (
            <Skeleton className="mt-2 h-24" />
          ) : pendientes.length === 0 ? (
            <div className="mt-2">
              <Empty>No hay visitas por agendar. Las órdenes de instalación se crean al confirmarse un pago.</Empty>
            </div>
          ) : (
            <ul className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {pendientes.map((p) => (
                <li key={p.folio}>
                  <button type="button" onClick={() => setFolio(p.folio)} className="flex w-full flex-col rounded-xl bg-bg-sunken/60 p-3 text-left transition-colors hover:bg-accent-soft">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{p.cliente.nombre}</span>
                      <Pill tone={GRUPO_VISITA[p.grupo].tone}>{GRUPO_VISITA[p.grupo].label}</Pill>
                    </span>
                    <span className="mt-0.5 text-xs text-muted">
                      {p.comuna} · {p.folio} · {TIPO_VISITA[p.tipo]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>

        {/* 2 · Día */}
        {folio && (
          <li>
            <Paso n={2} titulo="Día" hecho={!!fecha} />
            {!slots ? (
              <Skeleton className="mt-2 h-16" />
            ) : dias.length === 0 ? (
              <div className="mt-2">
                <Empty>
                  Sin técnicos disponibles en {v?.comuna} en los próximos {HORIZONTE_DIAS} días. En producción el cliente entra a la lista de espera y Operaciones recibe el caso.
                </Empty>
              </div>
            ) : (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {dias.map(([d, n]) => {
                  const p = dateParts(d);
                  const active = d === fecha;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setFecha(d); setBloque(null); setTecnicoId(null); }}
                      className={`flex w-16 shrink-0 flex-col items-center rounded-xl py-2 transition-colors ${active ? "bg-ink text-bg" : "bg-bg-sunken/60 hover:bg-bg-sunken"}`}
                    >
                      <span className="text-xs capitalize opacity-80">{p.weekday}</span>
                      <span className="font-display text-lg font-bold">{p.day}</span>
                      <span className="text-[0.7rem] opacity-80">{n} bloque{n > 1 ? "s" : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        )}

        {/* 3 · Bloque */}
        {fecha && (
          <li>
            <Paso n={3} titulo={`Bloque · ${capitalize(formatLongDate(fecha))}`} hecho={!!bloque} />
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {delDia.map((s) => {
                const active = s.bloque === bloque;
                return (
                  <button
                    key={s.bloque}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setBloque(s.bloque); setTecnicoId(s.tecnicos[0]?.id ?? null); }}
                    className={`rounded-xl px-3 py-2.5 text-left transition-colors ${active ? "bg-ink text-bg" : "bg-bg-sunken/60 hover:bg-bg-sunken"}`}
                  >
                    <span className="block font-mono text-sm font-medium">
                      {s.bloque}–{BLOQUE_FIN[s.bloque]}
                    </span>
                    <span className="text-xs opacity-80">
                      {s.tecnicos.length} técnico{s.tecnicos.length > 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </li>
        )}

        {/* 4 · Técnico */}
        {slot && (
          <li>
            <Paso n={4} titulo="Técnico compatible" hecho={!!tecnicoId} />
            <div role="radiogroup" aria-label="Técnico" className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {slot.tecnicos.map((t, i) => {
                const active = t.id === tecnicoId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTecnicoId(t.id)}
                    className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${active ? "bg-accent-soft ring-2 ring-accent" : "bg-bg-sunken/60 hover:bg-bg-sunken"}`}
                  >
                    <Avatar name={t.nombre} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        {t.nombre} {i === 0 && <Pill tone="ok">Menor carga</Pill>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        Cupo {t.cupoDiario}/día · {t.experienciaAnios} años · cubre {v?.comuna}
                      </span>
                    </span>
                    {active && <CheckIcon className="size-4 text-accent-ink" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </li>
        )}
      </ol>
    </Modal>
  );
}

function Paso({ n, titulo, hecho }: { n: number; titulo: string; hecho: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold">
      <span className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${hecho ? "bg-ok text-bg" : "bg-ink/[0.08] text-ink-soft"}`}>
        {hecho ? <CheckIcon className="size-3" strokeWidth={3} /> : n}
      </span>
      {titulo}
    </p>
  );
}
