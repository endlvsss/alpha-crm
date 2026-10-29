import type { Metadata } from "next";
import { DemoView } from "@/features/demo/demo-view";

export const metadata: Metadata = { title: "Recorrido demo" };

export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  const sp = await searchParams;
  return <DemoView clienteId={typeof sp.cliente === "string" ? sp.cliente : undefined} />;
}
