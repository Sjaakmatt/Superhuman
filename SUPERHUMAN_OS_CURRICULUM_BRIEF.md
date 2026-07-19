# Superhuman OS — Curriculum-brief (gated leerlijnen)

Diepgaand, fijnmazig, **gated** progressie-curriculum voor vier domeinen:
**calisthenics/bodyweight**, **mobiliteit**, **meditatie** en **ademwerk**. Elk
niveau ontgrendelt pas als het vorige meetbaar "af" is; de moeilijkheid loopt op
naarmate je vordert. Media = **gecureerde externe video/audio** (Engelstalig mag;
app-copy blijft Nederlands). Onderzoek per domein: juli 2026, met geverifieerde
bronnen (zie per hoofdstuk).

> **Status:** onderzoek af voor alle vier de domeinen. **Ademwerk** wordt als
> eerste volledig gebouwd (proof-of-concept, rond *Breathe With Sandy*). De
> andere drie volgen gefaseerd (§7).

---

## 1. Gedeeld gating-model

Eén model voor alle domeinen, generalisatie van de bestaande calisthenics-ladders
(`movement_patterns` → `ladder_exercises` → `user_ladder_state`).

**Kernbegrippen**
- **Spoor (track):** een reeks niveaus richting één einddoel (bv. "verticaal
  trekken", "diepe hurk→pancake", "meditatie-hoofdpad", "ademwerk-leerlijn").
- **Niveau (level):** één trede met coaching + prescriptie + **ontgrendel-criterium**.
- **Ontgrendeling:** het volgende niveau is **vergrendeld** tot het criterium van
  het huidige is gehaald. Twee soorten criteria:
  - **Prestatie-poort** (kracht/mobiliteit): meetbaar bereik/reps/houdtijd met
    schone vorm + tempo — bevestigd via de sessie-logger. Sluit aan op de
    bestaande `metStreak >= 2` (twee sessies op rij het criterium halen → promotie).
  - **Consistentie-poort** (meditatie/ademwerk): X sessies × Y duur gelogd,
    soms met een zelfrapportage-check of een meting (BOLT bij ademwerk).
- **Geen streak-shame:** toon "nog 2 sessies tot ontgrendeld", nooit rood/falen.
  Een niveau blijft altijd toegankelijk als oefenmodus; terugvallen mag.
- **Kalibratie-instap:** nieuwe gebruikers doen per spoor een korte instaptest en
  starten direct op de juiste trede (niet altijd niveau 1).

**Datamodel (voorstel, generiek)**
```
curriculum_tracks   (id, domain, key, label, category, goal, blurb, sort)
curriculum_levels   (id, track_id, level, slug, name, one_liner,
                     setup[], execution[], breathing, mistakes[],
                     prescription, unlock_kind, unlock_spec jsonb,
                     media jsonb[], safety, is_locked_default)
user_level_state    (user_id, track_id, current_level, met_streak,
                     sessions_at_level, unlocked_max_level, updated_at)
curriculum_sessions (id, user_id, level_id, logged_value jsonb, met bool, date)
```
De bestaande calisthenics-tabellen kunnen hierin opgaan of ernaast blijven bestaan
(kracht is al gated); meditatie/ademwerk/mobiliteit zijn nieuw. Voor de ademwerk-PoC
kiezen we een pragmatische, domein-eigen tabelset die later generaliseert.

**XP/momentum:** blijft op de achtergrond via `award_xp` (de gevoelde beloning is de
*ontgrendeling*, niet XP). Ademwerk voedt **geest**, meditatie **geest**,
mobiliteit **soepel**, calisthenics **kracht** — eerste sessie per dag.

---

## 2. Media, in-app kijken & casten

- **Bron:** gecureerde externe links (YouTube/Vimeo + audio-mp3's). Engelstalig is
  prima; de app-coaching blijft Nederlands.
- **In-app bekijken:** embedded speler (YouTube/Vimeo-iframe, HTML5-audio) in een
  sessie-scherm. Mits de eigenaar embedden toestaat; anders link-out of alternatief.
- **Casten naar Chromecast:**
  - **Android / Chrome-desktop:** werkt. YouTube-embeds tonen zelf een cast-knop;
    voor audio/eigen media kan de Google Cast SDK worden ingebouwd.
  - **iPhone/iPad (PWA):** **Google Cast wordt niet ondersteund door iOS/Safari.**
    Op de iPhone: **in-app bekijken + AirPlay** (naar Apple TV via de native
    videocontrols), of Chromecast via de losse YouTube-app. Dit is een
    Apple-platformbeperking, geen app-keuze.
- **Besluit:** standaard **embedded spelers**; casting erft van het platform.
  Custom Cast-SDK alleen als de gebruiker primair op Android/desktop zit.
- **Linkonderhoud:** alle YouTube-ID's vóór livegang één keer handmatig checken
  (YouTube blokkeerde geautomatiseerde fetch tijdens onderzoek; links komen uit
  live zoekresultaten met kloppende titels). Sla per media-item `provider`,
  `url`, `title`, `source` op zodat vervangen makkelijk is.

---

## 3. Domein — Ademwerk (Breathe With Sandy) · **PoC, volledig**

**Facilitator:** *Breathe With Sandy* — breathwork-facilitator + muzikant
(YouTube @BreatheWithSandy, breathewithsandy.com, app met 350+ sessies filterbaar op
lengte/stijl/retentie, Patreon, Spotify). Methode = **Functional Breathing +
Pranayama + Transformational Breathwork** (ronden actieve verbonden ademhaling +
retentie op zelf geproduceerde muziek). Sandy leert **geen** Wim Hof/Buteyko/CO₂-
tafels expliciet → daarvoor McKeown/Huberman/Wim Hof als onderbouwing, Sandy's
sessies als warme wrapper.

**CO₂-fundament (BOLT / Control Pause):** zit, adem rustig, neem na een *normale*
uitademing de neus dicht, stop bij de **eerste ademdrang** (niet je max).
Richtlijn: <10s laag · 10–20s matig · 20–30s goed · 40s ideaal. Dit getal is de
**veiligheidspoort** naar de zware niveaus.

| # | Niveau | Cadans / duur | Ontgrendel-criterium | Primaire media |
|---|--------|---------------|----------------------|----------------|
| 1 | Neus- & middenrifademhaling | ~4s in/6s uit · 5 min | 5 sessies | Sandy — [Simplest Breathwork to Release Stress (5m)](https://www.youtube.com/watch?v=VIs2f8Eq7nQ) |
| 2 | Adembewustzijn + BOLT-nulmeting | meting + 5 min rust | 3 BOLT-metingen gelogd | [Oxygen Advantage / McKeown](https://oxygenadvantage.com/) |
| 3 | Verlengde uitademing / 4-7-8 | 4-7-8 · 4 cycli | 5 sessies | Sandy — [10m Morning Without Anxiety](https://www.youtube.com/watch?v=8mTPLwEE9vU) · [Dr. Weil 4-7-8](https://www.drweil.com/health-wellness/body-mind-spirit/stress-anxiety/three-breathing-exercises-and-techniques/) |
| 4 | Box breathing | 4-4-4-4 · 4 min | 5 sessies | Sandy — [Chill Out in 5m — Box Breathing](https://www.youtube.com/watch?v=4aYaIINUgck) |
| 5 | Coherente ademhaling ~5,5/min | 5,5-5,5 · 10 min | 5 sessies *(telt mee voor N10-12)* | Sandy — [10m Nervous System Reset](https://www.youtube.com/watch?v=NutFAFeEfoM) |
| 6 | Physiological sigh / cyclisch zuchten | dubbele in, lange uit · 5 min | 3 sessies | [Huberman](https://www.hubermanlab.com/newsletter/breathwork-protocols-for-health-focus-stress) · [Stanford](https://stanmed.stanford.edu/cyclic-sighing-stress-relief/) |
| 7 | Nadi shodhana (Pranayama) | 4/4 per zijde · 10 min | 5 sessies | Sandy — [Online Program](https://www.breathewithsandy.com/online-program) · [Healthline](https://www.healthline.com/health/alternate-nostril-breathing) |
| 8 | 🔒-brug Buteyko / CO₂-opbouw | licht ademtekort · 10 min | **BOLT ≥ 20s** (2×) + 8 sessies | [Oxygen Advantage](https://oxygenadvantage.com/) |
| 9 | 🔒 Ademhoud / CO₂-O₂-tafels | 1 tafel · 15–20 min | vrij door N8; 6 tafels voor N10 | [BreathHold — CO₂-tolerantie](https://breathhold.co/resources/how-to-train-co2-tolerance) |
| 10 | 🔒 Sandy transformationeel — instap | 3 rounds · ~15 min | N8 + **10× coherent (N5)** | **Sandy — [Release Stuck Energy 15m, 3 Rounds](https://www.youtube.com/watch?v=O4d7u7SikyA)** |
| 11 | 🔒 Wim Hof-methode | 30–40 breaths × 3–4 rounds | 5× N10 + N8 | [WHM officieel](https://www.wimhofmethod.com/breathing-exercises) · [Guided WHM](https://www.youtube.com/watch?v=tybOi4hjZFQ) |
| 12 | 🔒 Sandy diepe journey (zwaarst) | 30 min, 4 rounds (12a/b/c) | 10× N5 + N8 + 5× N10 + per subniveau 3× | **Sandy — [30m Gratitude Breathwork 4 Rounds (Patreon)](https://www.patreon.com/posts/30-minute-i-4-129173163)** |

**Coaching per niveau** (setup/execution/breathing/mistakes) staat in het
onderzoek en wordt volledig in de seed opgenomen. Kern: N1–7 zijn veilig voor
iedereen; N8 is de brug; N9–12 zijn 🔒 achter de CO₂-poort + gelogde-sessie-drempels,
met een **verplichte contra-indicatie-check** vóór N12.

**Veiligheid (prominent, vóór N9–12):** nooit in/bij water of tijdens rijden;
altijd liggen/zitten; tetanie/tintelingen zijn normaal, stop bij pijn op de borst/
paniek. **Contra-indicaties:** zwangerschap, hart-/vaatziekten, hoge bloeddruk,
epilepsie/aanvallen, beroerte/aneurysma, glaucoom, ernstige astma, diabetes,
recente operatie, ernstige psychische aandoeningen (psychose, bipolair, ernstig
trauma/PTSS). Zwaarste journeys bij voorkeur onder begeleiding.

**Sandy-platforms:** [YouTube](https://www.youtube.com/@BreatheWithSandy) ·
[website](https://www.breathewithsandy.com/) ·
[5–10 min playlist](https://www.youtube.com/playlist?list=PLBecXMryivYuFTdanZRycTHKsK9wzG5I7) ·
[15–20 min playlist](https://www.youtube.com/playlist?list=PLBecXMryivYsO-qTkTUwh9XHRxAdlzGYR) ·
[Patreon](https://www.patreon.com/breathewithsandy).

---

## 4. Domein — Calisthenics / bodyweight · 8 ladders × ~12 niveaus

Breidt de bestaande `ladder_exercises` uit (migratie `..015/..016`). Globale regel:
haal je de bovengrens met schone vorm + voorgeschreven tempo → niveau "af"; het
volgende niveau start op de ondergrens. Tempo = `ecc-pauze-conc-pauze` (s). Bronnen:
r/bodyweightfitness *Recommended Routine*, Steven Low *Overcoming Gravity*, Hampton
*Hybrid Calisthenics*, Daniel Vadnal *FitnessFAQs*, *GMB*, *School of Calisthenics*.

**Sporen & einddoelen (12 niveaus elk, tenzij anders):**
1. **Verticaal trekken** — dode hang → pull-up → one-arm pull-up. Media: [Hybrid — Pullups](https://www.hybridcalisthenics.com/pullups) · [FitnessFAQs](https://www.youtube.com/@FitnessFAQs) · [One-arm tutorial](https://www.youtube.com/watch?v=mTJHClMQPM8).
2. **Horizontaal trekken** — rijen → front lever. Media: [FitnessFAQs Front Lever playlist](https://www.youtube.com/playlist?list=PLUbxKyT1Sc-AKizV80aDX8nFoPrLWmv4L).
3. **Verticaal duwen** — pike push-up → handstand push-up. Media: [FitnessFAQs HSPU playlist](https://www.youtube.com/playlist?list=PLneN1jscrwJn3c653XEOJJn-bldpjusje) · [GMB HSPU](https://gmb.io/handstand-push-up/).
4. **Horizontaal duwen** — incline push-up → planche. Media: [Hybrid — Pushups](https://www.hybridcalisthenics.com/pushups) · [FitnessFAQs Planche](https://www.youtube.com/watch?v=TZ63httkob4).
5. **Benen knie-dominant** — squat → pistol → shrimp. Media: [Hybrid — Squats](https://www.hybridcalisthenics.com/squats) · [School of Calisthenics — Pistol](https://www.youtube.com/watch?v=hHxm3VbuS-w).
6. **Benen heup-dominant** — glute bridge → nordic curl → single-leg. Media: [Hybrid — Bridges](https://www.hybridcalisthenics.com/bridges) · [Nordic Curl](https://www.youtube.com/watch?v=dJ8LBl3U85g).
7. **Core** — dead bug/plank → hollow body → L-sit → dragon flag. Media: [GMB Hollow Body](https://gmb.io/hollow-body/) · [GMB L-sit](https://gmb.io/l-sit/) · [Dragon Flag](https://www.youtube.com/watch?v=At0mMAHqWrQ).
8. **Skills** (optioneel) — 8a handstand-balans (7 niveaus, [GMB Handstand](https://gmb.io/handstand/)), 8b muscle-up (7 niveaus, [Muscle-Up guide](https://www.youtube.com/watch?v=-t18aZngQeU)).

De volledige per-niveau tabellen (naam NL/EN, prescriptie, ontgrendel-criterium,
per-patroon how-to met opzet/uitvoering/ademhaling/fouten) staan in het onderzoek en
worden bij de bouw van dit domein in de seed opgenomen. Voorbeeld (verticaal trekken):
dode hang (1×60s) → scapula-hang → horizontale rij → jackknife → negatief (3×5, 5s
ecc) → volle pull-up (3×8) → volume/weighted → archer → één-arm-negatief → assisted
OAP → **one-arm pull-up** (2×3/kant) → OAP-clusters.

---

## 5. Domein — Mobiliteit · 7 sporen × 10 niveaus

Nieuw domein. Elk spoor eindigt in **actieve controle op eindbereik** (CARs,
PAILs/RAILs, loaded stretching) — niet alleen passief rekken. Doseren 4–6×/week
(frequentie > intensiteit). Bronnen: Tom Merrick (Bodyweight Warrior), Kit Laughlin
(Stretch Therapy), GMB Focused Flexibility, Emmet Louis, FRC (CARs/PAILs-RAILs).

**Sporen & einddoelen (10 niveaus elk):**
1. **Heupflexie / diepe hurk → pancake** — [GMB Squat](https://gmb.io/squat/) · [Tom Merrick Pancake](https://www.youtube.com/watch?v=gk4FjX1Jjb4).
2. **Spagaat (front split → hanumanasana)** — [Tom Merrick Unlock Front Split](https://www.youtube.com/watch?v=LO0zKjr-R6Q) · [Kit Laughlin hip flexor](https://www.youtube.com/watch?v=4bWQGIm9raw).
3. **Schouders (dislocates → wheel-opening)** — [Tom Merrick Shoulder V2](https://www.youtube.com/watch?v=p-LoBIu_axg) · [Kit Laughlin backbend/chest](https://www.youtube.com/watch?v=sECNOp5Itec).
4. **Wervelkolom (cobra → brug → wheel → dropback)** — [Tom Merrick Back Bridge](https://www.youtube.com/watch?v=tSvmWU-0Zo0) · [Open Book T-spine](https://www.youtube.com/watch?v=5TdmVlQe64c).
5. **Enkels & polsen** — [Knee-to-Wall](https://www.youtube.com/watch?v=ElrpduJn92Y) · [GMB Wrists](https://gmb.io/wrists/).
6. **Hamstrings / voorwaartse vouw (jefferson curl, pike)** — [Tom Merrick Hamstring](https://www.youtube.com/watch?v=3Ymjw7TSzrE) · [Jefferson Curl](https://www.youtube.com/watch?v=koi9dAJLWcE).
7. **90/90 heuprotatie & controle** — [Hip CARs](https://www.youtube.com/watch?v=NNMW_h-fzLg) · [90/90 correcte vorm](https://www.youtube.com/watch?v=VYvMMw8z3rE).

Volledige per-niveau tabellen (naam, how-to, prescriptie, meetbaar ontgrendel-
criterium in cm/houdtijd/hands-free, media) staan in het onderzoek. Voorbeeld
(diepe hurk): gesteunde hurk (60s hielen plat) → knie-naar-muur dorsiflexie → vrije
hurk (90s) → actieve hurk-exploratie → wijde zit → pancake met steun → actieve
straddle-lift → halve pancake → **volle pancake** → hands-free pancake press.

---

## 6. Domein — Meditatie · 11 niveaus (één hoofdpad)

Nieuw domein. Seculiere leerlijn, ruggengraat = *The Mind Illuminated* (10 stadia).
Ontgrendeling op **gelogde sessies (aantal × duur)**, soms met zelfrapportage.
Gratis audio: UCLA MARC, Tara Brach, Insight Timer.

| # | Niveau | Duur | Ontgrendel-criterium | Primaire media |
|---|--------|------|----------------------|----------------|
| 1 | Zitten & landen | 3–5 min | 7× ≥3 min | [UCLA Breathing (5m)](https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/01_Breathing_Meditation.mp3) |
| 2 | Adem ankeren (tellen) | 5–8 min | 10× ≥5 min + zelfcheck | [UCLA Complete Instructions](https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/03_Complete_Meditation_Instructions.mp3) |
| 3 | Labelen & terugkeren | 8–10 min | 12× ≥8 min | [UCLA Breath/Sound/Body (12m)](https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/02_Breath_Sound_Body_Meditation.mp3) |
| 4 | Bodyscan | 10–13 min | 10× ≥10 min | [UCLA Body Scan for Sleep (13m)](https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/Body-Scan-for-Sleep.mp3) |
| 5 | Verlengde focus & stabiliteit | 12–20 min | 15× (10× ≥15 min) + zelfcheck | UCLA (12m/19m) |
| 6 | Open bewustzijn | 15–20 min | 12× ≥15 min (helft onbegeleid) | [Tara Brach — Choiceless Awareness](https://www.tarabrach.com/guided-meditation-choiceless-awareness/) |
| 7 | Loving-kindness / metta | 10–15 min | 10× ≥9 min | [UCLA Loving Kindness (9m)](https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/05_Loving_Kindness_Meditation.mp3) |
| 8 | Noting (Mahasi) | 15–25 min | 15× (5× ≥20 min) | [Insight Timer — Noting (30m)](https://insighttimer.com/gabrocheleau/guided-meditations/beginner-insight-meditation-noting-30-minutes) |
| 9 | Lange stille zit (onbegeleid) | 30–45 min | 12× ≥30 min (4× ≥40) | [Insight Timer — meditation timer](https://insighttimer.com/meditation-timer) |
| 10 | Samatha-diepte | 45 min | 20× ≥40 min + zelfcheck | *The Mind Illuminated* st. 6–8 |
| 11 | Vipassana-inzicht & retraite | 45–60+ min | doorlopend (mijlpaal: 2u blok) | [Insight Timer — Tara Brach](https://insighttimer.com/tarabrach/guided-meditations/meditating-with-rain) |

Volledige per-niveau instructie (houding, techniek, wat te doen bij afdwalen) staat
in het onderzoek. Bronnen: [UCLA MARC](https://www.uclahealth.org/programs/marc/free-guided-meditations/guided-meditations),
*The Mind Illuminated* (Culadasa), Tara Brach, Insight Timer, Mahasi Sayadaw
(inzicht), Sam Harris *Waking Up* (concept).

---

## 7. Bouwplan (gefaseerd, commit per fase, stop voor akkoord)

- **C0 — Datamodel + ademwerk-PoC (nu).** Domein-eigen ademwerk-tabellen
  (`breath_levels`, `user_breath_state`, `breath_sessions`) met RLS; seed van de
  12 niveaus incl. Sandy-media; gated player die de leerlijn afspeelt (embedded
  speler + settle-in + ronden/retentie voor de zware niveaus + BOLT-meting +
  contra-indicatie-check); ontgrendel-logica in getypte lib + tests; koppeling op
  /geest. **Acceptatie:** je kunt niveau 1 doen, en niveau 10+ is zichtbaar
  vergrendeld tot de poorten gehaald zijn.
- **C1 — Mobiliteit** (7 sporen × 10) als gated ladders naast de kracht-ladders.
- **C2 — Meditatie** (11 niveaus) met geleide-audio-player + consistentie-gating.
- **C3 — Calisthenics-verdieping**: bestaande ladders uitbreiden naar ~12 fijne
  niveaus per patroon + skill-sporen (handstand, muscle-up) + media per trede.
- **C4 — Generalisatie + kalibratie-instaptests + media-onderhoudsscherm.**

Elke fase: RLS aan, TS strict, `npm test`/`tsc`/`build` groen, screenshot, docs,
commit, stop voor akkoord.

---

## 8. Bronnen (samengevat)

- **Calisthenics:** [r/bodyweightfitness RR](https://redditbwf.github.io/wiki/recommended_routine.html) · Steven Low *Overcoming Gravity* · [Hybrid Calisthenics](https://www.hybridcalisthenics.com/routine) · [FitnessFAQs](https://www.youtube.com/@FitnessFAQs) · [GMB](https://gmb.io/) · School of Calisthenics.
- **Mobiliteit:** [Tom Merrick](https://www.youtube.com/@BodyweightWarrior) · [Kit Laughlin](https://stretchtherapy.net/) · [GMB](https://gmb.io/) · [Emmet Louis](https://emmetlouis.com/) · FRC (CARs/PAILs-RAILs).
- **Meditatie:** [UCLA MARC](https://www.uclahealth.org/programs/marc/free-guided-meditations/guided-meditations) · *The Mind Illuminated* (Culadasa) · [Tara Brach](https://www.tarabrach.com/) · Insight Timer · Mahasi Sayadaw · Sam Harris.
- **Ademwerk:** [Breathe With Sandy](https://www.breathewithsandy.com/) (primair) · [Wim Hof Method](https://www.wimhofmethod.com/breathing-exercises) · [Huberman Lab](https://www.hubermanlab.com/newsletter/breathwork-protocols-for-health-focus-stress) · [Oxygen Advantage/McKeown](https://oxygenadvantage.com/) · James Nestor *Breath* · Dr. Weil · Stanislav Grof (holotropic) · [KAISORA safety](https://www.kaisorabreathwork.com/resources/breathwork-safety-contraindications).

> Alle media-links komen uit live zoek-/fetch-resultaten (juli 2026). YouTube
> blokkeerde geautomatiseerde fetch; controleer video-ID's één keer handmatig vóór
> livegang. De volledige per-niveau coaching per domein is vastgelegd in het
> onderzoek en wordt per bouwfase in de seed opgenomen.
