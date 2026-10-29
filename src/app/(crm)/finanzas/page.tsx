import type { Metadata } from "next";
import { FinanzasView } from "@/features/postventa/finanzas-view";

export const metadata: Metadata = { title: "Finanzas" };

export default function FinanzasPage() {
  return <FinanzasView />;
}
