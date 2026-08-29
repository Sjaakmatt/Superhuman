# Samsung Health-component

Leest Samsung Health-data via **Health Connect** en levert hem aan bij dezelfde tabellen als Strava.

Niet via de Samsung Health Data SDK. Samsung Health schrijft zijn data naar Health Connect, dus je krijgt hetzelfde binnen zonder aan Samsung vast te zitten — en het blijft werken als hij ooit van telefoon wisselt. Vanaf Android 14 zit Health Connect in het besturingssysteem zelf; op Android 9–13 is het een aparte app uit de Play Store.

**Er is geen cloud-API.** Vandaar de Android-app: die is de brug, en er is geen andere.

## Bestanden

```
android/app/build.gradle.kts                          dependencies en SDK-niveaus
android/app/src/main/AndroidManifest.xml              permissies + rationale-intents
android/…/sync/HealthConnect.kt                       lezen, aggregeren, vertalen
android/…/sync/SyncWorker.kt                          WorkManager, elke 3 uur
android/…/sync/Koppeling.kt                           code inwisselen voor token
android/…/sync/MainActivity.kt                        één scherm: koppelen, toestemming, status

web/migrations/0010_health_connect.sql                source, external_id, device, pairing_code
web/api/health-connect-route.ts                       app/api/ingest/health-connect/route.ts
web/api/pair-route.ts                                 app/api/ingest/pair/route.ts
web/api/pairing-code-route.ts                         app/api/devices/pairing-code/route.ts
web/components/BronnenKaart.tsx                       instellingenscherm
```

## Hoe het loopt

```
Samsung Health ──schrijft──▶ Health Connect ──leest──▶ Android-app
                                                            │  elke 3 uur, ook op de achtergrond
                                                            ▼
                                              POST /api/ingest/health-connect
                                                            │
                                          ┌─────────────────┴─────────────────┐
                                          ▼                                   ▼
                              activity (source='health_connect')     wellness (*_auto)
```

## Zes beslissingen die erin zitten

**Differentiële sync met een changes-token.** Health Connect geeft een token uit waarmee je alleen de wijzigingen sinds die token ophaalt. Een ongebruikt token vervalt na 30 dagen; dan valt de app terug op een volledige uitlezing van de laatste 30 dagen en ontdubbelt de server op `external_id`. Zonder die terugval verlies je stilletjes data zodra de telefoon een maand niet gesynchroniseerd heeft.

**Het token wordt pas opgeslagen als de server heeft bevestigd.** Sla je het meteen op en faalt de POST, dan zijn die wijzigingen weg — het volgende token begint immers ná wat je al had opgehaald. Dit is de subtielste bug in het hele component.

**Achtergrondtoestemming is verplicht, niet optioneel.** Zonder `READ_HEALTH_DATA_IN_BACKGROUND` synchroniseert de app alleen als hij open staat, en dan opent je broer hem nooit. De tekst in het scherm zegt daarom expliciet dat hij ook daar ja op moet zeggen.

**Handinvoer wint altijd.** Slaap, rustpols en gewicht komen binnen in aparte `_auto`-kolommen. Wat hij zelf invult bij de ochtendcheck wordt nooit overschreven. De app mag aanvullen, niet corrigeren.

**Krachttraining komt hier niet binnen.** Die filter zit in `LOOPTYPES` en de sporttypefilter in de route. Kracht log je in het krachtscherm; zou je het ook uit Health Connect halen, dan tel je sessies dubbel en klopt je adherentiepercentage niet meer.

**Verwijderingen worden verwerkt.** Health Connect meldt wanneer een record weg is. Negeer je dat, dan blijft een per ongeluk opgenomen training voor altijd in het weektotaal staan.

## Opzetten

1. Draai `0010_health_connect.sql`. Staat `activity.id` nog gelijk aan het Strava-id, doe dan éérst de migratie onderaan dat bestand.
2. Zet de drie routes op hun plek in `app/`.
3. Zet `BronnenKaart` op je instellingenscherm.
4. Vul in `Koppeling.kt` je eigen domein in bij `API_URL`.
5. Bouw de APK en zet hem op zijn telefoon (`adb install`, of Play Console interne test als je het netjes wilt).
6. Hij opent de app, vult de koppelcode in uit de webapp, geeft toestemming — inclusief achtergrond — en klaar.

## Wat je hiermee niet krijgt

**Afdaalminuten.** Daarvoor heb je een hoogteprofiel per seconde nodig, en dat zit in Health Connect alleen in `ExerciseRoute` met een aparte permissie en losse toestemming per sessie. Voor een doorlopend schema is het doel toch nul, dus laat het. Wil je het ooit wel: `READ_EXERCISE_ROUTES` erbij, en dan `route.route` uitlezen op hoogteverschil.

**Hartslagzones per sessie.** We halen alleen gemiddelde en maximum op. De volledige hartslagreeks kan wel (`HeartRateRecord` over het sessiebereik), maar dat is een tweede aggregatie per sessie en voor zijn plan telt alleen het volume. Toevoegen is later een kwestie van één extra `readRecords` in `naarTraining`.

## Testen zonder Samsung-telefoon

Health Connect draait niet op een emulator. Installeer op een fysiek Android-toestel de Health Connect-testapp of schrijf zelf een handvol records weg met een klein testscript, en controleer daarna dat:

- dezelfde sessie twee keer aanleveren één rij oplevert
- een verlopen changes-token netjes terugvalt op de volledige uitlezing
- een training van 23:40 op de juiste kalenderdag terechtkomt
- een handmatig ingevulde slaapduur niet wordt overschreven door de telefoon

Die vier dekken alles wat er in de praktijk misgaat.

---

*Health Connect-versies bewegen. Controleer `androidx.health.connect:connect-client` op [developer.android.com/jetpack/androidx/releases/health-connect](https://developer.android.com/jetpack/androidx/releases/health-connect) voordat je bouwt, en check of `PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND` in jouw versie nog zo heet.*
