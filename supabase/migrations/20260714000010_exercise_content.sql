-- [aanvulling Claude] workout_logs verwijzen naar routines; koppel ze los
-- zodat de opschoon-delete hieronder niet op de foreign key botst.
update workout_logs set routine_id = null;

-- =====================================================================
--  Superhuman OS · Content-pack: oefeningen + programma's + coaching
--  Draai NA het bestaande schema. Voegt kolommen toe (idempotent) en
--  seedt een rijke oefeningen-bibliotheek + gestructureerde routines.
--
--  Filosofie: de app moet STUREN. Elke oefening heeft een opbouw
--  (klaarzetten -> uitvoeren -> vasthouden -> transitie), ademcues,
--  veelgemaakte fouten, en progressie/regressie. Programma's hebben
--  volgorde, tijd per oefening en rust ertussen.
-- =====================================================================

/* ---------- 1. Schema verrijken ---------- */
alter table exercises add column if not exists setup          text;   -- hoe kom je in positie
alter table exercises add column if not exists breathing      text;   -- ademcue
alter table exercises add column if not exists common_mistake text;   -- veelgemaakte fout
alter table exercises add column if not exists progression    text;   -- zwaarder maken
alter table exercises add column if not exists regression     text;   -- makkelijker maken
alter table exercises add column if not exists level          text default 'beginner'; -- beginner|gemiddeld|gevorderd
alter table exercises add column if not exists benefit        text;   -- waarom / effect
alter table exercises add column if not exists sets           int;
alter table exercises add column if not exists tempo          text;   -- bv '3-1-1' (excentrisch-pauze-concentrisch)
alter table exercises add column if not exists rest_secs      int;
alter table exercises add column if not exists bilateral      boolean default false; -- per kant uitvoeren?
alter table exercises add column if not exists coaching_cues  jsonb;  -- getimede cues: [{"at_pct":0.5,"text":"..."}]

alter table routines add column if not exists description  text;
alter table routines add column if not exists duration_min int;
alter table routines add column if not exists level        text default 'beginner';
alter table routines add column if not exists moment       text;      -- ochtend|avond|desk|training|any

alter table routine_exercises add column if not exists rest_secs int default 15;

/* ---------- 2. Oefeningen-bibliotheek ---------- */
-- Bestaande minimale seed opschonen zodat namen uniek blijven en we rijk kunnen vullen.
delete from routine_exercises;
delete from routines;
delete from exercises;

insert into exercises
  (name, kind, default_secs, reps, sets, tempo, rest_secs, bilateral, level, muscle_group,
   setup, cue, breathing, common_mistake, progression, regression, benefit, coaching_cues)
values
-- ================= NEK & SCHOUDERS (desk-reset) =================
('Nek-rol', 'stretch', 40, null,null,null,null,false,'beginner','nek',
 'Zit of sta rechtop, schouders laag en ontspannen, kaak los.',
 'Laat je kin naar je borst zakken en rol langzaam van de ene schouder naar de andere. Geen volledige cirkel naar achteren.',
 'Adem laag en rustig door; versnel de beweging niet op de inademing.',
 'Schouders optrekken richting de oren — houd ze juist bewust laag.',
 'Voeg een lichte weerstand toe met je hand tegen je slaap (2 sec per kant).',
 'Beperk je tot links-rechts kantelen zonder rollen.',
 'Ontspant de nekbasis en haalt spanning uit een dag achter het scherm.',
 '[{"at_pct":0.0,"text":"Kin zakt zacht naar je borst"},{"at_pct":0.5,"text":"Halverwege — rol rustig terug"},{"at_pct":0.85,"text":"Nog even, schouders laag"}]'),

