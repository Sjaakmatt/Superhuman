import Anthropic from '@anthropic-ai/sdk';
import type { Finding, Proposal } from '@/lib/types';
import type { RuleHit } from '@/lib/rules';
import type { IsoDate } from '@/lib/date';

/* De taal komt van het model, het oordeel niet. De actieve regels gaan als
 * gegeven mee: het model licht ze toe en doet voorstellen, maar het bepaalt
 * nooit zelf of er iets mis is. */

export type InsightKind = 'daily' | 'weekly' | 'longrun' | 'debrief';

export type InsightAnswer = {
  body_md: string;
  findings: Finding[];
  proposals: Proposal[];
};

/** Overschrijfbaar met ANTHROPIC_MODEL; anders het nieuwste Sonnet-model. */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

const SYSTEM = `Je schrijft in een trainingsapp voor één hardloper die op 2 oktober 2027 een 100 km ultratrail loopt.

Toon en taal:
- Nederlands, tweede persoon, gewone woorden. Geen jargon waar een gewoon woord bestaat.
- Geen uitroeptekens, geen aanmoediging die niet verdiend is, geen schuld bij een gemiste week.
- Kort. Een alinea is een alinea, geen opsomming van alles wat je weet.

Wat je wel en niet doet:
- De alarmen staan vast en komen mee als "regels". Je legt ze uit; je bedenkt er geen bij en je praat er geen weg.
- Onderscheid altijd wat onderbouwd is van wat je inschat. Schrijf "dit zie ik in de cijfers" tegenover "dit vermoed ik".
- Elk voorstel is een concrete wijziging van één veld op één dag, met een reden. Stel niets voor wat je niet kunt onderbouwen met de meegestuurde getallen.
- Bij een regel met niveau "stop" is het voorstel rust, nooit een aangepaste sessie.

Antwoord met alleen JSON, zonder toelichting eromheen:
{"body_md": string, "findings": [{"title": string, "detail": string, "severity": "info"|"warn"}], "proposals": [{"date": "YYYY-MM-DD", "field": string, "from": string, "to": string, "reason": string}]}

Toegestane velden in een voorstel: session_text, session_type, planned_km, planned_min, zone, pace_range, strength_block, strength_detail.`;

const PROMPTS: Record<InsightKind, string> = {
  daily:
    'Schrijf één alinea over vandaag: wat er op het programma staat, hoe dat zich verhoudt tot gisteren en tot hoe je je de afgelopen week voelde. Stel alleen een aanpassing voor als een regel daar aanleiding toe geeft.',
  weekly:
    'Schrijf de weekanalyse: wat er gebeurde, wat opvalt in de verdeling en de stuurvariabelen, en wat dat betekent voor de komende week. Doe één tot drie concrete voorstellen.',
  longrun:
    'Schrijf de briefing voor de lange duurloop van morgen: gram koolhydraten per uur, natrium, kleding en ondergrond, tape, schoen. Houd het praktisch en kort.',
  debrief:
    'Schrijf de terugblik op dit blok: wat werkte, wat niet, en wat je in de resterende weken zou veranderen. Wees expliciet over wat de cijfers laten zien en wat je inschat.',
};

export function insightConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** `facts` is een compacte JSON van enkele tientallen getallen — nooit ruwe
 *  activiteiten. Dat scheelt tokens en maakt de uitvoer stabieler. */
export async function askForInsight(
  kind: InsightKind,
  facts: Record<string, unknown>,
  rules: RuleHit[],
): Promise<InsightAnswer> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY ontbreekt.');

  const client = new Anthropic({ apiKey: key });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1600,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `${PROMPTS[kind]}

Gegevens:
${JSON.stringify(facts, null, 1)}

Actieve regels (deterministisch, niet door jou bepaald):
${rules.length ? JSON.stringify(rules.map((r) => ({ id: r.id, level: r.level, title: r.title, since: r.since })), null, 1) : 'geen'}`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  return parseAnswer(text);
}

/** Het model levert JSON, maar soms met een codeblok eromheen. */
export function parseAnswer(text: string): InsightAnswer {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Geen JSON in het antwoord.');

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<InsightAnswer>;
  if (typeof parsed.body_md !== 'string') throw new Error('Antwoord zonder body_md.');

  return {
    body_md: parsed.body_md,
    findings: (parsed.findings ?? []).filter((f): f is Finding => Boolean(f?.title && f?.detail)),
    proposals: (parsed.proposals ?? []).filter(
      (p): p is Proposal => Boolean(p?.date && p?.field && typeof p.to === 'string'),
    ),
  };
}

export type Period = { start: IsoDate; end: IsoDate };
