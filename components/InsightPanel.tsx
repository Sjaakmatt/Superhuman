'use client';

import { useState, useTransition } from 'react';
import { acceptProposal, dismissInsight } from '@/lib/actions';
import { Card, CardTitle, Empty, Pill } from '@/components/ui';
import type { Insight, Proposal } from '@/lib/types';

const KIND: Record<string, string> = {
  daily: 'Dagelijks',
  weekly: 'Weekanalyse',
  longrun: 'Longrun-briefing',
  debrief: 'Terugblik',
  alert: 'Signaal',
};

/** De analyses met hun voorstellen. "Overnemen" schrijft naar plan_adjustment
 *  en past plan_day aan; de oude waarde blijft bewaard. */
export default function InsightPanel({ insights, weekStart }: { insights: Insight[]; weekStart: string }) {
  if (!insights.length) {
    return (
      <Card>
        <CardTitle>Analyse</CardTitle>
        <Empty title="Nog geen analyse">
          De weekanalyse draait zondagavond, de dagelijkse om zes uur &apos;s ochtends. Je kunt hem ook nu draaien
          met een verzoek aan <code>/api/insight/weekly</code>.
        </Empty>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} weekStart={weekStart} />
      ))}
    </div>
  );
}

function InsightCard({ insight, weekStart }: { insight: Insight; weekStart: string }) {
  const [status, setStatus] = useState(insight.status);
  const [handled, setHandled] = useState<Record<string, 'bezig' | 'gedaan' | string>>({});
  const [, startTransition] = useTransition();

  function take(proposal: Proposal, index: number) {
    setHandled((h) => ({ ...h, [index]: 'bezig' }));
    startTransition(async () => {
      const res = await acceptProposal(insight.id, proposal);
      setHandled((h) => ({ ...h, [index]: res.ok ? 'gedaan' : res.error }));
      if (res.ok) setStatus('accepted');
    });
  }

  function dismiss() {
    setStatus('dismissed');
    startTransition(() => {
      void dismissInsight(insight.id);
    });
  }

  return (
    <Card style={{ opacity: status === 'dismissed' ? 0.6 : 1 }}>
      <CardTitle aside={<span className="num">{insight.period_start} — {insight.period_end}</span>}>
        {KIND[insight.kind] ?? insight.kind}
        {insight.period_start === weekStart ? ' · deze week' : ''}
      </CardTitle>

      <div className="flex max-w-[68ch] flex-col gap-3 text-[14px] leading-relaxed">
        {insight.body_md.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {insight.rule_hits.length > 0 ? (
        <p className="mt-4 flex flex-wrap gap-1.5">
          {insight.rule_hits.map((id) => (
            <Pill key={id} tone="warn">{id}</Pill>
          ))}
        </p>
      ) : null}

      {insight.findings.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {insight.findings.map((f) => (
            <li key={f.title} className="rounded-[var(--r-tile)] px-4 py-3"
              style={{ background: f.severity === 'warn' ? 'var(--warn-s)' : 'var(--card2)' }}>
              <p className="text-[13px] font-semibold">{f.title}</p>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ink2)' }}>{f.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {insight.proposals.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[.09em]" style={{ color: 'var(--ink3)' }}>
            Voorstellen
          </p>
          <ul className="flex flex-col gap-2">
            {insight.proposals.map((p, i) => {
              const state = handled[i];
              return (
                <li key={`${p.date}-${p.field}`} className="flex flex-wrap items-center gap-3 rounded-[var(--r-tile)] px-4 py-3"
                  style={{ background: 'var(--card2)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">
                      <span className="num">{p.date}</span> · {p.field}: {p.from || '—'} → {p.to}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink2)' }}>{p.reason}</p>
                    {state && state !== 'bezig' && state !== 'gedaan' ? (
                      <p className="mt-1 text-[12px]" style={{ color: 'var(--crit)' }}>{state}</p>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => take(p, i)} disabled={state === 'bezig' || state === 'gedaan'}
                    className="interactive shrink-0 rounded-[var(--r-btn)] px-4 py-2 text-[13px] font-semibold"
                    style={{
                      background: state === 'gedaan' ? 'var(--acc-soft)' : 'var(--acc)',
                      color: state === 'gedaan' ? 'var(--acc)' : 'var(--acc-ink)',
                    }}>
                    {state === 'bezig' ? 'bezig…' : state === 'gedaan' ? 'overgenomen' : 'Overnemen'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {status !== 'dismissed' ? (
        <button type="button" onClick={dismiss} className="mt-4 text-[12px] font-semibold" style={{ color: 'var(--ink3)' }}>
          Weg ermee
        </button>
      ) : (
        <p className="mt-4 text-[12px]" style={{ color: 'var(--ink3)' }}>Weggelegd.</p>
      )}
    </Card>
  );
}
