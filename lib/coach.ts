import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getZones } from '@/lib/data';
import { km, minutes } from '@/lib/metrics';
import { addDays, daysBetween, type IsoDate } from '@/lib/date';
import type { RuleHit } from '@/lib/rules';
import type { PlanWeek, Wellness } from '@/lib/types';

/* De coach mag de gegevens lezen en erover praten. Hij mag niets aanpassen en
 * hij bepaalt geen alarmen: die staan vast in lib/rules.ts en gaan als gegeven
 * mee. Elk getal dat hij noemt komt uit een van de gereedschappen hieronder of
 * uit de meegestuurde samenvatting — niets uit zijn geheugen. */

/** Overschrijfbaar met ANTHROPIC_CHAT_MODEL; anders het nieuwste Opus-model. */
const MODEL = process.env.ANTHROPIC_CHAT_MODEL ?? 'claude-opus-5';

/** Genoeg om te redeneren over een blok van vier weken, te weinig om per
 *  ongeluk het halve plan in te lezen. */
const MAX_DAGEN = 120;
const MAX_RONDES = 8;

const SYSTEM = `Je bent de coach in een trainingsapp voor één hardloper. Hij loopt op 2 oktober 2027 een 100 km ultratrail. Het trainingsplan van 57 weken staat vast in de database; jij voert het niet uit en je verandert het niet, je legt uit en je denkt mee.

Toon en taal:
- Nederlands, tweede persoon, gewone woorden. Geen jargon waar een gewoon woord bestaat: schrijf "hoe zwaar het voelde" in plaats van "RPE", "hoe je je voelt" in plaats van "welzijnsscore".
- Geen uitroeptekens. Geen aanmoediging die niet verdiend is, geen schuld bij een gemiste week.
- Kort. Antwoord op de vraag die gesteld is. Een tabel of opsomming alleen als de vraag daarom vraagt.

Hoe je met de gegevens omgaat:
- Verzin nooit een sessie, een gewicht, een afstand of een voedingsgetal. Alles komt uit het plan, uit de metingen of uit de naslag. Weet je het niet, zoek het op met een gereedschap. Vind je het niet, zeg dat dan.
- Onderscheid altijd wat je in de cijfers ziet van wat je inschat. "Dit zie ik" tegenover "dit vermoed ik".
- De alarmen zijn deterministisch en gaan als "actieve regels" mee. Je licht ze toe. Je bedenkt er geen bij en je praat er geen weg. Staat er niets actief, zeg dan niet dat er iets mis is.
- Bij een regel met niveau "stop" is het antwoord rust, nooit een aangepaste sessie.
- Je kunt niets wijzigen. Adviseer je een aanpassing, zeg dan welke dag en welk veld, en dat hij het zelf doorvoert.

Rekenen doe je hardop en met de getallen die je hebt opgezocht. Noem je een gemiddelde, zeg dan waarover.`;

