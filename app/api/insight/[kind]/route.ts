import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { getWeeks } from '@/lib/plan';
import { loadRuleInput } from '@/lib/data';
import { buildFacts } from '@/lib/facts';
import { askForInsight, insightConfigured, type InsightKind } from '@/lib/insight';
import { evaluate } from '@/lib/rules';
import { cronAuthorized } from '@/lib/cron';
import { addDays, today as todayIn, weekStart, type IsoDate } from '@/lib/date';

const KINDS = new Set<InsightKind>(['daily', 'weekly', 'longrun', 'debrief']);

/** Vier momenten, vier periodes. De dagelijkse gaat over vandaag, de rest over
 *  het blok waar hij bij hoort. */
function period(kind: InsightKind, today: IsoDate): { start: IsoDate; end: IsoDate } {
  if (kind === 'weekly') return { start: weekStart(today), end: addDays(weekStart(today), 6) };
  if (kind === 'debrief') return { start: addDays(today, -27), end: today };
  if (kind === 'longrun') return { start: today, end: addDays(today, 2) };
  return { start: today, end: today };
}

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (!KINDS.has(kind as InsightKind)) {
    return NextResponse.json({ error: `Onbekende analyse "${kind}".` }, { status: 404 });
  }
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Niet toegestaan.' }, { status: 401 });
  }
  if (!insightConfigured()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt.' }, { status: 503 });
  }

  const sb = admin();
  const { data: athlete } = await sb.from('athlete').select('id').limit(1).maybeSingle();
  if (!athlete) return NextResponse.json({ error: 'Nog geen atleet in de database.' }, { status: 409 });

  const now = todayIn();
  const weeks = await getWeeks();
  const current = weeks.find((w) => w.start_date <= now && addDays(w.start_date, 6) >= now) ?? weeks[0]!;

  const ruleInput = await loadRuleInput(now, current.week, current.status);
  const hits = ruleInput ? evaluate(ruleInput) : [];
  const facts = await buildFacts(kind, now, ruleInput);

  let answer;
  try {
    answer = await askForInsight(kind as InsightKind, facts, hits);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }

  const { start, end } = period(kind as InsightKind, now);
  const { data, error } = await sb
    .from('insight')
    .upsert(
      {
        athlete_id: athlete.id,
        kind,
        period_start: start,
        period_end: end,
        body_md: answer.body_md,
        findings: answer.findings,
        proposals: answer.proposals,
        rule_hits: hits.map((h) => h.id),
        status: 'new',
      },
      { onConflict: 'athlete_id,kind,period_start,period_end' },
    )
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, rule_hits: hits.map((h) => h.id), proposals: answer.proposals.length });
}

/** Vercel Cron doet een GET. Zelfde werk, zelfde controle. */
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  return POST(request, context);
}
