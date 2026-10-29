"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/services";
import { BLOQUES } from "@/data/seed";
import { comunasRM } from "@/lib/comunas";
import { computeDv, formatRut, isValidRut } from "@/lib/rut";
import { Modal } from "@/components/ui/overlay";
import { CheckRow, Field } from "@/components/ui/form";
import { DemoTag } from "@/components/ui/kit";
import { BoltIcon } from "@/components/ui/icons";

export const DIAS: [number, string][] = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mié"],
  [4, "Jue"],
  [5, "Vie"],
  [6, "Sáb"],
];

const ESPECIALIDADES = ["Autos particulares", "Camionetas", "Camiones livianos", "Eléctrica automotriz", "Alarmas", "Audio y accesorios"];

/** Grilla de disponibilidad semanal: un botón por día y bloque. */
export function DisponibilidadEditor({ value, onChange, disabled = false }: { value: Record<number, string[]>; onChange: (v: Record<number, string[]>) => void; disabled?: boolean }) {
  const toggle = (d: number, b: string) => {
    const actual = value[d] ?? [];
    onChange({ ...value, [d]: actual.includes(b) ? actual.filter((x) => x !== b) : [...actual, b].sort() });
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sr-only">Bloque</th>
            {DIAS.map(([d, l]) => (
              <th key={d} scope="col" className="text-xs font-medium text-muted">
                <button type="button" disabled={disabled} className="rounded px-1 hover:text-ink" onClick={() => onChange({ ...value, [d]: (value[d]?.length ?? 0) === BLOQUES.length ? [] : [...BLOQUES] })}>
                  {l}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOQUES.map((b) => (
            <tr key={b}>
              <th scope="row" className="pr-2 text-left font-mono text-xs font-normal text-muted">{b}</th>
              {DIAS.map(([d, l]) => {
                const on = value[d]?.includes(b) ?? false;
                return (
                  <td key={d}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${l} ${b}`}
                      disabled={disabled}
                      onClick={() => toggle(d, b)}
                      className={`h-8 w-full rounded-lg text-xs font-medium transition-colors ${on ? "bg-ok-soft text-ok" : "bg-bg-sunken/60 text-muted hover:bg-bg-sunken"} disabled:cursor-default`}
                    >
                      {on ? "Sí" : "—"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Selector de comunas de cobertura con búsqueda. */
export function ComunasPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = comunasRM.filter((c) => !q || norm(c).includes(norm(q)));
  return (
    <div className="rounded-xl border border-line p-2">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="buscar-comuna" className="sr-only">Buscar comuna</label>
        <input id="buscar-comuna" className="field h-9" placeholder="Buscar comuna…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="shrink-0 font-mono text-xs text-muted">{value.length} elegidas</span>
      </div>
      <ul className="grid max-h-44 grid-cols-2 gap-0.5 overflow-y-auto sm:grid-cols-3">
        {lista.map((c) => {
          const on = value.includes(c);
          return (
            <li key={c}>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${on ? "bg-accent-soft text-accent-ink" : "hover:bg-ink/[0.04]"}`}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])} className="accent-[var(--accent)]" />
                <span className="truncate">{c}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SEMANA_BASE: Record<number, string[]> = { 1: ["09:00", "11:00"], 2: ["09:00", "11:00"], 3: ["09:00", "11:00"], 4: ["09:00", "11:00"], 5: ["09:00", "11:00"] };

/** Postulación de un técnico freelance (reclutamiento). Queda «Postulante» hasta validar documentos. */
export function RegistroTecnicoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const vacio = { nombre: "", rut: "", email: "", telefono: "", experiencia: "2", especialidades: ["Autos particulares"], comunas: [] as string[], disponibilidad: SEMANA_BASE };
  const [f, setF] = useState(vacio);
  const [intentado, setIntentado] = useState(false);
  const e = {
    nombre: f.nombre.trim().split(/\s+/).length < 2 ? "Escribe nombre y apellido" : null,
    rut: !isValidRut(f.rut) ? "RUT no válido" : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email) ? "Correo no válido" : null,
    telefono: !/^(\+?56)?9\d{8}$/.test(f.telefono.replace(/\s/g, "")) ? "Usa +56 9 XXXX XXXX" : null,
    comunas: f.comunas.length === 0 ? "Elige al menos una comuna" : null,
  };

  function cerrar() {
    setF(vacio);
    setIntentado(false);
    onClose();
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setIntentado(true);
    if (Object.values(e).some(Boolean)) return;
    const r = await exec(
      (s) =>
        s.installers.apply({
          nombre: f.nombre,
          rut: formatRut(f.rut),
          email: f.email,
          telefono: f.telefono,
          comunas: f.comunas,
          experienciaAnios: Number(f.experiencia) || 0,
          especialidades: f.especialidades,
          disponibilidad: f.disponibilidad,
        }),
      "Postulación registrada",
    );
    if (r.ok) {
      cerrar();
      router.push(`/tecnicos/${r.data.id}`);
    }
  }

  function ficticio() {
    const body = String(15_000_000 + Math.floor(Math.random() * 6_000_000));
    setF({
      ...vacio,
      nombre: ["Gabriel Pino Muñoz", "Antonella Vera Saavedra", "Cristian Lagos Peña"][Math.floor(Math.random() * 3)],
      rut: formatRut(body + computeDv(body)),
      email: `tecnico${Math.floor(Math.random() * 900 + 100)}@demo.alphalink.cl`,
      telefono: `+56 9 ${6000 + Math.floor(Math.random() * 3999)} ${1000 + Math.floor(Math.random() * 8999)}`,
      experiencia: String(1 + Math.floor(Math.random() * 8)),
      comunas: ["Maipú", "Cerrillos", "Estación Central"],
    });
    setIntentado(false);
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      width="max-w-2xl"
      title={<span className="flex items-center gap-2">Registrar técnico <DemoTag>Ficticio</DemoTag></span>}
      description="Postulación de un técnico freelance. Queda como postulante hasta que Operaciones apruebe sus documentos. No se crea ningún usuario real."
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={ficticio}><BoltIcon className="size-4" /> Datos ficticios</button>
          <button type="button" className="btn btn-secondary" onClick={cerrar}>Cancelar</button>
          <button type="submit" form="registro-tecnico" className="btn btn-primary" disabled={pending}>Registrar postulación</button>
        </>
      }
    >
      <form id="registro-tecnico" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre y apellido" required error={intentado ? e.nombre : null} className="sm:col-span-2">
            <input className="field" value={f.nombre} onChange={(x) => setF({ ...f, nombre: x.target.value })} />
          </Field>
          <Field label="RUT" required error={intentado ? e.rut : null}>
            <input className="field font-mono" value={f.rut} onChange={(x) => setF({ ...f, rut: formatRut(x.target.value) })} />
          </Field>
          <Field label="Teléfono" required error={intentado ? e.telefono : null}>
            <input className="field" inputMode="tel" value={f.telefono} onChange={(x) => setF({ ...f, telefono: x.target.value })} />
          </Field>
          <Field label="Correo" required error={intentado ? e.email : null}>
            <input className="field" type="email" value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} />
          </Field>
          <Field label="Años de experiencia">
            <input className="field" inputMode="numeric" value={f.experiencia} onChange={(x) => setF({ ...f, experiencia: x.target.value.replace(/\D/g, "").slice(0, 2) })} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Experiencia en</legend>
          <div className="grid gap-0.5 sm:grid-cols-3">
            {ESPECIALIDADES.map((x) => (
              <CheckRow key={x} checked={f.especialidades.includes(x)} onChange={(on) => setF({ ...f, especialidades: on ? [...f.especialidades, x] : f.especialidades.filter((y) => y !== x) })}>
                {x}
              </CheckRow>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Comunas de cobertura <span className="text-danger">*</span></legend>
          <ComunasPicker value={f.comunas} onChange={(comunas) => setF({ ...f, comunas })} />
          {intentado && e.comunas && <p className="mt-1 text-xs font-medium text-danger">{e.comunas}</p>}
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Disponibilidad semanal declarada</legend>
          <DisponibilidadEditor value={f.disponibilidad} onChange={(disponibilidad) => setF({ ...f, disponibilidad })} />
        </fieldset>
      </form>
    </Modal>
  );
}
