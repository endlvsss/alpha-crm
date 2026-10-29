"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "@/services";
import { comunasRM, comunasConTecnicos } from "@/lib/comunas";
import { computeDv, formatRut, isValidRut } from "@/lib/rut";
import { ORIGEN_LABEL } from "@/lib/domain/labels";
import type { Origen } from "@/lib/domain/types";
import type { DatosLead } from "@/lib/domain/engine";
import { Modal } from "@/components/ui/overlay";
import { CheckRow, Field } from "@/components/ui/form";
import { DemoTag } from "@/components/ui/kit";
import { BoltIcon } from "@/components/ui/icons";

const ORIGENES = Object.keys(ORIGEN_LABEL) as Origen[];

interface Form {
  nombre: string;
  rut: string;
  email: string;
  telefono: string;
  comuna: string;
  direccion: string;
  origen: Origen;
  responsableId: string;
  consentimiento: boolean;
  conVehiculo: boolean;
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  color: string;
}

const VACIO: Form = {
  nombre: "",
  rut: "",
  email: "",
  telefono: "",
  comuna: "",
  direccion: "",
  origen: "meta",
  responsableId: "usr-1",
  consentimiento: true,
  conVehiculo: true,
  patente: "",
  marca: "",
  modelo: "",
  anio: "",
  color: "",
};

/** Validación en el cliente para guiar; las reglas finales las aplica el servicio. */
function validar(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.nombre.trim().split(/\s+/).length < 2) e.nombre = "Escribe nombre y apellido";
  if (!isValidRut(f.rut)) e.rut = "RUT no válido (revisa el dígito verificador)";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Correo no válido";
  if (!/^(\+?56)?9\d{8}$/.test(f.telefono.replace(/\s/g, ""))) e.telefono = "Usa el formato +56 9 XXXX XXXX";
  if (!f.comuna) e.comuna = "Elige la comuna";
  if (f.conVehiculo) {
    if (!/^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/.test(f.patente.toUpperCase().replace(/[^A-Z0-9]/g, ""))) e.patente = "Ej. BKRT45";
    if (!f.marca.trim()) e.marca = "Falta la marca";
    if (!f.modelo.trim()) e.modelo = "Falta el modelo";
    const y = Number(f.anio);
    if (!(y >= 1990 && y <= new Date().getFullYear() + 1)) e.anio = "Año no válido";
  }
  return e;
}

const NOMBRES = ["Rocío", "Benjamín", "Florencia", "Vicente", "Trinidad", "Agustín", "Emilia", "Maximiliano"];
const APELLIDOS = ["Carrasco", "Olivares", "Cáceres", "Bustos", "Lagos", "Navarro", "Riquelme", "Moya"];
const AUTOS: [string, string][] = [["Toyota", "Corolla Cross"], ["Kia", "Seltos"], ["Hyundai", "Creta"], ["Suzuki", "Vitara"], ["Chevrolet", "Groove"]];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Datos ficticios para mostrar el flujo sin escribir a mano. */
function ficticio(): Form {
  const nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
  const body = String(12_000_000 + Math.floor(Math.random() * 9_000_000));
  const [marca, modelo] = pick(AUTOS);
  const letras = "BCDFGHJKLPRSTVWXYZ";
  const slug = nombre.split(" ").slice(0, 2).join(".").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return {
    ...VACIO,
    nombre,
    rut: formatRut(body + computeDv(body)),
    email: `${slug}@demo.alphalink.cl`,
    telefono: `+56 9 ${5000 + Math.floor(Math.random() * 4999)} ${1000 + Math.floor(Math.random() * 8999)}`,
    comuna: pick(comunasConTecnicos),
    direccion: `Calle Ficticia ${100 + Math.floor(Math.random() * 3000)}`,
    origen: pick(["meta", "google", "tiktok"]),
    patente: Array.from({ length: 4 }, () => pick(letras.split(""))).join("") + String(10 + Math.floor(Math.random() * 89)),
    marca,
    modelo,
    anio: String(2016 + Math.floor(Math.random() * 9)),
    color: pick(["Blanco", "Gris", "Negro", "Rojo"]),
  };
}

