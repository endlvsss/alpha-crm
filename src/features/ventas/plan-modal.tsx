"use client";

import { useState } from "react";
import { getPlan, plans, quote, type Billing, type PlanId } from "@/lib/plans";
import { clp } from "@/lib/format";
import { Modal } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/form";
import { DemoTag } from "@/components/ui/kit";
import { CheckIcon } from "@/components/ui/icons";

/**
 * Elegir plan y periodicidad para iniciar el checkout. Montos ILUSTRATIVOS:
 * precios y nombres siguen pendientes de aprobación comercial (Jorge).
 */
export function PlanModal({
  open,
  onClose,
  onConfirm,
  vehiculos,
  pending = false,
  cliente,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (planId: PlanId, billing: Billing) => void;
  vehiculos: number;
  pending?: boolean;
  cliente?: string;
}) {
  const [planId, setPlanId] = useState<PlanId>(vehiculos >= 3 ? "flota" : "seguridad");
  const [billing, setBilling] = useState<Billing>("mensual");
  const plan = getPlan(planId);
  const q = quote(plan, billing, vehiculos);
  const disponible = (id: PlanId) => vehiculos >= getPlan(id).minVehicles && vehiculos <= getPlan(id).maxVehicles;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={<span className="flex items-center gap-2">Iniciar checkout {cliente && <span className="font-normal text-muted">· {cliente}</span>}</span>}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <DemoTag>Precios ilustrativos</DemoTag> Pendientes de aprobación comercial. No se cobra nada.
        </span>
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={pending || !disponible(planId)} onClick={() => onConfirm(planId, billing)}>
            Crear orden · {clp(q.dueToday)}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          label="Periodicidad"
          value={billing}
          onChange={setBilling}
          options={[
            { value: "mensual", label: "Mensual" },
            { value: "anual", label: "Anual · paga 10, usa 12" },
          ]}
        />
      </div>
      <div role="radiogroup" aria-label="Plan" className="grid gap-2 sm:grid-cols-3">
        {plans.map((p) => {
          const ok = disponible(p.id);
          const active = p.id === planId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!ok}
              onClick={() => setPlanId(p.id)}
              className={`flex flex-col rounded-xl p-3.5 text-left transition-colors ${
                active ? "bg-accent-soft ring-2 ring-accent" : "bg-bg-sunken/60 hover:bg-bg-sunken"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="flex items-center justify-between">
                <span className="font-display font-bold">{p.name}</span>
                {active && <CheckIcon className="size-4 text-accent-ink" strokeWidth={2.5} />}
              </span>
              <span className="mt-1 text-xs text-muted">{p.tagline}</span>
              <span className="mt-2 font-mono text-sm tabular-nums">{clp(p.monthly)}/mes</span>
              <span className="text-xs text-muted">+ {clp(p.setup)} equipo e instalación</span>
              {!ok && (
                <span className="mt-1.5 text-xs font-medium text-danger">
                  {vehiculos < p.minVehicles ? `Requiere ${p.minVehicles}+ vehículos` : `Hasta ${p.maxVehicles} vehículo`}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-bg-sunken/60 p-3.5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Vehículos</dt>
          <dd className="font-mono tabular-nums">{q.vehicles}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Equipo + instalación</dt>
          <dd className="font-mono tabular-nums">{clp(q.setupTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{billing === "anual" ? "Primer año" : "Primer mes"}</dt>
          <dd className="font-mono tabular-nums">{clp(q.periodTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Total hoy (con IVA)</dt>
          <dd className="font-mono font-semibold tabular-nums">{clp(q.dueToday)}</dd>
        </div>
      </dl>
    </Modal>
  );
}
