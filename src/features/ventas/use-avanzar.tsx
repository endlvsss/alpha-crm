"use client";

import { useState } from "react";
import { useAction, useDemo } from "@/services";
import { AVANCE, ETAPA, etapaSiguiente, type Etapa } from "@/lib/domain/pipeline";
import { PlanModal } from "./plan-modal";
import { ReservaModal } from "@/features/operaciones/reserva-modal";
import { useToast } from "@/components/ui/toast";

interface Caso {
  id: string;
  nombre: string;
  etapa: Etapa;
  vehiculos: number;
}

/**
 * Avanza un caso a la etapa siguiente ejecutando el evento del sistema que
 * corresponde. Si el paso necesita datos (plan o reserva), abre el diálogo.
 */
export function useAvanzar() {
  const { services } = useDemo();
  const { exec, pending } = useAction();
  const toast = useToast();
  const [plan, setPlan] = useState<Caso | null>(null);
  const [reserva, setReserva] = useState<{ folio: string } | null>(null);

  async function avanzar(caso: Caso) {
    if (caso.etapa === "activo") return;
    const paso = AVANCE[caso.etapa];
    const destino = etapaSiguiente(caso.etapa)!;
    if (paso.requiere === "plan") {
      setPlan(caso);
      return;
    }
    if (paso.requiere === "reserva") {
      const v = (await services.installers.appointments()).find((x) => x.clienteId === caso.id && ["por_agendar", "lista_espera", "requiere_persona", "tecnico_no_disponible"].includes(x.estado));
      if (!v) {
        toast.show({ tone: "danger", title: "No hay visita por agendar" });
        return;
      }
      setReserva({ folio: v.folio });
      return;
    }
    await exec((s) => s.pipeline.advance(caso.id), `${caso.nombre.split(" ")[0]} → ${ETAPA[destino].label}`);
  }

  const dialogs = (
    <>
      {plan && (
        <PlanModal
          key={plan.id}
          open
          cliente={plan.nombre}
          vehiculos={plan.vehiculos}
          pending={pending}
          onClose={() => setPlan(null)}
          onConfirm={async (planId, billing) => {
            const r = await exec((s) => s.pipeline.advance(plan.id, { planId, billing }), `${plan.nombre.split(" ")[0]} → Checkout iniciado`);
            if (r.ok) setPlan(null);
          }}
        />
      )}
      {reserva && <ReservaModal key={reserva.folio} open folio={reserva.folio} onClose={() => setReserva(null)} />}
    </>
  );

  return { avanzar, dialogs, pending };
}