const bereik = {
  van: { type: 'string' as const, description: 'Eerste dag, YYYY-MM-DD.' },
  tot: { type: 'string' as const, description: 'Laatste dag, YYYY-MM-DD.' },
};

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'plan',
    description:
      'De geplande sessies tussen twee dagen: soort, tekst, kilometers, minuten, zone, tempo en het krachtblok. Dit is het vaste plan, niet wat er gelopen is.',
    input_schema: { type: 'object', properties: bereik, required: ['van', 'tot'] },
  },
  {
    name: 'weken',
    description:
      'De planweken met hun doelen (kilometers, hoogtemeters, afdaalminuten, aantal krachtsessies, fase, focus) naast wat er werkelijk gelopen is. Zonder argumenten krijg je alle 57 weken.',
    input_schema: {
      type: 'object',
      properties: {
        van_week: { type: 'number', description: 'Eerste weeknummer, 1 tot 57.' },
        tot_week: { type: 'number', description: 'Laatste weeknummer, 1 tot 57.' },
      },
    },
  },
  {
    name: 'activiteiten',
    description:
      'Wat er werkelijk gelopen is volgens Strava tussen twee dagen: afstand, tijd, hoogtemeters, hartslag. Ook fietsen en wandelen staan erbij; die tellen niet mee in het weekvolume.',
    input_schema: { type: 'object', properties: bereik, required: ['van', 'tot'] },
  },
  {
    name: 'logboek',
    description:
      'Wat hij zelf heeft ingevuld na een sessie tussen twee dagen: hoe zwaar het voelde, pijn tijdens en de ochtend erna, koolhydraten per uur, maag, tape, notitie.',
    input_schema: { type: 'object', properties: bereik, required: ['van', 'tot'] },
  },
  {
    name: 'ochtendcheck',
    description:
      'De ochtendcheck tussen twee dagen: geslapen, fris, benen, rust in je hoofd, zin om te gaan (elk 1 tot 7, samen 5 tot 35), plus slaapuren, rusthartslag en gewicht.',
    input_schema: { type: 'object', properties: bereik, required: ['van', 'tot'] },
  },
  {
    name: 'zoneverdeling',
    description: 'Minuten per hartslagzone tussen twee dagen, opgeteld over alle activiteiten met een hartslagstream.',
    input_schema: { type: 'object', properties: bereik, required: ['van', 'tot'] },
  },
  {
    name: 'naslag',
    description:
      'Vaste naslag uit het plan: "zones" (hartslagzones, tempo, streefverdeling), "fueling_by_week" (koolhydraten en natrium per uur per fase), "strength_phases" (krachtfases) of "milestones" (testmomenten en wedstrijden).',
    input_schema: {
      type: 'object',
      properties: {
        onderwerp: { type: 'string', enum: ['zones', 'fueling_by_week', 'strength_phases', 'milestones'] },
      },
      required: ['onderwerp'],
    },
  },
  {
    name: 'oefeningen',
    description:
      'De krachtoefeningen uit het plan: naam, bij welk blok ze horen, de eenheid, het aantal series en de uitvoeringsnotitie. Gebruik dit als er gevraagd wordt hoe een oefening moet.',
    input_schema: {
      type: 'object',
      properties: {
        blok: { type: 'string', description: 'Beperk tot één krachtblok, bijvoorbeeld "A" of "B". Laat weg voor alle oefeningen.' },
      },
    },
  },
  {
    name: 'zoek_in_plan',
    description:
      'Zoek in de tekst van de geplande sessies, bijvoorbeeld "heuvel", "tempo" of "test". Levert hoogstens twintig dagen.',
    input_schema: {
      type: 'object',
      properties: { zoekterm: { type: 'string' } },
      required: ['zoekterm'],
    },
  },
];

/** Knip een gevraagd bereik terug tot iets wat in een antwoord past. Zonder
 *  deze grens kan het model in één keer het hele plan van 399 dagen opvragen. */
export function knip(van: unknown, tot: unknown, vandaag: IsoDate): [IsoDate, IsoDate] {
  const a = typeof van === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(van) ? van : addDays(vandaag, -13);
  const b = typeof tot === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tot) ? tot : vandaag;
  if (b < a) return [b, a];
  return daysBetween(a, b) > MAX_DAGEN ? [addDays(b, -MAX_DAGEN), b] : [a, b];
}

/** Voert één gereedschap uit. De client komt van de ingelogde gebruiker mee,
 *  dus RLS bepaalt wat de coach te zien krijgt — hij kan niet in andermans plan.
 *  Alles hier is lezen; de coach kan niets wijzigen. */