('Nek-zijkant (levator)', 'stretch', 30, null,null,null,null,true,'beginner','nek',
 'Zit rechtop. Leg je rechterhand op je hoofd, linkerarm hangt zwaar langs je lijf.',
 'Trek je hoofd zacht naar rechts tot je links langs de nek rekt. Trek nooit hard.',
 'Adem uit terwijl je iets dieper in de rek zakt.',
 'Schouder van de rekkende kant optrekken; laat die juist zakken.',
 'Draai je kin licht richting je oksel voor de achterste nekstreng.',
 'Doe het zonder handdruk, alleen door het hoofd te kantelen.',
 'Verlicht de klassieke "schermnek" en spanningshoofdpijn.',
 '[{"at_pct":0.0,"text":"Kantel zacht, geen trekken"},{"at_pct":0.6,"text":"Laat de onderste schouder zwaar hangen"}]'),

('Schouder-cirkels', 'mobility', 40, null,null,null,null,false,'beginner','schouders',
 'Sta rechtop, armen ontspannen langs je lichaam.',
 'Maak grote, trage cirkels met je schouders: omhoog, naar achteren, omlaag. Halverwege van richting wisselen.',
 'Adem in bij het optrekken, uit bij het laten zakken.',
 'Alleen kleine schokjes maken — maak de cirkel zo groot mogelijk.',
 'Voeg lichte halters of flesjes water toe.',
 'Verklein de cirkel of doe één schouder tegelijk.',
 'Smeert het schoudergewricht en activeert de bovenrug.',
 '[{"at_pct":0.5,"text":"Wissel nu van richting"}]'),

('Borst-opener deurpost', 'stretch', 35, null,null,null,null,true,'beginner','borst',
 'Sta in een deuropening, onderarm plat tegen de post, elleboog op schouderhoogte.',
 'Stap met één voet door de opening en draai je romp zacht weg tot je de borst voelt openen.',
 'Adem diep in de borst, adem uit en zak iets verder open.',
 'Doorzakken in de onderrug; houd je ribben laag en buik licht aangespannen.',
 'Zet je elleboog hoger (boven schouderhoogte) voor de onderste borststreng.',
 'Verminder de romprotatie.',
 'Opent de borst die dichtklapt door zitten en telefoonhouding.',
 null),

-- ================= WERVELKOLOM & CORE-MOBILITEIT =================
('Cat-cow', 'mobility', 60, null,null,null,null,false,'beginner','rug',
 'Kom op handen en knieën: polsen onder schouders, knieën onder heupen.',
 'Adem in en laat je buik zakken (holle rug, blik omhoog). Adem uit en maak een bolle rug (kin naar borst). Wissel traag, wervel voor wervel.',
 'De beweging vólgt je adem — in bij hol, uit bij bol.',
 'Alleen vanuit de onderrug bewegen; laat de hele wervelkolom meegolven.',
 'Voeg een lichte heupcirkel toe tussen de posities.',
 'Verklein de bewegingsuitslag.',
 'Mobiliseert de hele wervelkolom en warmt de rug op.',
 '[{"at_pct":0.0,"text":"Adem in — buik zakt, blik omhoog"},{"at_pct":0.25,"text":"Adem uit — bolle rug, kin naar borst"},{"at_pct":0.5,"text":"Blijf de adem volgen"},{"at_pct":0.85,"text":"Nog een paar rondes, traag"}]'),

('Thoracale rotatie (open book)', 'mobility', 40, null,null,null,null,true,'gemiddeld','rug',
 'Lig op je zij, knieën 90° opgetrokken, armen recht voor je uitgestrekt, handpalmen tegen elkaar.',
 'Open je bovenste arm als een boek naar de andere kant en volg met je blik. Knieën blijven op elkaar liggen.',
 'Adem in bij het openen, adem uit onderin de rotatie.',
 'Je knieën laten meerollen; houd ze gestapeld zodat de rotatie uit de borstwervels komt.',
 'Pauzeer 3 seconden op het eindpunt van elke rotatie.',
 'Verklein de opening; ga alleen zo ver als comfortabel.',
 'Herstelt rotatie in de borstwervels — cruciaal voor rug en schouders.',
 '[{"at_pct":0.5,"text":"Wissel van kant"}]'),

