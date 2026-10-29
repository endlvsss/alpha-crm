"use client";

import Link from "next/link";
import { useQuery } from "@/services";
import { URL_SITIO } from "@/services/eventos";
import { formatDateTime } from "@/lib/format";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { Card, DemoTag, Empty, Mono, Pill, Table } from "@/components/ui/kit";
import { Skeleton } from "@/components/ui/skeleton";

/** Bandeja de eventos recibidos del sitio y del portal del técnico. */
export function Bandeja() {
  const { data } = useQuery("bandeja", (s) => s.integration.inbox());
  return (
    <Card
      title={<span className="flex items-center gap-2">Bandeja de entrada <DemoTag /></span>}
      padded={false}
      action={
        <span className="flex flex-wrap gap-2">
          <a href={URL_SITIO} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Sitio <ArrowUpRightIcon className="size-3.5" /></a>
          <a href={`${URL_SITIO}/instalador`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Portal del técnico <ArrowUpRightIcon className="size-3.5" /></a>
        </span>
      }
    >
      <p className="px-5 pb-3 text-sm text-muted">
        Compra en el sitio → «Enviar al CRM» en el panel Demo interna. Cierre en el portal → «Enviar resultado al CRM». Desde una instalación del CRM → «Enviar al portal del técnico».
      </p>
      {!data ? (
        <div className="px-5 pb-4"><Skeleton className="h-16" /></div>
      ) : data.length === 0 ? (
        <div className="px-5 pb-4"><Empty>Todavía no llegan eventos en esta demo.</Empty></div>
      ) : (
        <Table head={["Recibido", "Origen", "Evento", "Resumen", ""]} minWidth={720}>
          {data.map((e) => (
            <tr key={e.id}>
              <td className="font-mono text-xs text-muted">{formatDateTime(e.recibidoEn)}</td>
              <td><Pill tone={e.origen === "sitio" ? "brand" : "accent"}>{e.origen === "sitio" ? "Sitio" : "Portal del técnico"}</Pill></td>
              <td><Mono>{e.tipo}</Mono></td>
              <td>{e.resumen}</td>
              <td className="text-right">{e.clienteId && <Link href={`/clientes/${e.clienteId}`} className="btn btn-ghost btn-sm">Ficha</Link>}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
