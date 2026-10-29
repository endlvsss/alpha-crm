import type { Metadata } from "next";
import { TecnicoView } from "@/features/operaciones/tecnicos-view";

export const metadata: Metadata = { title: "Ficha del técnico" };

export default async function TecnicoPage({ params }: PageProps<"/tecnicos/[id]">) {
  return <TecnicoView id={(await params).id} />;
}
