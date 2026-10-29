import type { Metadata } from "next";
import { VisitaView } from "@/features/operaciones/visita-view";

export async function generateMetadata({ params }: PageProps<"/visitas/[id]">): Promise<Metadata> {
  return { title: `Instalación ${(await params).id}` };
}

export default async function VisitaPage({ params }: PageProps<"/visitas/[id]">) {
  return <VisitaView folio={(await params).id} />;
}