export async function runTool(
  sb: SupabaseClient,
  naam: string,
  input: Record<string, unknown>,
  vandaag: IsoDate,
): Promise<unknown> {
  switch (naam) {
    case 'plan': {
      const [van, tot] = knip(input.van, input.tot, vandaag);
      const { data } = await sb
        .from('plan_day')
        .select('date, week, session_type, session_text, planned_km, planned_min, zone, pace_range, strength_block, strength_detail')
        .gte('date', van)
        .lte('date', tot)
        .order('date');
      return ((data as PlanDagRij[] | null) ?? []).map((d) => ({
        datum: d.date,
        week: d.week,
        soort: d.session_type,
        tekst: d.session_text,
        km: Number(d.planned_km),
        minuten: d.planned_min,
        zone: d.zone,
        tempo: d.pace_range,
        kracht: d.strength_block,
        krachtdetail: d.strength_detail,
      }));
    }

    case 'weken': {
      const van = typeof input.van_week === 'number' ? Math.round(input.van_week) : 1;
      const tot = typeof input.tot_week === 'number' ? Math.round(input.tot_week) : 57;
      const [laag, hoog] = van <= tot ? [van, tot] : [tot, van];
      const [{ data: weken }, { data: actuals }] = await Promise.all([
        sb.from('plan_week').select('*').gte('week', laag).lte('week', hoog).order('week'),
        sb.from('v_week_actual').select('*'),
      ]);
      const per = new Map(
        ((actuals as WeekActualRow[] | null) ?? []).map((a) => [a.week, a]),
      );
      return ((weken as PlanWeek[] | null) ?? []).map((w) => {
        const a = per.get(w.week);
        return {
          week: w.week,
          begint: w.start_date,
          fase: w.phase,
          status: w.status,
          focus: w.focus,
          doel_km: Number(w.target_km),
          gelopen_km: a ? Math.round(Number(a.actual_km) * 10) / 10 : 0,
          hm_doel: w.hm_target,
          hm_gelopen: a ? Math.round(Number(a.actual_hm)) : 0,
          afdaalminuten_doel: w.descent_min_target,
          afdaalminuten_gelopen: a ? Math.round(Number(a.actual_descent_min)) : 0,
          kracht_doel: w.strength_sessions,
          kracht_gedaan: a ? Number(a.strength_done) : 0,
        };
      });
    }

    case 'activiteiten': {
      const [van, tot] = knip(input.van, input.tot, vandaag);
      const { data } = await sb
        .from('activity')
        .select('date, sport_type, name, distance_m, moving_s, elev_gain_m, avg_hr, max_hr')
        .gte('date', van)
        .lte('date', tot)
        .order('start_local');
      return ((data as ActiviteitRij[] | null) ?? []).map((a) => ({
        datum: a.date,
        soort: a.sport_type,
        naam: a.name,
        km: km(a.distance_m),
        minuten: minutes(a.moving_s),
        hm: Math.round(Number(a.elev_gain_m ?? 0)),
        gemiddelde_hartslag: a.avg_hr ? Math.round(Number(a.avg_hr)) : null,
        hoogste_hartslag: a.max_hr ? Math.round(Number(a.max_hr)) : null,
      }));
    }

    case 'logboek': {
      const [van, tot] = knip(input.van, input.tot, vandaag);
      const { data } = await sb
        .from('session_log')
        .select('date, rpe, pain_score, pain_note, pain_next_morning, carbs_g_per_h, gi_score, taped, note')
        .gte('date', van)
        .lte('date', tot)
        .order('date');
      return ((data as LogRow[] | null) ?? []).map((l) => ({
        datum: l.date,
        hoe_zwaar: l.rpe,
        pijn_tijdens: l.pain_score,
        pijn_ochtend_erna: l.pain_next_morning,
        pijnplek: l.pain_note,
        koolhydraten_per_uur: l.carbs_g_per_h,
        maag: l.gi_score,
        getapet: l.taped,
        notitie: l.note,
      }));
    }

    case 'ochtendcheck': {
      const [van, tot] = knip(input.van, input.tot, vandaag);
      const { data } = await sb
        .from('wellness')
        .select('date, slept, fresh, legs, mind, motivation, total, sleep_hours, resting_hr, weight_kg')
        .gte('date', van)
        .lte('date', tot)
        .order('date');
      return ((data as Wellness[] | null) ?? []).map((w) => ({
        datum: w.date,
        geslapen: w.slept,
        fris: w.fresh,
        benen: w.legs,
        hoofd: w.mind,
        zin: w.motivation,
        totaal: w.total,
        slaapuren: w.sleep_hours,
        rusthartslag: w.resting_hr,
        gewicht_kg: w.weight_kg,
      }));
    }

    case 'zoneverdeling': {
      const [van, tot] = knip(input.van, input.tot, vandaag);
      const { data } = await sb
        .from('activity_zone')
        .select('zone, seconds, activity!inner(date)')
        .gte('activity.date', van)
        .lte('activity.date', tot);
      const totalen: Record<string, number> = {};
      for (const rij of ((data as { zone: string; seconds: number }[] | null) ?? [])) {
        totalen[rij.zone] = (totalen[rij.zone] ?? 0) + Number(rij.seconds);
      }
      return {
        van,
        tot,
        minuten_per_zone: Object.fromEntries(
          Object.entries(totalen).map(([zone, s]) => [zone, Math.round(s / 60)]),
        ),
      };
    }

    case 'naslag': {
      const onderwerp = input.onderwerp;
      if (
        onderwerp !== 'zones' &&
        onderwerp !== 'fueling_by_week' &&
        onderwerp !== 'strength_phases' &&
        onderwerp !== 'milestones'
      ) {
        return { fout: `Onbekend onderwerp "${String(onderwerp)}".` };
      }
      // Zones zijn persoonlijk zodra je HRmax gemeten is; de rest is voor
      // iedereen gelijk en komt uit de naslag.
      if (onderwerp === 'zones') return getZones({ client: sb, athleteId: null });
      const { data } = await sb.from('reference').select('value').eq('key', onderwerp).maybeSingle();
      return data?.value ?? { fout: `"${onderwerp}" staat niet in de naslag.` };
    }

    case 'oefeningen': {
      let q = sb.from('exercise').select('slug, name, block, unit, default_sets, note').order('slug');
      if (typeof input.blok === 'string' && input.blok.trim()) q = q.eq('block', input.blok.trim());
      const { data } = await q;
      return data ?? [];
    }

    case 'zoek_in_plan': {
      const term = String(input.zoekterm ?? '').trim();
      if (term.length < 2) return [];
      const { data } = await sb
        .from('plan_day')
        .select('date, week, weekday, session_type, session_text')
        .ilike('session_text', `%${term.replace(/[%_]/g, '')}%`)
        .order('date')
        .limit(20);
      return data ?? [];
    }

    default:
      return { fout: `Onbekend gereedschap "${naam}".` };
  }
}

