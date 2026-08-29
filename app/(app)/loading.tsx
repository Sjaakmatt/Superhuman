/* Zonder dit bestand blijft het vorige scherm staan tot de server klaar is, en
 * voelt elke tabwissel als een hapering. Nu verschijnt de kop meteen en vult
 * de inhoud zich aan. */
export default function Laden() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Bezig met laden</span>
      <Balk h={64} />
      <Balk h={200} />
      <Balk h={140} />
      <Balk h={180} />
    </div>
  );
}

function Balk({ h }: { h: number }) {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-[var(--r-card)]"
      style={{ height: h, background: 'var(--card)', border: '1px solid var(--hair)' }}
    />
  );
}
