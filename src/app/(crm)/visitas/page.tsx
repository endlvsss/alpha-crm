import type { Metadata } from "next";
import { VisitasView } from "@/features/operaciones/visitas-view";

export const metadata: Metadata = { title: "Instalaciones" };

export default async function VisitasPage({ searchParams }: PageProps<"/visitas">) {
  const sp = await searchParams;
  return <VisitasView tab={typeof sp.tab === "string" ? sp.tab : undefined} />;
}
