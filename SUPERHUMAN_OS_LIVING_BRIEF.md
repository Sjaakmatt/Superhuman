# Superhuman OS — Volledige Briefing: het OS tot leven brengen

Deze briefing bouwt bovenop de bestaande repo. Doel: het OS voelt nu als "aftikken en klaar".
We geven het een **zenuwstelsel** (momentum dat je opbouwt én verliest, een core die zichtbaar
evolueert, een spiegel die je gedrag terugkaatst) én we maken **elk onderdeel** — stretchen,
sporten, ademen, voeding — echt begeleid: duidelijk welke oefening, hoe lang, wanneer vasthouden,
wanneer wisselen, wanneer rusten, en wat je op dít moment van de dag moet doen.

**Bronbestanden (gebruik als waarheid voor gevoel en inhoud):**
- `reference/LivingOS.jsx` — het gevoels-prototype van de levende laag (core, momentum-cellen,
  evolutie-ceremonie, spiegel). Neem deze mechaniek en visuele taal over.
- `reference/SuperhumanOS.jsx` — de dagelijkse flow en design-tokens.
- `supabase/migrations/002_exercise_content.sql` — de rijke oefeningen + programma's + coaching-cues.

**Werkwijze:** bouw in de fasen L1–L7 (sectie 8), commit per fase, stop na elke fase voor akkoord.
Vervang dode schermen; bouw geen parallelle nieuwe app.

---

## 1. De levende laag — het model

Twee soorten "waarde", en het onderscheid is de hele ziel:

- **XP / level = wie je geworden bent.** Blijvend. Verdiend door acties. Voedt je rank en de
  evolutie van de core. Zakt alleen langzaam bij langdurige verwaarlozing (verval).
- **Momentum = je huidige levenspuls.** Vluchtig, 0–100 per attribuut. Springt omhoog als je een
  attribuut voedt, en **zakt elke dag** als je het laat liggen. Dit is de inzet: je kunt iets
  verliezen. Momentum stuurt hoe levendig de core en de cellen *ademen*.

**Voeden** = elke gelogde actie die bij een attribuut hoort (stretch-sessie → `soepel`,
kracht-workout → `kracht`, meditatie/breathwork/journal → `geest`, voeding-check-in → `voeding`,
water/slaap → `vitaliteit`, deep work/routine → `focus`).

Constants (begin hiermee, maak later instelbaar): `FEED_XP = 24`, `FEED_MOM = 34`,
`DECAY = 17`/dag, `VERVAL_XP = 12` (bij ≥2 dagen op 0 momentum).

---

## 2. Datamodel — levende laag

Zie `supabase/migrations/20260714000009_living_layer.sql` (momentum/idle_days op
`user_attributes`, `evolution_stages` + seed, `profiles.last_stage`/`last_decay_on`,
`schedule_blocks` + RLS).

**Thresholds zijn per *totaal*-XP (som over 6 attributen):** Sluimerend 0 · Ontwakend 600 ·
Gedisciplineerd 1800 · Onverzettelijk 3600 · Superhuman 6000.

---

## 3. XP + momentum + verval (de mechaniek)

**Bij loggen** — `award_xp` is één transactie: xp + level-curve (bestaand), momentum
`min(100, +34)`, `idle_days = 0`, xp_event, en stage-detectie op totaal-XP: komt de
stage-ordinal boven `profiles.last_stage` → `new_stage` in het resultaat (frontend toont
ceremonie en bevestigt via `ack_stage`).

**Nachtelijk (pg_cron, per gebruiker-tijdzone):** voor elk attribuut zonder xp_event op de
afgesloten dag: `momentum = max(0, momentum - 17)`, `idle_days += 1`; bij `momentum <= 0` en
`idle_days >= 2`: `xp = max(0, xp - 12)` (zacht verval). Nooit onder 0, nooit een level onder 1.

**Vitaliteit** (voor de core) = gemiddelde momentum / 100 over de 6 attributen.

---

## 4. De core + de ceremonie

Gebruik de `Core`-component uit `LivingOS.jsx` als basis:
- Vorm/deeltjes/gloed komen uit de huidige `evolution_stages`-rij.
- Ademsnelheid en helderheid schalen met **vitaliteit** (levendig = sneller, feller; laag =
  trager, ontzadigd).
