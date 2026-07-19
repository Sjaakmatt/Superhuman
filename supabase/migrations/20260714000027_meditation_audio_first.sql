-- Meditatie audio-first herstructurering.
--
-- De leerlijn was techniek-eerst met los gekoppelde media: dezelfde UCLA-audio
-- hergebruikt, titels die niet met de duur klopten, en de helft van de niveaus
-- wees naar externe artikel-/boekpagina's die niet in-app afspelen.
--
-- Nu is de begeleide audio leidend en elk niveau beschrijft de ÉCHTE opname,
-- oplopend in diepte. Alle media is geverifieerd in-app afspeelbaar (directe
-- mp3, https): het fundament komt van UCLA Mindful (MARC, Diana Winston), de
-- open-bewustzijn-verdieping van Tara Brach. De top is een stille zit zonder
-- begeleiding — de echte graduatie richting de gevorderd-modus.

delete from meditation_levels;

insert into meditation_levels
  (level, slug, name, one_liner, instruction, guidance, target_min, unlock, media, xp, sort)
values
(1, 'adem_landen', 'Zitten & landen',
 'Vijf minuten waarin Diana Winston je naar je adem als anker brengt.',
 ARRAY[
   'Zoek een rechte, ontspannen houding',
   'Diana laat je eerst landen in lijf en houding',
   'Breng dan de aandacht naar de adem — buik, borst of neusgaten',
   'Dwaalt de aandacht af, keer dan vriendelijk terug'
 ]::text[],
 'De basis van alle meditatie: één anker, telkens terugkeren zonder oordeel.',
 5, '{"requires":[]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/01_Breathing_Meditation.mp3","title":"UCLA Mindful · Breathing Meditation (5 min)"}'::jsonb,
 30, 1),

(2, 'adem_geluid_lijf', 'Adem, geluid & lijf',
 'Diana verbreedt je aandacht van de adem naar geluid en het hele lichaam.',
 ARRAY[
   'Begin bij de adem als anker',
   'Open daarna de aandacht voor geluiden die komen en gaan',
   'Verbreed naar sensaties in het hele lichaam',
   'Rust in een ruimere, ontvangende aandacht'
 ]::text[],
 'Van één anker naar bredere, open aandacht — een eerste stap richting open bewustzijn.',
 12, '{"requires":[{"type":"sessions","level":1,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/02_Breath_Sound_Body_Meditation.mp3","title":"UCLA Mindful · Breath, Sound, Body (12 min)"}'::jsonb,
 30, 2),

(3, 'bodyscan', 'Bodyscan',
 'Een systematische reis met de aandacht door het hele lichaam.',
 ARRAY[
   'Lig of zit comfortabel',
   'Diana leidt de aandacht stap voor stap door het lichaam',
   'Van voeten tot kruin — voel wat er te voelen is, zonder te sturen',
   'Zachte, bewegende aandacht die diep ontspant'
 ]::text[],
 'Traint fijnmazige, bewegende aandacht en diepe ontspanning. Ook fijn voor het slapen.',
 13, '{"requires":[{"type":"sessions","level":2,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/Body-Scan-for-Sleep.mp3","title":"UCLA Mindful · Body Scan (13 min)"}'::jsonb,
 30, 3),

(4, 'moeilijkheden', 'Werken met moeilijkheden',
 'Leren om lastige emoties en sensaties met mildheid te ontmoeten.',
 ARRAY[
   'Kom eerst tot rust bij de adem',
   'Richt je dan op iets moeilijks dat aanwezig is',
   'Diana leert je het te benaderen met nieuwsgierigheid i.p.v. wegduwen',
   'Maak ruimte, adem ernaartoe, laat het er zijn'
 ]::text[],
 'De vaardigheid om niet te vluchten voor ongemak — de kern van veerkracht.',
 7, '{"requires":[{"type":"sessions","level":3,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/04_Meditation_for_Working_with_Difficulties.mp3","title":"UCLA Mindful · Working with Difficulties (7 min)"}'::jsonb,
 30, 4),

(5, 'metta', 'Loving-kindness / metta',
 'Warme, betrokken aandacht door goede wensen te richten — eerst naar jezelf.',
 ARRAY[
   'Rust even bij je hart en de adem',
   'Richt goede wensen eerst naar jezelf: mag ik veilig, gezond, rustig zijn',
   'Daarna naar een dierbare, een neutraal iemand, iemand die lastig is',
   'Sluit af met alle wezens'
 ]::text[],
 'Loving-kindness (metta): traint een hartelijke, open kwaliteit van aandacht.',
 9, '{"requires":[{"type":"sessions","level":4,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/05_Loving_Kindness_Meditation.mp3","title":"UCLA Mindful · Loving Kindness (9 min)"}'::jsonb,
 30, 5),

