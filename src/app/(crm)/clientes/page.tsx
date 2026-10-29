import type { Metadata } from "next";
import { ESTADOS_CLIENTE, type EstadoCliente } from "@/lib/domain/types";
import { ClientesView } from "@/features/clientes/clientes-view";

export const metadata: Metadata = { title: "Clientes" };

function isEstado(v: unknown): v is EstadoCliente {
  return typeof v === "string" && (ESTADOS_CLIENTE as readonly string[]).includes(v);
}

export default async function ClientesPage({ searchParams }: PageProps<"/clientes">) {
  const sp = await searchParams;
  return <ClientesView estado={isEstado(sp.estado) ? sp.estado : undefined} q={typeof sp.q === "string" ? sp.q : undefined} />;
}
