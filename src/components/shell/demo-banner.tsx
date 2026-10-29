"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/services";
import { Confirm } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

/** Franja permanente: todo es DEMO, cuántas acciones lleva la sesión y cómo reiniciar. */
export function DemoBanner() {
  const { acciones, aviso, reset, dismissAviso, ready } = useDemo();
  const [confirmar, setConfirmar] = useState(false);
  const toast = useToast();

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-soft px-4 py-1.5 text-xs font-medium text-amber sm:px-8">
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded bg-amber/15 px-1.5 py-px font-mono font-semibold tracking-wider">DEMO</span>
          Datos ficticios. Pagos, activaciones GPS, mensajes y asignaciones son simulados: nada sale del navegador.
        </span>
        {ready && (
          <span className="inline-flex items-center gap-3">
            {acciones > 0 && <span className="font-mono">{acciones} {acciones === 1 ? "acción" : "acciones"} en esta demo</span>}
            <Link href="/demo" className="underline underline-offset-2 hover:no-underline">
              Recorrido guiado
            </Link>
            <button type="button" onClick={() => setConfirmar(true)} className="underline underline-offset-2 hover:no-underline">
              Reiniciar datos
            </button>
          </span>
        )}
      </div>
      {aviso && (
        <div role="status" className="flex items-center justify-center gap-3 bg-accent-soft px-4 py-1.5 text-xs text-accent-ink">
          {aviso}
          <button type="button" onClick={dismissAviso} className="font-semibold underline">
            Entendido
          </button>
        </div>
      )}
      <Confirm
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={() => {
          reset();
          setConfirmar(false);
          toast.show({ tone: "ok", title: "Demo reiniciada", description: "Se cargaron de nuevo los datos semilla de hoy." });
        }}
        title="¿Reiniciar la demo?"
        description="Se borran los leads, pagos, reservas y cambios hechos en esta sesión y vuelven los datos semilla. Solo afecta a este navegador."
        confirmLabel="Reiniciar datos"
        danger
      />
    </>
  );
}
