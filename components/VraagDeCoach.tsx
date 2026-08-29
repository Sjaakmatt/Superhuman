'use client';

/** Opent de coachwidget met de vraag al ingevuld. De widget luistert; deze knop
 *  weet verder niets van het gesprek. */
export default function VraagDeCoach({ vraag, children }: { vraag: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('coach:vraag', { detail: vraag }))}
      className="interactive mt-4 inline-flex rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] font-semibold"
      style={{ background: 'var(--acc)', color: 'var(--acc-ink)' }}
    >
      {children}
    </button>
  );
}
