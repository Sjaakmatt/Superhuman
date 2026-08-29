import { db } from '@/lib/db';
import { getDay, getWeeks } from '@/lib/plan';
import { loadRuleInput } from '@/lib/data';
import { buildFacts } from '@/lib/facts';
import { evaluate } from '@/lib/rules';
import { coachConfigured, runCoach, type CoachEvent } from '@/lib/coach';
import { addDays, today as todayIn, type IsoDate } from '@/lib/date';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/** Zoveel eerdere berichten gaan mee terug het gesprek in. Genoeg om te
 *  verwijzen naar wat je vorige week vroeg, weinig genoeg om betaalbaar te
 *  blijven. */
const HISTORIE = 20;

const regel = (event: CoachEvent) => `${JSON.stringify(event)}\n`;

export async function POST(request: Request) {
  const sb = await db();
  if (!sb) return json({ error: 'Geen database verbonden.' }, 503);

  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Niet ingelogd.' }, 401);

  const { data: athlete } = await sb.from('athlete').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!athlete) return json({ error: 'Nog geen atleet in de database.' }, 409);

  if (!coachConfigured()) return json({ error: 'De coach is niet ingesteld: ANTHROPIC_API_KEY ontbreekt.' }, 503);

  const body = (await request.json().catch(() => null)) as
    | { vraag?: unknown; pad?: unknown; datum?: unknown }
    | null;
  const vraag = typeof body?.vraag === 'string' ? body.vraag.trim() : '';
  if (!vraag) return json({ error: 'Geen vraag meegestuurd.' }, 400);
  if (vraag.length > 4000) return json({ error: 'Die vraag is te lang.' }, 400);

  const vandaag = todayIn();

  // De widget stuurt alleen waar hij staat; de zin eromheen maken we hier uit
  // de database. Zo kan een pagina de coach nooit iets in de mond leggen.
  const scherm = await schermContext(sb, body?.pad, body?.datum, vandaag);

  // Het gesprek tot nu toe, oplopend in tijd. De laatste twintig berichten
  // staan in de database op volgorde van binnenkomst.
  const { data: eerder } = await sb
    .from('chat_message')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(HISTORIE);

  const historie = (((eerder as { role: 'user' | 'assistant'; content: string }[] | null) ?? []).reverse());
  // Een gesprek moet met een vraag beginnen; anders weigert de API het.
  while (historie.length && historie[0]!.role !== 'user') historie.shift();
  historie.push({ role: 'user', content: vraag });

  const weeks = await getWeeks();
  const current = weeks.find((w) => w.start_date <= vandaag && addDays(w.start_date, 6) >= vandaag) ?? weeks[0]!;
  const ruleInput = await loadRuleInput(vandaag, current.week, current.status);
  const hits = ruleInput ? evaluate(ruleInput) : [];
  const facts = await buildFacts('chat', vandaag, ruleInput);

  await sb.from('chat_message').insert({ athlete_id: athlete.id, role: 'user', content: vraag, asof: vandaag });

  // Regel-voor-regel JSON. Geen SSE: we hebben geen herverbinding nodig en dit
  // leest in de browser met één splitsing op de nieuwe regel.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let antwoord = '';
      try {
        for await (const event of runCoach(sb, historie, facts, hits, vandaag, scherm)) {
          if (event.type === 'klaar') antwoord = event.tekst;
          controller.enqueue(encoder.encode(regel(event)));
        }
      } catch (fout) {
        controller.enqueue(encoder.encode(regel({ type: 'fout', bericht: (fout as Error).message })));
      }
      if (antwoord.trim()) {
        await sb
          .from('chat_message')
          .insert({ athlete_id: athlete.id, role: 'assistant', content: antwoord, asof: vandaag });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      // Anders wacht een tussenliggende proxy tot het antwoord af is.
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Waar de vraag vandaan komt, in één zin. Het pad komt van de client en wordt
 *  daarom tegen een vaste lijst gehouden; de inhoud komt uit het plan. */
const SCHERMEN: Record<string, string> = {
  '/': 'het scherm Vandaag',
  '/loggen': 'het scherm Loggen, waar hij invult hoe een sessie ging',
  '/kracht': 'het krachtschema',
  '/analyse': 'de analyse met de grafieken en de signalen',
  '/seizoen': 'het seizoensoverzicht met alle 57 weken',
  '/instellingen': 'de instellingen',
};

async function schermContext(
  sb: SupabaseClient,
  pad: unknown,
  datum: unknown,
  vandaag: IsoDate,
): Promise<string | null> {
  const naam = typeof pad === 'string' ? SCHERMEN[pad] : undefined;
  if (!naam) return null;

  const dag = typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : vandaag;
  const lezer = { client: sb, athleteId: null };
  const plan = await getDay(dag, lezer);
  if (!plan) return naam;

  const stukken = [`${naam}, voor ${dag}`, `de geplande sessie is "${plan.session_type}: ${plan.session_text}"`];
  if (pad === '/kracht' && plan.strength_block) {
    stukken.push(`het krachtblok van die dag is "${plan.strength_block}"`);
    if (plan.strength_detail) stukken.push(`met: ${plan.strength_detail.split('|').map((s) => s.trim()).join(', ')}`);
    stukken.push('als hij "deze oefening" zegt, bedoelt hij er een uit dat blok');
  }
  return stukken.join('; ') + '.';
}

/** Het gesprek tot nu toe, voor de widget die bij het openen zijn geschiedenis
 *  ophaalt. */
export async function GET() {
  const sb = await db();
  if (!sb) return json({ berichten: [] }, 200);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Niet ingelogd.' }, 401);
  const { data } = await sb
    .from('chat_message')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(40);
  return json({ berichten: ((data as ChatRij[] | null) ?? []).reverse() }, 200);
}

type ChatRij = { role: 'user' | 'assistant'; content: string };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Het gesprek wissen. */
export async function DELETE() {
  const sb = await db();
  if (!sb) return json({ error: 'Geen database verbonden.' }, 503);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Niet ingelogd.' }, 401);
  const { error } = await sb.from('chat_message').delete().not('id', 'is', null);
  if (error) return json({ error: error.message }, 500);
  return json({ gewist: true }, 200);
}