type PlanDagRij = Pick<
  import('@/lib/types').PlanDay,
  'date' | 'week' | 'session_type' | 'session_text' | 'planned_km' | 'planned_min' | 'zone' | 'pace_range' | 'strength_block' | 'strength_detail'
>;

type ActiviteitRij = Pick<
  import('@/lib/types').Activity,
  'date' | 'sport_type' | 'name' | 'distance_m' | 'moving_s' | 'elev_gain_m' | 'avg_hr' | 'max_hr'
>;

type WeekActualRow = {
  week: number;
  actual_km: number;
  actual_hm: number;
  actual_descent_min: number;
  strength_done: number;
};

type LogRow = {
  date: IsoDate;
  rpe: number | null;
  pain_score: number | null;
  pain_note: string | null;
  pain_next_morning: number | null;
  carbs_g_per_h: number | null;
  gi_score: number | null;
  taped: boolean | null;
  note: string | null;
};

export type CoachEvent =
  | { type: 'tekst'; delta: string }
  | { type: 'opzoeken'; naam: string }
  | { type: 'klaar'; tekst: string }
  | { type: 'fout'; bericht: string };

export function coachConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** De opening van het gesprek: de samenvatting van vandaag en de actieve regels,
 *  zodat een gewone vraag geen enkele opzoekactie kost. */
function opening(facts: Record<string, unknown>, rules: RuleHit[], scherm: string | null): string {
  return `Vandaag is ${facts.vandaag}. Hieronder de stand van zaken. Alles wat je verder nodig hebt zoek je op met de gereedschappen.
${scherm ? `\nWaar hij nu naar kijkt: ${scherm}\n` : ''}

Samenvatting:
${JSON.stringify(facts, null, 1)}

Actieve regels (deterministisch bepaald, niet door jou):
${
  rules.length
    ? JSON.stringify(rules.map((r) => ({ id: r.id, niveau: r.level, titel: r.title, toelichting: r.detail, sinds: r.since })), null, 1)
    : 'geen'
}`;
}

