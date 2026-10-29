import type { Metadata } from "next";
import { ClienteView } from "@/features/clientes/cliente-view";

export const metadata: Metadata = { title: "Ficha del cliente" };

export default async function ClientePage({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  return <ClienteView id={id} tab={typeof sp.tab === "string" ? sp.tab : undefined} />;
}
