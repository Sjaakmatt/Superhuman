/* Seed het plan in Supabase. Draait met de service-role-sleutel, want plan_week
 * en plan_day zijn onder RLS read-only. Idempotent: draai hem zo vaak je wilt.
 *
 *   npm run db:seed                     de eerste atleet
 *   npm run db:seed -- <athlete-id>     een specifieke atleet
 *
 * Een plan hoort bij één atleet. Zonder argument neemt hij de oudste — dat is
 * degene die de app heeft opgezet. Wie een tweede plan wil, geeft het id mee;
 * zonder dat zou de seed het plan van de een over dat van de ander schrijven. */
import { admin } from '@/lib/db';
import { planSeed, referenceSeed } from '@/lib/seed-files';
import { checkSeed } from '@/lib/seed-check';

async function main() {
  const plan = planSeed();
  const ref = referenceSeed();

  const problems = checkSeed(plan);
  if (problems.length) {
    console.error('Seed afgebroken — het plan klopt niet:');
    for (const p of problems) console.error('  •', p);
    process.exit(1);
  }

  const sb = admin();

  const gevraagd = process.argv[2];
  let athleteId = gevraagd;
  if (!athleteId) {
    const { data } = await sb.from('athlete').select('id').order('created_at').limit(1).maybeSingle();
    if (!data) {
      console.error('Geen atleet gevonden. Meld je eerst aan in de app, of geef een athlete-id mee.');
      process.exit(1);
    }
    athleteId = (data as { id: string }).id;
  }
  console.log(`atleet       ${athleteId}${gevraagd ? '' : ' (oudste)'}`);

  // Weken eerst: plan_day verwijst ernaar.
  const weeks = await sb
    .from('plan_week')
    .upsert(plan.weeks.map((w) => ({ ...w, athlete_id: athleteId })), { onConflict: 'athlete_id,week' });
  if (weeks.error) throw weeks.error;
  console.log(`plan_week    ${plan.weeks.length} rijen`);

  // In blokken, anders wordt het verzoek te groot.
  for (let i = 0; i < plan.days.length; i += 100) {
    const chunk = plan.days.slice(i, i + 100).map((d) => ({ ...d, athlete_id: athleteId }));
    const { error } = await sb.from('plan_day').upsert(chunk, { onConflict: 'athlete_id,date' });
    if (error) throw error;
  }
  console.log(`plan_day     ${plan.days.length} rijen`);

  const exercises = await sb.from('exercise').upsert(
    ref.exercises.map((e) => ({ ...e, note: e.note ?? null })),
    { onConflict: 'slug' },
  );
  if (exercises.error) throw exercises.error;
  console.log(`exercise     ${ref.exercises.length} rijen`);

  const reference = await sb.from('reference').upsert(
    [
      { athlete_id: athleteId, key: 'zones', value: ref.zones },
      { athlete_id: athleteId, key: 'strength_phases', value: ref.strength_phases },
      { athlete_id: athleteId, key: 'fueling_by_week', value: ref.fueling_by_week },
      { athlete_id: athleteId, key: 'milestones', value: ref.milestones },
      { athlete_id: athleteId, key: 'blood_markers', value: ref.blood_markers },
    ],
    { onConflict: 'athlete_id,key' },
  );
  if (reference.error) throw reference.error;
  console.log('reference    4 rijen');

  console.log(`\nKlaar. ${plan.meta.total_km} km over ${plan.meta.weeks} weken, wedstrijd ${plan.meta.race}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
