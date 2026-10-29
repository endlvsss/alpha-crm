import type { Metadata } from "next";
import { OrdenesView } from "@/features/ventas/ordenes-view";

export const metadata: Metadata = { title: "Órdenes y pagos" };

export default async function OrdenesPage({ searchParams }: PageProps<"/ordenes">) {
  const sp = await searchParams;
  return <OrdenesView filtro={typeof sp.f === "string" ? sp.f : undefined} />;
}
