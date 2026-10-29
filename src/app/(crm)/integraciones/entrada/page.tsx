import type { Metadata } from "next";
import { EntradaView } from "@/features/integraciones/entrada-view";

export const metadata: Metadata = { title: "Evento recibido" };

export default function EntradaPage() {
  return <EntradaView />;
}