('Kind-houding', 'stretch', 60, null,null,null,null,false,'beginner','rug',
 'Kniel, grote tenen tegen elkaar, knieën uit elkaar. Zak met je zitvlak richting je hielen.',
 'Loop met je handen naar voren, laat je borst en voorhoofd richting de grond zakken. Armen lang.',
 'Adem laag en breed in je rug — voel je ribben achterin uitzetten.',
 'Schouders naar de oren trekken; laat ze juist smelten.',
 'Loop je handen naar één kant voor een zijrek van de lat.',
 'Leg een kussen onder je zitvlak of borst.',
 'Kalmeert het zenuwstelsel en rekt de onderrug — ideaal als afsluiter.',
 '[{"at_pct":0.0,"text":"Zak zwaar richting je hielen"},{"at_pct":0.6,"text":"Verleng elke uitademing"}]'),

('Supine spinal twist', 'stretch', 40, null,null,null,null,true,'beginner','rug',
 'Lig op je rug, trek één knie op naar je borst.',
 'Laat die knie over je lichaam naar de andere kant zakken, arm gespreid, blik de andere kant op.',
 'Adem uit terwijl de knie zakt; laat de zwaartekracht het werk doen.',
 'De schouder van de gespreide arm laten loskomen — houd hem aan de grond.',
 'Leg je bovenste hand zacht op de knie voor iets meer diepte.',
 'Leg een kussen onder de zakkende knie.',
 'Ontspant onderrug en bilspieren, mooie afsluiter voor de dag.',
 null),

-- ================= HEUPEN =================
('Heupflexor-lunge', 'stretch', 45, null,null,null,null,true,'beginner','heupen',
 'Kniel in een uitval: voorste voet plat, achterste knie op de grond (leg iets zachts eronder).',
 'Duw je heup zacht naar voren tot je de voorkant van de achterste heup voelt rekken. Borst blijft rechtop.',
 'Adem uit terwijl je de heup naar voren duwt; span je bil van het achterste been licht aan.',
 'Doorzakken in de onderrug; kantel je bekken juist licht naar achteren (staart intrekken).',
 'Reik met de arm aan de kant van het achterste been omhoog en licht naar de andere kant.',
 'Verklein de voorwaartse duw; steun met een hand op je voorste knie.',
 'Opent de heupbuigers die verkorten door langdurig zitten.',
 '[{"at_pct":0.0,"text":"Staart intrekken, dan pas duwen"},{"at_pct":0.6,"text":"Bil aanspannen, borst hoog"}]'),

('90/90 heupwissel', 'mobility', 50, null,null,null,null,false,'gemiddeld','heupen',
 'Zit op de grond: voorste been 90° voor je, achterste been 90° opzij. Zit rechtop.',
 'Til beide knieën op en draai ze naar de andere kant zonder je handen te gebruiken. Wissel traag heen en weer.',
 'Adem rustig; forceer niet, laat de heup openen.',
 'Voorover klappen om het makkelijker te maken; blijf rechtop.',
 'Leun licht voorover op het voorste been voor extra rek.',
 'Gebruik je handen om de knieën te begeleiden.',
 'Bouwt actieve heuprotatie en -controle op.',
 '[{"at_pct":0.5,"text":"Handen los als het kan"}]'),

('Pigeon (duif)', 'stretch', 50, null,null,null,null,true,'gemiddeld','heupen',
 'Vanuit handen-en-knieën: breng één knie naar voren achter je pols, scheenbeen schuin, achterste been lang naar achteren.',
 'Zak met je bovenlichaam naar voren over het voorste been tot je de bil rekt.',
 'Adem diep; met elke uitademing zak je een fractie dieper.',
 'De heupen scheef laten hangen; houd ze zo recht mogelijk naar voren.',
 'Kom rechterop zitten voor meer intensiteit, of loop verder voorover.',
 'Leg een kussen onder de bil van het voorste been.',
 'Diepe rek voor bilspieren en heuprotators; verlicht lage-rugspanning.',
 null),