(6, 'volledige_zit', 'Volledige zit',
 'Diana''s complete, langere instructie — je eerste echte lange zit.',
 ARRAY[
   'Neem een stabiele houding voor negentien minuten',
   'Diana geeft volledige instructies: houding, adem, omgaan met afdwalen',
   'Langere stiltes waarin je zelf de aandacht draagt',
   'Een complete zit met een duidelijk begin en einde'
 ]::text[],
 'Bouwt uithoudingsvermogen op: langer zitten met minder woorden.',
 19, '{"requires":[{"type":"sessions","level":5,"count":4}]}'::jsonb,
 '{"provider":"audio","url":"https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/03_Complete_Meditation_Instructions.mp3","title":"UCLA Mindful · Complete Meditation Instructions (19 min)"}'::jsonb,
 30, 6),

(7, 'open_poort', 'Poort naar open bewustzijn',
 'Tara Brach opent de deur naar open bewustzijn via de ruimte binnenin.',
 ARRAY[
   'Kom tot rust en voel de ruimte van gewaarzijn',
   'Tara nodigt je uit de innerlijke ruimte te voelen waarin ervaring verschijnt',
   'Laat gedachten en sensaties komen en gaan in die ruimte',
   'Rust als het gewaarzijn zelf'
 ]::text[],
 'De overgang van gerichte aandacht naar ruim, open bewustzijn.',
 19, '{"requires":[{"type":"sessions","level":6,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://traffic.libsyn.com/tarabrach/2011-08-13-Meditation--InnerSpace-GatewaytoOpenAwareness-TaraBrach.mp3","title":"Tara Brach · Inner Space — Gateway to Open Awareness (19 min)"}'::jsonb,
 30, 7),

(8, 'open_bewustzijn', 'Open bewustzijn',
 'Rusten in ruim, keuzeloos gewaarzijn waarin alles mag verschijnen.',
 ARRAY[
   'Begin met een paar verankerende ademhalingen',
   'Open dan de aandacht volledig — geen object, alleen gewaarzijn',
   'Laat geluiden, sensaties en gedachten vrij komen en gaan',
   'Telkens terug naar de open, wakkere ruimte'
 ]::text[],
 'Keuzeloos gewaarzijn: niet vasthouden, niet wegduwen — enkel aanwezig zijn.',
 23, '{"requires":[{"type":"sessions","level":7,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://traffic.libsyn.com/tarabrach/2012-05-16-Meditation-Open-Awareness-TaraBrach-hq.mp3","title":"Tara Brach · Open Awareness (23 min)"}'::jsonb,
 30, 8),

(9, 'wakker_bewustzijn', 'Open, wakker bewustzijn',
 'Een subtielere, wakkere presentie — gewaarzijn dat zichzelf kent.',
 ARRAY[
   'Vestig je in open gewaarzijn',
   'Tara verfijnt naar een wakkere, heldere kwaliteit van presentie',
   'Merk de achtergrond van bewustzijn waarin alles verschijnt',
   'Rust moeiteloos, wakker en open'
 ]::text[],
 'Verdiept open bewustzijn naar een subtiele, moeiteloze wakkerheid.',
 25, '{"requires":[{"type":"sessions","level":8,"count":3}]}'::jsonb,
 '{"provider":"audio","url":"https://traffic.libsyn.com/tarabrach/2015-03-04-Meditation-Open-Wakeful-Awareness-TaraBrach.mp3","title":"Tara Brach · Open Wakeful Awareness (25 min)"}'::jsonb,
 30, 9),

(10, 'lange_open_zit', 'Lange open zit · 30 min',
 'Een volledige zit van dertig minuten in open bewustzijn.',
 ARRAY[
   'Zorg dat je dertig minuten ongestoord bent',
   'Tara leidt je in open gewaarzijn en laat je er langdurig in rusten',
   'Lange stiltes; keer telkens terug naar presentie',
   'Sluit rustig af'
 ]::text[],
 'Lengte + open bewustzijn: de zit wordt een langere beoefening op eigen kracht.',
 30, '{"requires":[{"type":"sessions","level":9,"count":4}]}'::jsonb,
 '{"provider":"audio","url":"https://traffic.libsyn.com/secure/tarabrach/2017-08-02-Meditation-Open-Awareness-Relaxing-Back-30-TaraBrach.mp3","title":"Tara Brach · 30-Minute Open Awareness (30 min)"}'::jsonb,
 30, 10),

(11, 'stille_zit', 'Stille zit · zonder begeleiding',
 'De begeleiding valt weg — jij draagt de zit nu zelf.',
 ARRAY[
   'Kies je duur en begin de stille zit',
   'Geen stem, geen muziek — alleen jij, je anker en de stilte',
   'Val je uiteen, keer dan terug; zo simpel is het',
   'Sluit af wanneer de tijd om is'
 ]::text[],
 'De echte graduatie: zitten zonder begeleiding. Vanaf hier is de gevorderd-modus je vrije ruimte.',
 20, '{"requires":[{"type":"sessions","level":10,"count":4}]}'::jsonb,
 null,
 30, 11);
