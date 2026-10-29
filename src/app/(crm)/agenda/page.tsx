import type { Metadata } from "next";
import { AgendaView } from "@/features/operaciones/agenda-view";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return <AgendaView />;
}
