import type { Metadata } from "next";
import { DispositivosView } from "@/features/operaciones/dispositivos-view";

export const metadata: Metadata = { title: "Dispositivos" };

export default async function DispositivosPage({ searchParams }: PageProps<"/dispositivos">) {
  const sp = await searchParams;
  return <DispositivosView tipo={typeof sp.tipo === "string" ? sp.tipo : undefined} />;
}