('Figure-4 (glute)', 'stretch', 40, null,null,null,null,true,'beginner','heupen',
 'Lig op je rug, beide knieën gebogen. Leg je enkel over de andere knie zodat een "4" ontstaat.',
 'Pak het onderste been vast en trek het richting je borst tot je de bil van het bovenste been voelt.',
 'Adem uit bij het naar je toe trekken; houd je hoofd en schouders op de grond.',
 'Je hoofd optillen en je nek aanspannen; laat die ontspannen.',
 'Duw de bovenste knie licht weg met je elleboog voor meer opening.',
 'Trek minder ver; of doe de zittende variant op een stoel.',
 'Toegankelijke bilrek, veilig voor bijna iedereen.',
 null),

-- ================= BENEN & ONDERBEEN =================
('Staande quad-stretch', 'stretch', 35, null,null,null,null,true,'beginner','benen',
 'Sta rechtop, houd eventueel een muur vast voor balans.',
 'Pak je enkel en trek je hiel richting je bil, knieën naast elkaar, bekken licht ingetrokken.',
 'Adem rustig; span je bil licht aan om de rek in de voorkant dij te verdiepen.',
 'De knie naar buiten laten wijken; houd hem naast de andere knie.',
 'Duw je heup iets naar voren terwijl je de hiel vasthoudt.',
 'Houd je aan een muur vast en trek minder ver.',
 'Rekt de voorkant van de dij, vaak strak bij zitten en hardlopen.',
 null),

('Hamstring-scharnier', 'stretch', 40, null,null,null,null,false,'beginner','hamstrings',
 'Sta met voeten heupbreed, lichte kniebuiging.',
 'Scharnier vanuit je heupen naar voren met een rechte rug (niet bollen) tot je de achterkant benen voelt. Laat je hoofd zwaar hangen.',
 'Adem uit onderin; bij elke uitademing zak je iets dieper.',
 'De rug bol maken om verder te komen; houd de rug juist lang.',
 'Strek de knieën verder of pak je enkels vast.',
 'Buig de knieën meer of leg je handen op een stoel.',
 'Rekt hamstrings en onderrug, verbetert voorover-scharnieren.',
 '[{"at_pct":0.0,"text":"Rechte rug, scharnier uit de heup"},{"at_pct":0.6,"text":"Hoofd zwaar, adem uit"}]'),

('Kuit-stretch (muur)', 'stretch', 35, null,null,null,null,true,'beginner','kuiten',
 'Plaats beide handen tegen een muur, één voet ver naar achteren, hiel op de grond.',
 'Buig de voorste knie en duw de heup naar de muur, achterste been gestrekt, hiel blijft plat.',
 'Adem rustig door; forceer de hiel niet omlaag.',
 'De achterste hiel laten loskomen; die moet aan de grond blijven.',
 'Buig de achterste knie licht voor de diepere soleus-kuitspier.',
 'Verklein de stap naar achteren.',
 'Houdt enkels en kuiten soepel — belangrijk voor knie en hardlopen.',
 null),

('Enkel-mobilisatie', 'mobility', 40, null,null,null,null,true,'beginner','enkels',
 'Sta in een korte uitval, of kniel met één voet plat voor je.',
 'Duw je knie voorbij je tenen richting de muur terwijl je hiel plat op de grond blijft. Terug en herhaal ritmisch.',
 'Adem rustig, in een kalm ritme mee met de beweging.',
 'De hiel omhoog laten komen; dat haalt de mobilisatie weg.',
 'Vergroot de afstand tot de muur zodat je verder moet reiken.',
 'Doe de beweging kleiner en zonder muur.',
 'Cruciale enkelmobiliteit voor squats, hurken en trappen.',
 '[{"at_pct":0.5,"text":"Hiel blijft plat, knie over de tenen"}]'),

