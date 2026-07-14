/**
 * Skeleton tijdens navigatie: Next prefetcht deze boundary voor dynamische
 * routes, waardoor een tab-switch direct visueel reageert.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-6 w-36 rounded-lg bg-card" />
      <div className="h-40 rounded-2xl border border-line bg-card/60" />
      <div className="h-24 rounded-2xl border border-line bg-card/60" />
      <div className="h-24 rounded-2xl border border-line bg-card/60" />
      <span className="sr-only">Laden…</span>
    </div>
  );
}
