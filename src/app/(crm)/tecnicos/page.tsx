import type { Metadata } from "next";
import { TecnicosView } from "@/features/operaciones/tecnicos-view";

export const metadata: Metadata = { title: "Técnicos" };

export default async function TecnicosPage({ searchParams }: PageProps<"/tecnicos">) {
  const sp = await searchParams;
  return <TecnicosView filtro={typeof sp.f === "string" ? sp.f : undefined} />;
}