('Pols- en onderarmrek', 'stretch', 30, null,null,null,null,true,'beginner','onderarmen',
 'Strek één arm voor je uit, handpalm naar voren alsof je "stop" zegt.',
 'Trek met je andere hand de vingers zacht naar je toe, dan omgekeerd (palm naar beneden, vingers naar je toe).',
 'Adem rustig; houd de schouder van de gestrekte arm laag.',
 'De elleboog buigen; houd de arm gestrekt voor de volledige rek.',
 'Doe de rek op handen en knieën met palmen op de grond, vingers naar je toe.',
 'Trek minder ver; houd elke kant korter vast.',
 'Tegengif tegen typen en muisgebruik; voorkomt polsklachten.',
 null),

-- ================= KRACHT (bodyweight kern) =================
('Bodyweight squat', 'strength', null, 12, 3, '3-1-1', 60, false,'beginner','benen',
 'Sta met voeten iets breder dan heupbreed, tenen licht naar buiten.',
 'Zak omlaag alsof je op een stoel gaat zitten: gewicht op je hielen, knieën naar buiten, borst omhoog. Kom krachtig omhoog.',
 'Adem in op de weg omlaag, adem krachtig uit terwijl je omhoog duwt.',
 'Knieën die naar binnen vallen; duw ze actief naar buiten.',
 'Pauzeer 2 sec onderin, of houd een halter/gewicht voor je borst.',
 'Zak minder diep of squat naar een stoel.',
 'Fundament voor been- en bilkracht en dagelijkse bewegingen.',
 '[{"at_pct":0.0,"text":"Set van 12 — gewicht op je hielen"},{"at_pct":0.5,"text":"Nog 6, borst hoog"},{"at_pct":0.85,"text":"Laatste paar, duw krachtig"}]'),

('Reverse lunge', 'strength', null, 10, 3, '2-1-1', 60, true,'beginner','benen',
 'Sta rechtop, handen in je zij of voor je borst.',
 'Stap met één been ver naar achteren en zak tot beide knieën ~90° zijn. Duw via de voorste hiel terug omhoog.',
 'Adem in op de weg omlaag, uit op het omhoog komen.',
 'De voorste knie ver voorbij de tenen laten schieten; houd je scheenbeen redelijk verticaal.',
 'Houd halters vast of pauzeer onderin.',
 'Verklein de stap of houd je vast voor balans.',
 'Traint benen één voor één en verbetert balans en stabiliteit.',
 null),

('Glute bridge', 'strength', null, 15, 3, '2-1-2', 45, false,'beginner','bilspieren',
 'Lig op je rug, knieën gebogen, voeten plat en heupbreed, armen langs je lijf.',
 'Duw via je hielen je heupen omhoog tot een rechte lijn van knie tot schouder. Knijp bovenaan je bilspieren.',
 'Adem uit op de weg omhoog, in op de weg omlaag.',
 'Met de onderrug omhoog komen in plaats van met de bilspieren; knijp bewust de billen.',
 'Doe de brug op één been of leg een gewicht op je heupen.',
 'Verklein de hoogte of pauzeer niet bovenaan.',
 'Activeert de bilspieren die "slapen" door veel zitten; ontlast de rug.',
 '[{"at_pct":0.0,"text":"Duw via je hielen, knijp bovenaan"},{"at_pct":0.6,"text":"Nog even — bilspieren doen het werk"}]'),

('Push-up', 'strength', null, 8, 3, '3-1-1', 75, false,'gemiddeld','borst',
 'Handen iets breder dan schouderbreed, lichaam één rechte lijn van hoofd tot hielen.',
 'Zak gecontroleerd tot je borst net boven de grond is, ellebogen ~45° langs je lijf. Duw krachtig terug omhoog.',
 'Adem in op de weg omlaag, uit terwijl je omhoog duwt.',
 'Doorhangende heupen; span je buik en billen aan zodat je een plank blijft.',
 'Voeten verhoogd, of pauzeer 2 sec onderin.',
 'Doe de push-up op je knieën of tegen een verhoging (bank/muur).',
 'Bovenlichaamskracht voor borst, schouders en triceps, plus core-stabiliteit.',
 '[{"at_pct":0.0,"text":"Lichaam als een plank"},{"at_pct":0.5,"text":"Halverwege, blijf strak"},{"at_pct":0.85,"text":"Laatste reps, volledige diepte"}]'),

