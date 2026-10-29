"use client";

import { useState, type FormEvent } from "react";
import { useAction, useQuery } from "@/services";
import type { Cliente, Nivel, OrigenTicket, Vehiculo } from "@/lib/domain/types";
import { comunasRM } from "@/lib/comunas";
import { ORIGEN_TICKET } from "@/lib/domain/labels";
import { Modal } from "@/components/ui/overlay";
import { CheckRow, Field, Segmented } from "@/components/ui/form";
import { DemoTag } from "@/components/ui/kit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL = /^(\+?56)?9\d{8}$/;

/** Edición simulada de los datos de contacto. Valida antes de guardar. */
export function EditarClienteModal({ cliente, open, onClose }: { cliente: Cliente; open: boolean; onClose: () => void }) {
  const { exec, pending } = useAction();
  const { data: equipo } = useQuery("team", (s) => s.customers.team());
  const [f, setF] = useState({
    nombre: cliente.nombre,
    email: cliente.email,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    comuna: cliente.comuna,
    responsableId: cliente.responsableId,
    consentimientoMarketing: cliente.consentimientoMarketing,
  });
  const [intentado, setIntentado] = useState(false);
  const errores = {
    nombre: f.nombre.trim().length < 3 ? "El nombre es muy corto" : null,
    email: !EMAIL.test(f.email.trim()) ? "Correo no válido" : null,
    telefono: !TEL.test(f.telefono.replace(/\s/g, "")) ? "Usa +56 9 XXXX XXXX" : null,
  };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (Object.values(errores).some(Boolean)) return;
    const r = await exec((s) => s.customers.update(cliente.id, f), "Datos actualizados (demo)");
    if (r.ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-2">Editar datos <DemoTag /></span>}
      description="El RUT identifica al cliente y no se edita. Los cambios quedan en la bitácora."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="editar-cliente" className="btn btn-primary" disabled={pending}>Guardar cambios</button>
        </>
      }
    >
      <form id="editar-cliente" onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" required error={intentado ? errores.nombre : null} className="sm:col-span-2">
          <input className="field" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </Field>
        <Field label="Correo" required error={intentado ? errores.email : null}>
          <input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Teléfono" required error={intentado ? errores.telefono : null}>
          <input className="field" inputMode="tel" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </Field>
        <Field label="Dirección">
          <input className="field" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </Field>
        <Field label="Comuna" hint={cliente.estado !== "LEAD" ? "Cambiar la comuna no mueve visitas ya agendadas." : undefined}>
          <select className="field" value={f.comuna} onChange={(e) => set("comuna", e.target.value)}>
            {comunasRM.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Responsable" className="sm:col-span-2">
          <select className="field" value={f.responsableId} onChange={(e) => set("responsableId", e.target.value)}>
            {(equipo ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.rol}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <CheckRow checked={f.consentimientoMarketing} onChange={(v) => set("consentimientoMarketing", v)}>
            Consentimiento para comunicaciones comerciales (Ley 19.628 / 21.719)
          </CheckRow>
        </div>
      </form>
    </Modal>
  );
}

export function AgregarVehiculoModal({ clienteId, open, onClose }: { clienteId: string; open: boolean; onClose: () => void }) {
  const { exec, pending } = useAction();
  const [f, setF] = useState({ patente: "", marca: "", modelo: "", anio: "", color: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await exec(
      (s) => s.customers.addVehicle(clienteId, { ...f, anio: Number(f.anio) }),
      `Vehículo ${f.patente.toUpperCase()} agregado`,
    );
    if (r.ok) {
      setF({ patente: "", marca: "", modelo: "", anio: "", color: "" });
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar vehículo"
      description="Antes del pago. Un segundo vehículo después de pagar es un flujo aparte (POR DEFINIR)."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="agregar-vehiculo" className="btn btn-primary" disabled={pending}>Agregar</button>
        </>
      }
    >
      <form id="agregar-vehiculo" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Patente" required hint="Ej. BKRT45">
          <input className="field font-mono uppercase" value={f.patente} maxLength={7} onChange={(e) => set("patente", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Año" required>
          <input className="field" inputMode="numeric" value={f.anio} onChange={(e) => set("anio", e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
        <Field label="Marca" required>
          <input className="field" value={f.marca} onChange={(e) => set("marca", e.target.value)} />
        </Field>
        <Field label="Modelo" required>
          <input className="field" value={f.modelo} onChange={(e) => set("modelo", e.target.value)} />
        </Field>
        <Field label="Color" className="sm:col-span-2">
          <input className="field" value={f.color} onChange={(e) => set("color", e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

const ORIGENES_MANUALES: OrigenTicket[] = ["gps_offline", "desacople", "instalacion", "cancelacion", "traslado", "bot"];

/** Nuevo ticket ligado a un cliente. Pensado como espejo del Service Desk (sin backend propio). */
export function TicketModal({
  open,
  onClose,
  clienteId,
  vehiculos,
}: {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  vehiculos: Vehiculo[];
}) {
  const { exec, pending } = useAction();
  const { data: equipo } = useQuery("team", (s) => s.customers.team());
  const [f, setF] = useState<{ asunto: string; detalle: string; nivel: Nivel; origen: OrigenTicket; vehiculoId: string; responsableId: string }>({
    asunto: "",
    detalle: "",
    nivel: "ATENCIÓN",
    origen: "gps_offline",
    vehiculoId: vehiculos[0]?.id ?? "",
    responsableId: "usr-4",
  });
  const [intentado, setIntentado] = useState(false);
  const error = f.asunto.trim().length < 4 ? "Escribe el asunto (mínimo 4 caracteres)" : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (error) return;
    const r = await exec(
      (s) =>
        s.support.create({
          customerId: clienteId,
          vehicleId: f.vehiculoId || null,
          subject: f.asunto,
          detail: f.detalle,
          level: f.nivel,
          origin: f.origen,
          assigneeId: f.responsableId || null,
        }),
      (d) => `Ticket ${d.folio} creado`,
    );
    if (r.ok) {
      setF((x) => ({ ...x, asunto: "", detalle: "" }));
      setIntentado(false);
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<span className="flex items-center gap-2">Abrir ticket <DemoTag /></span>}
      description="Queda en el CRM como espejo del Service Desk. No se notifica a nadie."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="nuevo-ticket" className="btn btn-primary" disabled={pending}>Crear ticket</button>
        </>
      }
    >
      <form id="nuevo-ticket" onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field label="Asunto" required error={intentado ? error : null} className="sm:col-span-2">
          <input className="field" value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} />
        </Field>
        <Field label="Detalle" className="sm:col-span-2">
          <textarea className="field" value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-ink-soft">Prioridad</span>
          <Segmented
            label="Prioridad"
            value={f.nivel}
            onChange={(nivel) => setF({ ...f, nivel })}
            options={[
              { value: "INFO", label: "Info" },
              { value: "ATENCIÓN", label: "Atención" },
              { value: "URGENTE", label: "Urgente" },
            ]}
          />
        </div>
        <Field label="Origen">
          <select className="field" value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value as OrigenTicket })}>
            {ORIGENES_MANUALES.map((o) => <option key={o} value={o}>{ORIGEN_TICKET[o]}</option>)}
          </select>
        </Field>
        <Field label="Vehículo">
          <select className="field" value={f.vehiculoId} onChange={(e) => setF({ ...f, vehiculoId: e.target.value })}>
            <option value="">Sin vehículo</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.patente} · {v.marca} {v.modelo}</option>)}
          </select>
        </Field>
        <Field label="Responsable" className="sm:col-span-2">
          <select className="field" value={f.responsableId} onChange={(e) => setF({ ...f, responsableId: e.target.value })}>
            <option value="">Sin asignar</option>
            {(equipo ?? []).map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.rol}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