export function NuevoLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const { data: equipo } = useQuery("team", (s) => s.customers.team());
  const [f, setF] = useState<Form>(VACIO);
  const [intentado, setIntentado] = useState(false);
  const errores = intentado ? validar(f) : {};
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  function cerrar() {
    setF(VACIO);
    setIntentado(false);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (Object.keys(validar(f)).length) return;
    const datos: DatosLead = {
      nombre: f.nombre,
      rut: formatRut(f.rut),
      email: f.email,
      telefono: f.telefono,
      comuna: f.comuna,
      direccion: f.direccion,
      origen: f.origen,
      responsableId: f.responsableId,
      consentimientoMarketing: f.consentimiento,
      vehiculo: f.conVehiculo ? { patente: f.patente, marca: f.marca, modelo: f.modelo, anio: Number(f.anio), color: f.color } : null,
    };
    const r = await exec((s) => s.customers.create(datos), `Lead creado: ${f.nombre.split(" ")[0]}`);
    if (r.ok) {
      cerrar();
      if (onCreated) onCreated(r.data.id);
      else router.push(`/clientes/${r.data.id}`);
    }
  }

  const sinCobertura = f.comuna && !comunasConTecnicos.includes(f.comuna);

  return (
    <Modal
      open={open}
      onClose={cerrar}
      width="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          Nuevo lead <DemoTag>Ficticio</DemoTag>
        </span>
      }
      description="Ingreso manual (llamada, WhatsApp o referido). Los leads de la landing llegarán solos cuando el sitio esté conectado."
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={() => { setF(ficticio()); setIntentado(false); }}>
            <BoltIcon className="size-4" /> Rellenar con datos ficticios
          </button>
          <button type="button" className="btn btn-secondary" onClick={cerrar}>
            Cancelar
          </button>
          <button type="submit" form="nuevo-lead" className="btn btn-primary" disabled={pending}>
            Crear lead
          </button>
        </>
      }
    >
      <form id="nuevo-lead" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Contacto</legend>
          <Field label="Nombre y apellido" required error={errores.nombre} className="sm:col-span-2">
            <input className="field" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoComplete="off" />
          </Field>
          <Field label="RUT" required error={errores.rut}>
            <input className="field font-mono" inputMode="text" placeholder="12.345.678-5" value={f.rut} onChange={(e) => set("rut", formatRut(e.target.value))} />
          </Field>
          <Field label="Teléfono" required error={errores.telefono}>
            <input className="field" inputMode="tel" placeholder="+56 9 1234 5678" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </Field>
          <Field label="Correo" required error={errores.email} className="sm:col-span-2">
            <input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Comuna" required error={errores.comuna} hint={sinCobertura ? "Sin técnicos en esa comuna: quedará en lista de espera." : undefined}>
            <select className="field" value={f.comuna} onChange={(e) => set("comuna", e.target.value)}>
              <option value="">Elige…</option>
              {comunasRM.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dirección">
            <input className="field" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </Field>
          <Field label="Origen">
            <select className="field" value={f.origen} onChange={(e) => set("origen", e.target.value as Origen)}>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {ORIGEN_LABEL[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable">
            <select className="field" value={f.responsableId} onChange={(e) => set("responsableId", e.target.value)}>
              {(equipo ?? []).filter((u) => u.rol === "ventas" || u.rol === "operaciones").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <CheckRow checked={f.consentimiento} onChange={(v) => set("consentimiento", v)}>
              Aceptó recibir comunicaciones comerciales (Ley 19.628 / 21.719). Sin consentimiento solo recibe avisos operativos.
            </CheckRow>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-6">
          <legend className="mb-1 flex w-full items-center justify-between text-xs font-semibold tracking-wide text-muted uppercase">
            Vehículo
          </legend>
          <div className="sm:col-span-6">
            <CheckRow checked={f.conVehiculo} onChange={(v) => set("conVehiculo", v)}>
              Registrar el vehículo ahora (se necesita para el checkout)
            </CheckRow>
          </div>
          {f.conVehiculo && (
            <>
              <Field label="Patente" required error={errores.patente} className="sm:col-span-2">
                <input className="field font-mono uppercase" value={f.patente} onChange={(e) => set("patente", e.target.value.toUpperCase())} maxLength={7} />
              </Field>
              <Field label="Marca" required error={errores.marca} className="sm:col-span-2">
                <input className="field" value={f.marca} onChange={(e) => set("marca", e.target.value)} />
              </Field>
              <Field label="Modelo" required error={errores.modelo} className="sm:col-span-2">
                <input className="field" value={f.modelo} onChange={(e) => set("modelo", e.target.value)} />
              </Field>
              <Field label="Año" required error={errores.anio} className="sm:col-span-3">
                <input className="field" inputMode="numeric" value={f.anio} onChange={(e) => set("anio", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </Field>
              <Field label="Color" className="sm:col-span-3">
                <input className="field" value={f.color} onChange={(e) => set("color", e.target.value)} />
              </Field>
            </>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
