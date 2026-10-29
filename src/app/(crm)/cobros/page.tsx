import type { Metadata } from "next";
import { CobrosView } from "@/features/postventa/cobros-view";

export const metadata: Metadata = { title: "Suscripciones" };

export default async function CobrosPage({ searchParams }: PageProps<"/cobros">) {
  const sp = await searchParams;
  return <CobrosView tab={typeof sp.tab === "string" ? sp.tab : undefined} />;
}
