import type { Metadata } from "next";
import { SoporteView } from "@/features/postventa/soporte-view";

export const metadata: Metadata = { title: "Soporte" };

export default async function SoportePage({ searchParams }: PageProps<"/soporte">) {
  const sp = await searchParams;
  return <SoporteView folio={typeof sp.folio === "string" ? sp.folio : undefined} />;
}
