// Las 52 comunas de la Región Metropolitana.
// La disponibilidad de técnicos por comuna es FICTICIA (demo de agenda)
// hasta que exista el módulo de instaladores en el CRM.

export type CoverageTier = "alta" | "media" | "baja" | "sin_tecnicos";

const tiers: Record<CoverageTier, string[]> = {
  alta: [
    "Santiago",
    "Providencia",
    "Ñuñoa",
    "Las Condes",
    "Vitacura",
    "La Reina",
    "Macul",
    "San Miguel",
    "Estación Central",
    "Maipú",
    "La Florida",
    "Peñalolén",
    "Puente Alto",
    "Independencia",
    "Recoleta",
    "San Joaquín",
    "Quinta Normal",
  ],
  media: [
    "Cerrillos",
    "Cerro Navia",
    "Conchalí",
    "El Bosque",
    "Huechuraba",
    "La Cisterna",
    "La Granja",
    "La Pintana",
    "Lo Barnechea",
    "Lo Espejo",
    "Lo Prado",
    "Pedro Aguirre Cerda",
    "Pudahuel",
    "Quilicura",
    "Renca",
    "San Ramón",
    "San Bernardo",
    "Colina",
    "Lampa",
    "Buin",
    "Padre Hurtado",
    "Peñaflor",
    "Talagante",
  ],
  baja: [
    "Pirque",
    "San José de Maipo",
    "Calera de Tango",
    "Paine",
    "Isla de Maipo",
    "El Monte",
    "Melipilla",
  ],
  sin_tecnicos: ["Tiltil", "Alhué", "Curacaví", "María Pinto", "San Pedro"],
};

export const comunasRM: string[] = Object.values(tiers)
  .flat()
  .sort((a, b) => a.localeCompare(b, "es"));

/** Comunas donde hoy hay técnicos todas las semanas (cobertura alta o media). */
export const comunasConTecnicos: string[] = [...tiers.alta, ...tiers.media].sort((a, b) => a.localeCompare(b, "es"));

export function coverageTier(comuna: string): CoverageTier {
  for (const [tier, list] of Object.entries(tiers) as [CoverageTier, string[]][]) {
    if (list.includes(comuna)) return tier;
  }
  return "sin_tecnicos";
}