('Row (band of halter)', 'strength', null, 12, 3, '2-1-2', 60, false,'beginner','rug',
 'Sta in lichte heupscharnier, band onder je voeten of halters in beide handen, rug lang.',
 'Trek eerst je schouderbladen naar elkaar, dan pas de ellebogen langs je lijf naar achteren. Rustig terug.',
 'Adem uit op het trekken, in op het laten zakken.',
 'Alleen met de armen trekken; start de beweging vanuit de schouderbladen.',
 'Zwaardere band/halter of pauzeer 1 sec bovenaan.',
 'Lichtere weerstand; steun met één hand op een bank.',
 'Balanceert alle drukoefeningen en corrigeert een voorover­gebogen houding.',
 null),

('Pike push-up', 'strength', null, 8, 3, '3-1-1', 75, false,'gevorderd','schouders',
 'Vanuit een push-up-positie: loop je voeten in en til je heupen hoog (omgekeerde V).',
 'Zak met je kruin richting de grond door je ellebogen te buigen, duw dan terug omhoog.',
 'Adem in op de weg omlaag, uit op het omhoog duwen.',
 'De rug bollen; houd je heupen hoog en rug lang.',
 'Zet je voeten op een verhoging voor meer belasting.',
 'Doe schouderdrukken met lichte halters in plaats hiervan.',
 'Bouwt schouderkracht op weg naar de handstand-push-up.',
 null),

('Calf raise', 'strength', null, 15, 3, '2-1-2', 45, false,'beginner','kuiten',
 'Sta rechtop, eventueel met tenen op een verhoging en hielen vrij.',
 'Duw jezelf omhoog op je tenen zo hoog mogelijk, pauzeer, en zak langzaam en gecontroleerd terug.',
 'Adem uit op de weg omhoog, in op de weg omlaag.',
 'Snel op en neer stuiteren; de langzame daling doet het werk.',
 'Doe ze op één been of houd een gewicht vast.',
 'Doe beide benen tegelijk zonder verhoging.',
 'Versterkt kuiten en enkels; beschermt tegen blessures bij lopen en springen.',
 null),

-- ================= CORE & STABILITEIT =================
('Plank', 'strength', 45, null, 3, null, 45, false,'beginner','core',
 'Onderarmen op de grond, ellebogen onder je schouders, voeten heupbreed.',
 'Vorm één rechte lijn van hoofd tot hielen. Span buik en billen aan en blijf ademen.',
 'Blijf rustig doorademen — houd je adem niet in.',
 'Heupen te hoog of doorgezakt; mik op een strakke rechte lijn.',
 'Til afwisselend een voet een paar cm op, of verleng de tijd.',
 'Doe de plank op je knieën of tegen een verhoging.',
 'Traint de hele core om je wervelkolom te stabiliseren.',
 '[{"at_pct":0.0,"text":"Rechte lijn — buik en billen aan"},{"at_pct":0.5,"text":"Halverwege, blijf ademen"},{"at_pct":0.85,"text":"Nog 7 seconden, blijf strak"}]'),

('Side plank', 'strength', 30, null, 3, null, 30, true,'gemiddeld','core',
 'Lig op je zij, onderarm onder je schouder, benen gestrekt en gestapeld.',
 'Duw je heup omhoog tot een rechte lijn van hoofd tot voeten. Bovenste arm omhoog of in de zij.',
 'Adem rustig door; laat de heup niet zakken op de inademing.',
 'De heup laten hangen; duw hem actief richting het plafond.',
 'Til je bovenste been op of houd langer vast.',
 'Zet je onderste knie op de grond als steunpunt.',
 'Traint de zijkant van de core (obliques) en heupstabiliteit.',
 null),

