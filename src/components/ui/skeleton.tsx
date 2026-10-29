// Esqueletos de carga: misma silueta que el contenido final, sin saltos de layout.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${count >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-surface p-5">
      <Skeleton className="h-3 w-1/3" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="hidden h-3.5 w-24 sm:block" />
            <Skeleton className="hidden h-3.5 w-16 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Página en carga: encabezado, indicadores y tabla. */
export function PageSkeleton({ kpis = 4, label = "Cargando datos de la demo" }: { kpis?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <div className="mb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-7 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
      </div>
      {kpis > 0 && <KpiSkeleton count={kpis} />}
      <div className="mt-3">
        <TableSkeleton />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
