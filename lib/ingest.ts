/* Wat de Android-app aanlevert, gecontroleerd voordat het de database in gaat.
 *
 * Met de hand geschreven in plaats van met een schemabibliotheek: het is één
 * vorm, hij verandert zelden, en zo staat er precies één plek waar je kunt
 * nalezen wat er wel en niet doorheen komt. Elke grens hieronder is getest.
 *
 * Dit is een openbaar bereikbaar endpoint. Alles wat binnenkomt is verdacht tot
 * het tegendeel blijkt. */

export type Training = {
  externalId: string;
  bron: string;
  datum: string;
  startLokaal: string;
  sportType: string;
  titel: string | null;
  duurSec: number;
  afstandM: number | null;
  stijgingM: number | null;
  kcal: number | null;
  hartslagGem: number | null;
  hartslagMax: number | null;
};

export type Dagwaarde = {
  datum: string;
  slaapUren: number | null;
  rustpols: number | null;
  gewichtKg: number | null;
};

export type Payload = {
  trainingen: Training[];
  dagen: Dagwaarde[];
  verwijderd: string[];
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
/** Lokale tijd zonder zone: die zit al in de datum, net als bij Strava. */
const TIJDSTIP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;

/** Hoeveel er in één keer aangeleverd mag worden. Een volledige uitlezing van
 *  dertig dagen past hier ruim in; meer is een fout of een aanval. */
const MAX_RIJEN = 500;

type Uitkomst = { ok: true; payload: Payload } | { ok: false; fout: string };

export function leesPayload(ruw: unknown): Uitkomst {
  if (!isObject(ruw)) return mis('geen object');

  const trainingen: Training[] = [];
  const dagen: Dagwaarde[] = [];
  const verwijderd: string[] = [];

  const ruweTrainingen = ruw.trainingen;
  const ruweDagen = ruw.dagen;
  const ruwVerwijderd = ruw.verwijderd;

  if (!Array.isArray(ruweTrainingen) || !Array.isArray(ruweDagen) || !Array.isArray(ruwVerwijderd)) {
    return mis('trainingen, dagen en verwijderd moeten lijsten zijn');
  }
  if (ruweTrainingen.length > MAX_RIJEN || ruweDagen.length > MAX_RIJEN || ruwVerwijderd.length > MAX_RIJEN) {
    return mis(`hoogstens ${MAX_RIJEN} rijen per keer`);
  }

  for (const [i, item] of ruweTrainingen.entries()) {
    const uit = leesTraining(item);
    if (!uit.ok) return mis(`training ${i}: ${uit.fout}`);
    trainingen.push(uit.waarde);
  }

  for (const [i, item] of ruweDagen.entries()) {
    const uit = leesDag(item);
    if (!uit.ok) return mis(`dag ${i}: ${uit.fout}`);
    dagen.push(uit.waarde);
  }

  for (const [i, item] of ruwVerwijderd.entries()) {
    if (typeof item !== 'string' || !item || item.length > 200) return mis(`verwijderd ${i}: geen bruikbaar id`);
    verwijderd.push(item);
  }

  return { ok: true, payload: { trainingen, dagen, verwijderd } };
}

function leesTraining(ruw: unknown): { ok: true; waarde: Training } | { ok: false; fout: string } {
  if (!isObject(ruw)) return { ok: false, fout: 'geen object' };

  const externalId = tekst(ruw.externalId, 200);
  if (!externalId) return { ok: false, fout: 'externalId ontbreekt' };

  const datum = tekst(ruw.datum, 10);
  if (!datum || !DATUM.test(datum)) return { ok: false, fout: 'datum moet JJJJ-MM-DD zijn' };

  const startLokaal = tekst(ruw.startLokaal, 40);
  if (!startLokaal || !TIJDSTIP.test(startLokaal)) return { ok: false, fout: 'startLokaal is geen lokaal tijdstip' };

  const sportType = tekst(ruw.sportType, 40);
  if (!sportType) return { ok: false, fout: 'sportType ontbreekt' };

  // Achtenveertig uur is ruim boven de langste ultra en ver onder een teller
  // die is blijven lopen.
  const duurSec = getal(ruw.duurSec, 0, 48 * 3600);
  if (duurSec === null) return { ok: false, fout: 'duurSec buiten bereik' };

  return {
    ok: true,
    waarde: {
      externalId,
      bron: tekst(ruw.bron, 120) ?? 'onbekend',
      datum,
      startLokaal,
      sportType,
      titel: tekst(ruw.titel, 200),
      duurSec: Math.round(duurSec),
      afstandM: getal(ruw.afstandM, 0, 500_000),
      stijgingM: getal(ruw.stijgingM, 0, 20_000),
      kcal: getal(ruw.kcal, 0, 30_000),
      hartslagGem: getal(ruw.hartslagGem, 20, 230),
      hartslagMax: getal(ruw.hartslagMax, 20, 230),
    },
  };
}

function leesDag(ruw: unknown): { ok: true; waarde: Dagwaarde } | { ok: false; fout: string } {
  if (!isObject(ruw)) return { ok: false, fout: 'geen object' };

  const datum = tekst(ruw.datum, 10);
  if (!datum || !DATUM.test(datum)) return { ok: false, fout: 'datum moet JJJJ-MM-DD zijn' };

  const rustpols = getal(ruw.rustpols, 25, 120);

  return {
    ok: true,
    waarde: {
      datum,
      slaapUren: getal(ruw.slaapUren, 0, 24),
      rustpols: rustpols === null ? null : Math.round(rustpols),
      gewichtKg: getal(ruw.gewichtKg, 30, 250),
    },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Een string binnen de lengte, of null. Leeg telt als afwezig. */
function tekst(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const schoon = v.trim();
  return schoon && schoon.length <= max ? schoon : null;
}

/** Een eindig getal binnen het bereik, of null. Buiten bereik is óók null:
 *  een hartslag van 300 is geen hartslag, en een nul erin schrijven zou erger
 *  zijn dan het veld leeg laten. */
function getal(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
}

const mis = (fout: string): Uitkomst => ({ ok: false, fout });

/** De sporttypes die we overnemen.
 *
 *  Kracht komt hier bewust niet binnen: dat log je op het krachtscherm, en
 *  tweemaal tellen breekt je adherentiepercentage. Hardlopen uit Health Connect
 *  heet `Run`; een `Hike` telt als trail. Fietsen en wandelen bewaren we wel
 *  maar tellen nergens in mee, net als bij Strava. */
export const OVERGENOMEN: Record<string, string> = {
  Run: 'Run',
  Hike: 'TrailRun',
  Walk: 'Walk',
  Ride: 'Ride',
};

/** Twee opnames van dezelfde loop.
 *
 *  Wie zowel Strava als zijn horloge laat synchroniseren krijgt dezelfde
 *  training twee keer binnen, met verschillende ids. Dan telt hij dubbel in je
 *  weekvolume. We beschouwen ze als dezelfde sessie wanneer ze binnen een
 *  kwartier van elkaar beginnen en in duur niet meer dan een tiende schelen. */
export function isDezelfdeSessie(
  a: { startLokaal: string; duurSec: number },
  b: { start_local: string; moving_s: number | null },
): boolean {
  const startA = Date.parse(a.startLokaal);
  const startB = Date.parse(b.start_local);
  if (Number.isNaN(startA) || Number.isNaN(startB)) return false;
  if (Math.abs(startA - startB) > 15 * 60_000) return false;

  const duurB = Number(b.moving_s ?? 0);
  if (duurB <= 0 || a.duurSec <= 0) return false;
  return Math.abs(a.duurSec - duurB) / Math.max(a.duurSec, duurB) <= 0.1;
}