('Dead bug', 'strength', null, 10, 3, null, 45, false,'beginner','core',
 'Lig op je rug, armen recht omhoog, knieën boven je heupen in 90°.',
 'Strek langzaam je rechterarm naar achteren en je linkerbeen naar voren, zonder je onderrug van de grond te laten komen. Terug en wissel.',
 'Adem uit terwijl je arm en been strekt, in bij het terugkomen.',
 'De onderrug laten hollen; druk je lage rug bewust in de grond.',
 'Vertraag de beweging of houd een lichte weerstand vast.',
 'Beweeg alleen de benen (of alleen de armen) tot je de coördinatie hebt.',
 'Leert je core spannen terwijl ledematen bewegen — beschermt de rug.',
 null),

('Bird dog', 'strength', null, 10, 3, null, 45, true,'beginner','core',
 'Op handen en knieën, rug neutraal, buik licht aangespannen.',
 'Strek tegelijk je rechterarm naar voren en je linkerbeen naar achteren tot één lijn. Pauzeer, kom terug, wissel.',
 'Adem uit op het uitstrekken, in op het terugkomen.',
 'De rug laten draaien of doorzakken; houd je bekken vlak (alsof er een glas water op je rug staat).',
 'Pauzeer 2 sec op het eindpunt of tik elleboog-en-knie samen tussendoor.',
 'Beweeg alleen een arm of alleen een been.',
 'Traint rugstabiliteit en coördinatie tussen boven- en onderlichaam.',
 null),

('Hollow hold', 'strength', 25, null, 3, null, 45, false,'gevorderd','core',
 'Lig op je rug, armen boven je hoofd, benen gestrekt.',
 'Til schouderbladen en benen net van de grond zodat je lichaam een ondiepe banaan vormt. Onderrug blijft tegen de grond.',
 'Adem oppervlakkig maar blijf doorademen; span je buik hard aan.',
 'De onderrug laat loskomen; buig je knieën of zak lager als dat gebeurt.',
 'Strek armen en benen verder uit voor een langere hefboom.',
 'Buig je knieën en houd je armen langs je lijf.',
 'Bouwt diepe, atletische core-spanning op.',
 null),

('Superman', 'strength', null, 12, 3, '2-2-1', 45, false,'beginner','rug',
 'Lig op je buik, armen naar voren gestrekt, benen lang.',
 'Til tegelijk armen, borst en benen van de grond, knijp je bilspieren, en zak gecontroleerd terug.',
 'Adem uit op het optillen, in op het zakken.',
 'De nek in je nek gooien; kijk naar de grond zodat je nek lang blijft.',
 'Houd 2 sec vast bovenaan of gebruik lichte gewichtjes.',
 'Til alleen de armen, of alleen de benen.',
 'Versterkt de hele achterste keten — tegenwicht voor al het zitten.',
 null);

/* ---------- 3. Gestructureerde programma's ---------- */
insert into routines (name, kind, description, duration_min, level, moment) values
 ('Ochtend-mobiliteit', 'stretch',
  'Word soepel wakker: 8 minuten om je wervelkolom, heupen en schouders te openen voordat de dag begint.',
  8, 'beginner', 'ochtend'),
 ('Bureau-reset', 'stretch',
  'Vijf minuten tegen de schermhouding: nek, borst, bovenrug en polsen. Perfect tussen twee werkblokken.',
  5, 'beginner', 'desk'),
 ('Volledige stretch & unwind', 'stretch',
  'Twintig minuten avondroutine van hoofd tot tenen om spanning los te laten en beter te slapen.',
  20, 'beginner', 'avond'),
 ('Full-body kracht A (duw)', 'workout',
  'Krachtcircuit met nadruk op benen, borst en core. 3 rondes. Duw-patroon.',
  30, 'gemiddeld', 'training'),
 ('Full-body kracht B (trek)', 'workout',
  'Krachtcircuit met nadruk op rug, bilspieren en schouders. 3 rondes. Trek-patroon.',
  30, 'gemiddeld', 'training'),
 ('Core & stabiliteit', 'workout',
  'Twaalf minuten gerichte core: anti-extensie, anti-rotatie en achterste keten.',
  12, 'beginner', 'any');