/** Voert het gesprek en levert de gebeurtenissen terug zodra ze binnenkomen.
 *  `historie` is het gesprek tot nu toe, oplopend in tijd, de nieuwe vraag als
 *  laatste. */
export async function* runCoach(
  sb: SupabaseClient,
  historie: { role: 'user' | 'assistant'; content: string }[],
  facts: Record<string, unknown>,
  rules: RuleHit[],
  vandaag: IsoDate,
  /** Het scherm waar de vraag vandaan komt, in één zin. Zo weet de coach dat
   *  "deze oefening" over het krachtblok van die dag gaat. */
  scherm: string | null = null,
): AsyncGenerator<CoachEvent> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    yield { type: 'fout', bericht: 'ANTHROPIC_API_KEY ontbreekt.' };
    return;
  }

  const client = new Anthropic({ apiKey: key });
  const eerste = historie[0];
  if (!eerste || eerste.role !== 'user') {
    yield { type: 'fout', bericht: 'Het gesprek begint niet met een vraag.' };
    return;
  }

  // De stand van zaken hangt aan de eerste vraag van dit verzoek, niet aan een
  // los systeembericht: zo blijft zichtbaar bij welke dag de cijfers hoorden.
  const messages: Anthropic.MessageParam[] = historie.map((m, i) =>
    i === 0 ? { role: m.role, content: `${opening(facts, rules, scherm)}\n\nVraag: ${m.content}` } : { role: m.role, content: m.content },
  );

  // Bij een vervolgvraag hoort de schermcontext bij díe vraag, niet bij de
  // eerste van het gesprek.
  const laatsteIndex = messages.length - 1;
  if (scherm && laatsteIndex > 0) {
    const laatsteVraag = messages[laatsteIndex]!;
    if (typeof laatsteVraag.content === 'string') {
      laatsteVraag.content = `[Hij kijkt nu naar: ${scherm}]\n\n${laatsteVraag.content}`;
    }
  }

  let laatste = '';

  for (let ronde = 0; ronde < MAX_RONDES; ronde++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      tools: TOOLS,
      messages,
    });

    const tekstDeltas: string[] = [];
    for await (const gebeurtenis of stream) {
      if (
        gebeurtenis.type === 'content_block_delta' &&
        gebeurtenis.delta.type === 'text_delta' &&
        gebeurtenis.delta.text
      ) {
        tekstDeltas.push(gebeurtenis.delta.text);
        yield { type: 'tekst', delta: gebeurtenis.delta.text };
      }
    }

    const antwoord = await stream.finalMessage();
    laatste = tekstDeltas.join('');

    const opdrachten = antwoord.content.filter(
      (blok): blok is Anthropic.ToolUseBlock => blok.type === 'tool_use',
    );
    if (!opdrachten.length) {
      yield { type: 'klaar', tekst: laatste };
      return;
    }

    // De denkblokken moeten mee terug, anders weigert de API het vervolg.
    messages.push({ role: 'assistant', content: antwoord.content });

    const resultaten: Anthropic.ToolResultBlockParam[] = [];
    for (const opdracht of opdrachten) {
      yield { type: 'opzoeken', naam: opdracht.name };
      try {
        const uitkomst = await runTool(sb, opdracht.name, (opdracht.input ?? {}) as Record<string, unknown>, vandaag);
        resultaten.push({
          type: 'tool_result',
          tool_use_id: opdracht.id,
          content: JSON.stringify(uitkomst),
        });
      } catch (fout) {
        resultaten.push({
          type: 'tool_result',
          tool_use_id: opdracht.id,
          content: `Opzoeken mislukt: ${(fout as Error).message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: resultaten });
  }

  // Acht rondes opzoeken en nog geen antwoord: dan zeggen we dat, in plaats van
  // te doen alsof het laatste tussenzinnetje het antwoord was.
  yield {
    type: 'fout',
    bericht: 'Ik bleef te lang gegevens opzoeken zonder tot een antwoord te komen. Stel de vraag wat scherper.',
  };
}
