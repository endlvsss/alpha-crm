import type { Metadata } from "next";
import { PipelineView } from "@/features/ventas/pipeline-view";

export const metadata: Metadata = { title: "Pipeline comercial" };

export default function VentasPage() {
  return <PipelineView />;
}
