interface PagePlaceholderProps {
  title: string;
  description: string;
  phase: string;
  /** Attribuutkleur voor het accent (CSS-waarde) */
  accent?: string;
  /** h1 als het de paginakop is, h2 als sectie binnen een pagina */
  as?: "h1" | "h2";
}

/** Tijdelijke inhoud voor routes waarvan de feature in een latere fase komt. */
export function PagePlaceholder({
  title,
  description,
  phase,
  accent = "var(--muted)",
  as: Heading = "h1",
}: PagePlaceholderProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Heading className="text-xl font-semibold">{title}</Heading>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="rounded-2xl border border-dashed border-line bg-card/50 p-8 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 block h-2 w-2 rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
        />
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {phase}
        </p>
      </div>
    </section>
  );
}
