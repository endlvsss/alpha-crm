import type { Metadata } from "next";
import Link from "next/link";
import { tableroVentas } from "@/data";
import { getPlan } from "@/lib/plans";
import { ESTADO_CLIENTE_AYUDA, ESTADO_CLIENTE_TONE, ORIGEN_LABEL } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { Dot, PageHeader, Patente } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Tablero de ventas" };

export default async function VentasPage() {
  const columnas = await tableroVentas();
  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Tablero"
        description="Los 6 estados principales del blueprint. Solo el sistema mueve a un cliente de columna, a partir de pagos, visitas y cobros: no se arrastra a mano."
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
        <div className="grid min-w-[84rem] grid-cols-6 gap-3">
          {columnas.map(({ estado, clientes }) => (
            <section key={estado} aria-labelledby={`col-${estado}`} className="flex flex-col rounded-2xl bg-bg-sunken/60 p-2">
              <header className="px-2 pt-1.5 pb-2.5">
                <h2 id={`col-${estado}`} className="flex items-center gap-2 text-sm font-semibold">
                  <Dot tone={ESTADO_CLIENTE_TONE[estado]} />
                  {estado}
                  <span className="ml-auto font-mono text-xs text-muted">{clientes.length}</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">{ESTADO_CLIENTE_AYUDA[estado]}</p>
              </header>
              <ul className="flex flex-col gap-2">
                {clientes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="block rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2">
                      <p className="truncate text-sm font-semibold">{c.nombre}</p>
                      {c.subestado && (
                        <p className="mt-0.5 font-mono text-[0.75rem] font-medium tracking-wide text-accent-ink uppercase">{c.subestado}</p>
                      )}
                      {(c.vehiculos[0] || c.orden) && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {c.vehiculos[0] && <Patente>{c.vehiculos[0].patente}</Patente>}
                          {c.orden && <span>{getPlan(c.orden.planId).name}</span>}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-muted">
                        {c.comuna} · {ORIGEN_LABEL[c.origen]}
                      </p>
                      <p className="font-mono text-xs text-muted">{formatDateTime(c.creadoEn)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
