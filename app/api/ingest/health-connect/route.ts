import { NextResponse } from 'next/server';
import { admin } from '@/lib/db';
import { apparaatVanVerzoek } from '@/lib/apparaat';
import { isDezelfdeSessie, leesPayload, OVERGENOMEN } from '@/lib/ingest';

export const dynamic = 'force-dynamic';

/** Ontvangt wat de Android-app uit Health Connect heeft gelezen en zet het om
 *  naar hetzelfde model als Strava. Vanaf hier weet de rest van de app niet meer
 *  waar een activiteit vandaan komt — dat is het punt. */
export async function POST(request: Request) {
  const apparaat = await apparaatVanVerzoek(request);
  if (!apparaat) return NextResponse.json({ error: 'Onbekend apparaat.' }, { status: 401 });

  const sb = admin();
  const gelezen = leesPayload(await request.json().catch(() => null));
  if (!gelezen.ok) {
    await sb.from('device').update({ laatste_fout: gelezen.fout }).eq('id', apparaat.id);
    return NextResponse.json({ error: gelezen.fout }, { status: 400 });
  }

  const { trainingen, dagen, verwijderd } = gelezen.payload;
  const athleteId = apparaat.athlete_id;

  // ── trainingen ────────────────────────────────────────────────────────────
  const bruikbaar = trainingen.filter((t) => OVERGENOMEN[t.sportType]);

  // Wie zowel Strava als zijn horloge laat synchroniseren krijgt dezelfde loop
  // twee keer binnen, met verschillende ids. Zonder deze controle telt hij
  // dubbel in het weekvolume.
  const datums = [...new Set(bruikbaar.map((t) => t.datum))];
  const { data: bestaand } = datums.length
    ? await sb
        .from('activity')
        .select('start_local, moving_s, source')
        .eq('athlete_id', athleteId)
        .neq('source', 'health_connect')
        .in('date', datums)
    : { data: [] };

  const andereBron = (bestaand as { start_local: string; moving_s: number | null }[] | null) ?? [];
  const nieuw = bruikbaar.filter((t) => !andereBron.some((a) => isDezelfdeSessie(t, a)));

  const rijen = nieuw.map((t) => ({
    athlete_id: athleteId,
    source: 'health_connect' as const,
    external_id: t.externalId,
    date: t.datum,
    start_local: t.startLokaal,
    sport_type: OVERGENOMEN[t.sportType]!,
    name: t.titel,
    distance_m: t.afstandM,
    moving_s: t.duurSec,
    elapsed_s: t.duurSec,
    elev_gain_m: t.stijgingM,
    avg_hr: t.hartslagGem,
    max_hr: t.hartslagMax,
    calories: t.kcal,
    raw: { origin_package: t.bron, health_connect_type: t.sportType },
    // Health Connect levert geen tijdreeks per seconde, dus er komen nooit
    // streams bij. Meteen afvinken, anders blijft hij in de wachtrij hangen.
    streams_synced_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }));

  if (rijen.length) {
    const { error } = await sb
      .from('activity')
      .upsert(rijen, { onConflict: 'athlete_id,source,external_id' });
    if (error) {
      await sb.from('device').update({ laatste_fout: error.message }).eq('id', apparaat.id);
      return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
    }
  }

  // ── dagwaarden ────────────────────────────────────────────────────────────
  // Naar de _auto-kolommen. Wat je zelf invult bij de ochtendcheck blijft
  // leidend: de telefoon mag aanvullen, niet corrigeren.
  type DagRij = {
    athlete_id: string;
    date: string;
    sleep_hours_auto?: number;
    resting_hr_auto?: number;
    weight_kg_auto?: number;
  };

  const dagRijen: DagRij[] = [];
  for (const d of dagen) {
    const rij: DagRij = { athlete_id: athleteId, date: d.datum };
    if (d.slaapUren !== null) rij.sleep_hours_auto = Math.round(d.slaapUren * 100) / 100;
    if (d.rustpols !== null) rij.resting_hr_auto = d.rustpols;
    if (d.gewichtKg !== null) rij.weight_kg_auto = d.gewichtKg;
    // Alleen een datum en verder niets is geen meting.
    if (Object.keys(rij).length > 2) dagRijen.push(rij);
  }

  if (dagRijen.length) {
    await sb.from('wellness').upsert(dagRijen, { onConflict: 'athlete_id,date' });
  }

  // ── verwijderingen ────────────────────────────────────────────────────────
  // Health Connect meldt wanneer een record weg is. Negeer je dat, dan blijft
  // een per ongeluk opgenomen training voor altijd in je weektotaal staan.
  if (verwijderd.length) {
    await sb
      .from('activity')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('source', 'health_connect')
      .in('external_id', verwijderd);
  }

  await sb
    .from('device')
    .update({ laatste_sync: new Date().toISOString(), laatste_fout: null })
    .eq('id', apparaat.id);

  return NextResponse.json({
    ok: true,
    opgeslagen: rijen.length,
    overgeslagen: bruikbaar.length - nieuw.length,
    genegeerd: trainingen.length - bruikbaar.length,
    dagen: dagRijen.length,
    verwijderd: verwijderd.length,
  });
}
