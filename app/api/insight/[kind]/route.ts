import { NextResponse } from 'next/server';
import { admin, readerFor } from '@/lib/db';
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
  const { data: athletes } = await sb.from('athlete').select('id').order('created_at');
  const lijst = (athletes as { id: string }[] | null) ?? [];
  if (!lijst.length) return NextResponse.json({ error: 'Nog geen atleet in de database.' }, { status: 409 });

  const now = todayIn();
  const { start, end } = period(kind as InsightKind, now);

  // Iedereen krijgt zijn eigen analyse op zijn eigen cijfers. Eén mislukte
  // analyse mag de rest niet tegenhouden, dus we vangen hem per atleet af.
  const uitkomsten = [];
  for (const athlete of lijst) {
    uitkomsten.push(await analyseVoor(athlete.id, kind as InsightKind, now, start, end));
  }

  const mislukt = uitkomsten.filter((u) => 'error' in u);
  return NextResponse.json(
    { atleten: lijst.length, gelukt: uitkomsten.length - mislukt.length, uitkomsten },
    { status: mislukt.length === uitkomsten.length ? 502 : 200 },
  );
}

async function analyseVoor(
  athleteId: string,
  kind: InsightKind,
  now: IsoDate,
  start: IsoDate,
  end: IsoDate,
): Promise<Record<string, unknown>> {
  // De service-role-sleutel zet RLS uit, dus de lezer filtert zelf op atleet.
  const lezer = readerFor(athleteId);

  try {
    const weeks = await getWeeks(lezer);
    const current = weeks.find((w) => w.start_date <= now && addDays(w.start_date, 6) >= now) ?? weeks[0]!;

    const ruleInput = await loadRuleInput(now, current.week, current.status, lezer);
    const hits = ruleInput ? evaluate(ruleInput) : [];
    const facts = await buildFacts(kind, now, ruleInput, lezer);
    const answer = await askForInsight(kind, facts, hits);

    const { data, error } = await lezer.client
      .from('insight')
      .upsert(
        {
          athlete_id: athleteId,
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

    if (error) return { athlete_id: athleteId, error: error.message };
    return {
      athlete_id: athleteId,
      id: data.id,
      rule_hits: hits.map((h) => h.id),
      proposals: answer.proposals.length,
    };
  } catch (fout) {
    return { athlete_id: athleteId, error: (fout as Error).message };
  }
}

/** De cron doet een GET (zie scheduled() in worker.ts). Zelfde werk,
 *  zelfde controle. */
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  return POST(request, context);
}