- Op de home bovenaan met een voortgangsbalk "… XP tot {volgende stage}" en één **state-regel**
  die de toestand benoemt ("Je systeem gloeit." / "Er zakt her en der iets weg." / "Veel
  sluimert — voed jezelf terug tot leven.").

**Evolutie-ceremonie:** wanneer `total_xp` een nieuwe stage passeert, toon een full-screen moment
(zoals in het prototype): "EVOLUTIE", de morphende core, de nieuwe rank + `line`, knop "Verder".
Werk daarna `profiles.last_stage` bij. Dit is het moment dat groei *voelbaar* maakt — bouw het niet
weg als een toast.

---

## 5. De spiegel — inzicht dat leeft

Server-functie `getReflections(userId)` → 2 gerankte regels, berekend uit echte data (niet
verzonnen). Regels en prioriteit (hoog wint):

- **Verval-alarm (p≈4):** momentum `<= 0` en xp>0 → "{label} is uitgedoofd — voortgang begint te
  vervallen."
- **Drempel dichtbij (p≈3.5):** `< 90 XP` tot volgende stage → "Nog {n} XP tot {stage}. Je staat op
  de drempel."
- **Dim-waarschuwing (p≈3):** momentum `< 22` → "{label} dimt. Nog een dag zonder aandacht en het
  zakt terug."
- **Opbouw-streak (p≈2):** ≥2 dagen op rij gevoed → "Je voedt {label} {n} dagen op rij. Er wordt
  iets opgebouwd."
- **Vitaliteit-stemming (p≈1–1.5):** hoog → "Bijna alles krijgt aandacht. Zo voelt momentum.";
  laag → "Het meeste sluimert. Kies één cel en begin klein."
- **Cross-domein patroon (p≈0.8, na ≥5 dagen data):** bereken een *echt* verband uit de logs, bv.
  "Op dagen dat je beweegt scoort je Geest gemiddeld {x} hoger." (Correleer `xp_events` van
  `soepel`/`kracht` met `journal_entries.mood` of met de dag-completion.)

Toon de spiegel prominent op de home, met een gekleurde rand per regel. Dit is de "stem" van het
OS zonder chatbot.

---

## 6. Leven bínnen de onderdelen (sturing + hou vast)

Kernregel voor alles hieronder: **de app vertelt altijd wat je nú doet, hoe lang, en wat de
volgende stap is.** Nooit een stille timer. Elke afgeronde sessie voedt het bijbehorende attribuut
via `awardXp`.

### 6.1 Stretchen & mobiliteit — begeleide sessie
State machine per oefening (data uit `002_exercise_content.sql`):
```
INTRO   2s  Naam + setup-tekst ("Kniel in een uitval, achterste knie op de grond").
COUNT-IN 3s  Grote 3-2-1 ("Klaar? 3… 2… 1…").
HOLD    n   Grote afteltimer + label "HOUD VAST" + ademindicator (pulserende bol 4-6s)
            + getimede cues uit coaching_cues; bij leeg → defaults:
              start = uitvoerings-cue, 50% = ademcue, laatste 10s = "Nog 10 seconden,
              blijf zacht", laatste 3s = "3… 2… 1… los".
REST    r   "Rust {r}s · volgende: {oefening}" met mini-preview.
```
Bilateraal (`bilateral=true`): draai HOLD twee keer met "Wissel van kant" ertussen. Programma's
zijn al geseed met volgorde + tijd + rust (Ochtend-mobiliteit, Bureau-reset, Volledige stretch &
unwind). Overslaan mag, zonder straf.

### 6.2 Sporten / kracht — sets, reps, tempo, rust
- Toon per oefening: **doel-reps × sets**, **tempo** met uitleg ("3-1-1 = 3 tellen zakken, 1 pauze,
  1 omhoog"), de uitvoerings-cue en de veelgemaakte fout als hint.
- Na elke set een **rust-timer met aftelling** ("Rust 60s · volgende: Set 2 van 3") en een
  "Klaar ✓"-knop — geen dwangtimer op de set zelf.
- **Progressive overload:** toon "vorige keer: {reps/gewicht}" en stel een concreet doel voor
  ("mik op +1 rep of zwaarder"). Log per set in `workout_logs` (breid uit met set/reps/weight-jsonb).
- Form-cues halverwege een set ("borst hoog", "knieën naar buiten") via dezelfde cue-timing.

### 6.3 Ademen / breathwork — echte begeleiding
- Kies een patroon met een **doel** (energie / kalmte / slaap), niet alleen een naam. Patronen al
  geseed (4-7-8, box, coherent 5.5).
- Ademende bol synchroon met de fase; toon de **telling** ("Adem in… 2, 3, 4 — Houd… 2, 3…") in
  tekst én optioneel stem. Rondes-teller ("Ronde 3 van 4").
- Settle-in (10s "kom tot rust, laat je schouders zakken") en een zachte afsluiting ("blijf nog even
  zitten"). Voedt `geest`.

### 6.4 Voeding — tijd, structuur, sturing (nu het leegst)
Maak er een begeleide dag van in plaats van een ja/nee-vinkje:
- **Maaltijd-tijdlijn met vensters:** ontbijt, lunch, snack, diner met een **richttijd** en de
  gekoppelde recepten uit `meal_plan`/`recipes`. Toon "nu / straks / gehad".
- **Tijd-gebonden sturing:** de app duwt op het juiste moment ("15:00 — tijd voor je eiwitrijke
  snack: {recept}", "Diner-venster sluit om 20:00").
- **Check-in blijft:** "Voldaan aan je voeding?" ja/nee + gevoel + notitie → voedt `voeding`.
- **Hydratatie over de dag:** water-doel verdeeld in vensters met nudges.
- **Boodschappenlijst** auto-gegenereerd uit het weekplan (bestaand).
- **Toon principes als coaching, gezond en niet-restrictief:** eiwit bij elke maaltijd, eet binnen
  je vensters, hydrateer — nooit als streng calorie-straf-budget.

Voeg toe waar nodig:
```sql
alter table meal_plan add column if not exists target_min int;      -- richttijd (min na middernacht)
alter table recipes   add column if not exists prep_min int;
alter table workout_logs add column if not exists sets jsonb;        -- [{set,reps,weight}]
```

---

## 7. Tijd-van-de-dag orkestratie — de "Nu"-motor

De home heeft bovenaan een **"Nu"-kaart** die op basis van de klok + wat nog niet gedaan is, het
juiste blok voorstelt uit `schedule_blocks`:

- **Ochtend-activatie** (07:30): Ochtend-mobiliteit → breathwork → intentie/journal.
- **Overdag:** water-nudges, beweeg-herinnering bij lang zitten, deep-work-blokken (focus).
- **Middag:** eiwitsnack-venster, korte Bureau-reset.
- **Avond:** training óf Volledige stretch & unwind; meditatie; en de **landing** (avond-review).
- **Wekelijkse review** als vast blok (voorgevuld met data — bestaand).

Seed een standaard-dagritme bij onboarding; laat de gebruiker het aanpassen. Koppel `reminders`
(web-push) aan de blokken. De "Nu"-kaart toont één primaire actie + "straks"-preview.

---

## 8. Bouwfasen (roadmap)

- **L1 — Levende laag datamodel:** migratie sectie 2, `awardXp` upgrade (momentum + stage-detectie),
  nachtelijke decay-job, verval. Seed `evolution_stages`.
- **L2 — Levende core + ceremonie:** `Core` reflecteert vitaliteit + stage; home-hero met core,
  momentum-cellen, state-regel; evolutie-ceremonie bij drempel.
- **L3 — De spiegel:** `getReflections` + UI op de home.
- **L4 — Sessie-diepte (stretch/kracht/ademen):** state machine met HOLD/COUNT-IN/REST, getimede
  cues, ademindicator, rust-timers, tempo-uitleg, progressive overload.
- **L5 — Voeding tot leven:** maaltijd-tijdlijn met vensters + richttijden, tijd-gebonden nudges,
  hydratatie-vensters.
- **L6 — "Nu"-motor + dagritme:** `schedule_blocks`, home "Nu"-kaart, gekoppelde reminders/web-push.
- **L7 — Levende copy + zintuigen:** herschrijf alle teksten als een stem (sectie 9), zachte
  geluiden/haptics en microanimaties, polish, reduced-motion.

---

## 9. Levende copy (belangrijk — dit doodt of leeft een app)

- Schrijf in de **tegenwoordige tijd, observerend, warm**. Niet "Voeding: voltooid" maar
  "Je voeding zat goed vandaag — dat straalt af op morgen."
- **Lege staten nodigen uit:** "Nog niets gevoed vandaag. Kies één ding en begin."
- **Winst wordt gevierd**, kort en echt: "Vijf dagen Soepelheid op rij. Je lichaam onthoudt dit."
- **Missers met compassie, nooit schaamte:** "Soepelheid rust uit. Voed het als je er klaar voor
  bent." Geen rode "streak verbroken".
- **Sturing is concreet:** "Houd vast — nog 10 seconden." / "Rust 60s, dan set 2." /
  "15:00: tijd voor je snack." Altijd wat, hoe lang, en wat nu.

---

## 10. Definitie van "af"

Het OS leeft als: de home nooit een dood dashboard is maar altijd een **volgende stap** en een
**spiegel** toont; acties **voelbaar gevolg** hebben (momentum stijgt, cellen ademen op,
verwaarlozing dimt); groei **zichtbaar transformeert** (core-evolutie + ceremonie); en elke sessie
je **stuurt en vasthoudt**. Geen enkel onderdeel voelt nog als aftikken-en-klaar.
