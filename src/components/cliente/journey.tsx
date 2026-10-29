import type { ClienteDetalle } from "@/services/mock/queries";
import { formatDateTime } from "@/lib/format";
import { CheckIcon } from "@/components/ui/icons";

/** Línea de vida del cliente según el blueprint: estados principales y eventos con fecha. */
export function Journey({ data }: { data: ClienteDetalle }) {
  const { cliente, ordenes, visitas, eventos } = data;
  const fecha = (tipo: string) => eventos.find((e) => e.tipo === tipo)?.en ?? null;
  const pagada = ordenes.find((o) => o.pagadaEn);
  const agendada = visitas.find((v) => v.tipo === "instalacion" && v.fecha && v.estado !== "cancelada");
  const terminal = cliente.estado === "SUSPENDIDO" || cliente.estado === "CANCELADO";

  const steps: { label: string; at: string | null; note?: string }[] = [
    { label: "LEAD", at: cliente.creadoEn },
    { label: "PAGADO", at: pagada?.pagadaEn ?? null },
    { label: "CUENTA CREADA", at: cliente.cuentaCreadaEn, note: "evento" },
    { label: "INSTALACIÓN AGENDADA", at: agendada ? fecha("INSTALACIÓN AGENDADA") ?? agendada.creadaEn : null },
    { label: "INSTALADO", at: cliente.instaladoEn, note: "evento" },
    { label: "ACTIVO", at: cliente.activadoEn },
  ];
  if (terminal) steps.push({ label: cliente.estado, at: fecha(cliente.estado) ?? fecha("SUSPENDIDO") });

  const current = steps.findLastIndex((s) => s.at);

  return (
    <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {steps.map((s, i) => {
        const done = Boolean(s.at);
        const isTerminal = terminal && i === steps.length - 1;
        return (
          <li
            key={s.label}
            aria-current={i === current ? "step" : undefined}
            className={`rounded-xl p-3 ${
              isTerminal ? "bg-danger-soft" : i === current ? "bg-accent-soft" : done ? "bg-bg-sunken/60" : "bg-transparent outline-1 outline-line outline-dashed"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-flex size-4 items-center justify-center rounded-full ${
                  done ? (isTerminal ? "bg-danger text-bg" : "bg-ok text-bg") : "bg-line"
                }`}
              >
                {done && <CheckIcon className="size-3" strokeWidth={3} />}
              </span>
              <span className={`font-mono text-[0.75rem] font-medium tracking-wide uppercase ${done ? "text-ink" : "text-muted"}`}>
                {s.label}
              </span>
            </span>
            <span className="mt-1 block text-xs text-muted">
              {s.at ? formatDateTime(s.at) : "Pendiente"}
              {s.note && ` · ${s.note}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
