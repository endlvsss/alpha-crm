export type Severity = "critica" | "alta" | "media" | "baja";

const severityStyles: Record<Severity, { label: string; className: string }> = {
  critica: { label: "Crítica", className: "bg-danger text-white dark:text-bg" },
  alta: { label: "Alta", className: "bg-danger-soft text-danger" },
  media: { label: "Media", className: "bg-amber-soft text-amber" },
  baja: { label: "Baja", className: "bg-ink/[0.07] text-ink-soft" },
};

export function SeverityChip({ level }: { level: Severity }) {
  const s = severityStyles[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}