/* ---------- 4. Programma-inhoud (volgorde, tijd, rust) ---------- */
-- [aanvulling Claude] expliciete posities: de oorspronkelijke
-- row_number()-lateral gaf altijd 1 terug (PK-conflict) en de eerste
-- insert verwees naar een niet-bestaande kolom v.pos.

-- Ochtend-mobiliteit
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Cat-cow',60,null,null,10),
  (2,'Schouder-cirkels',40,null,null,10),
  (3,'Thoracale rotatie (open book)',40,null,null,10),
  (4,'Heupflexor-lunge',45,null,null,10),
  (5,'Hamstring-scharnier',40,null,null,10),
  (6,'90/90 heupwissel',50,null,null,10),
  (7,'Enkel-mobilisatie',40,null,null,10)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Ochtend-mobiliteit'
join exercises e on e.name=v.name;

-- Bureau-reset
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Nek-rol',40,null,null,8),
  (2,'Nek-zijkant (levator)',30,null,null,8),
  (3,'Borst-opener deurpost',35,null,null,8),
  (4,'Thoracale rotatie (open book)',40,null,null,8),
  (5,'Pols- en onderarmrek',30,null,null,8)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Bureau-reset'
join exercises e on e.name=v.name;

-- Volledige stretch & unwind
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Nek-rol',40,null,null,10),
  (2,'Schouder-cirkels',40,null,null,10),
  (3,'Borst-opener deurpost',35,null,null,10),
  (4,'Cat-cow',60,null,null,10),
  (5,'Kind-houding',60,null,null,10),
  (6,'Staande quad-stretch',35,null,null,10),
  (7,'Hamstring-scharnier',40,null,null,10),
  (8,'Heupflexor-lunge',45,null,null,10),
  (9,'Pigeon (duif)',50,null,null,10),
  (10,'Figure-4 (glute)',40,null,null,10),
  (11,'Kuit-stretch (muur)',35,null,null,10),
  (12,'Supine spinal twist',40,null,null,10)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Volledige stretch & unwind'
join exercises e on e.name=v.name;

-- Full-body kracht A (duw)
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Bodyweight squat',null,12,3,60),
  (2,'Push-up',null,8,3,75),
  (3,'Reverse lunge',null,10,3,60),
  (4,'Pike push-up',null,8,3,75),
  (5,'Plank',45,null,3,45),
  (6,'Calf raise',null,15,3,45)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Full-body kracht A (duw)'
join exercises e on e.name=v.name;

-- Full-body kracht B (trek)
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Glute bridge',null,15,3,45),
  (2,'Row (band of halter)',null,12,3,60),
  (3,'Reverse lunge',null,10,3,60),
  (4,'Superman',null,12,3,45),
  (5,'Side plank',30,null,3,30),
  (6,'Bird dog',null,10,3,45)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Full-body kracht B (trek)'
join exercises e on e.name=v.name;

-- Core & stabiliteit
insert into routine_exercises (routine_id, exercise_id, position, secs, reps, sets, rest_secs)
select r.id, e.id, v.pos, v.secs::int, v.reps::int, v.sets::int, v.rest::int
from (values
  (1,'Dead bug',null,10,3,40),
  (2,'Bird dog',null,10,3,40),
  (3,'Plank',45,null,3,45),
  (4,'Side plank',30,null,3,30),
  (5,'Hollow hold',25,null,3,45),
  (6,'Superman',null,12,3,40)
) as v(pos, name, secs, reps, sets, rest)
join routines r on r.name='Core & stabiliteit'
join exercises e on e.name=v.name;

/* ---------- 5. [aanvulling Claude] RLS voor gedeelde programma's ---------- */
-- De programma's hierboven hebben user_id NULL (gedeelde content). De
-- bestaande "Eigen routines"-policies zien die niet; maak ze leesbaar.
create policy "Programma's lezen" on routines
  for select to authenticated using (user_id is null);
create policy "Programma-oefeningen lezen" on routine_exercises
  for select to authenticated using (exists (
    select 1 from routines r where r.id = routine_id and r.user_id is null
  ));
