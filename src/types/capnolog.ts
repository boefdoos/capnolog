export type EntryType = "reading" | "marker" | "sigh" | "rr";
export type SighSubtype = "success" | "fail";

// Driedelige CART-sessiestructuur (Ritz et al., CHEST 2014, methodesectie):
// 2 min stille rust, 10 min gepaced ademen, 5 min transfer zonder pacing
// (docs/codeinstructies.md P8). Enkel van toepassing op sessionType "cart".
export type SessionPhase = "rest" | "paced" | "transfer";

/** What actually gets written to Firestore for one logged event. */
export interface StoredEntry {
  id: string;
  type: EntryType;
  subtype?: SighSubtype;
  tSec: number;
  kpa?: number;
  // Rechtstreeks van het EMMA-scherm afgelezen ademfrequentie, enkel bij
  // type "rr" (P10). Vervangt de uit het loginterval afgeleide waarde als
  // eigenlijke meting; die afleiding blijft bestaan maar dient voortaan als
  // nalevingscontrole, geen meting (zie deriveEntries in format.ts).
  rrValue?: number;
  // Ontbreekt bij rustcontroles en bij sessies van voor P8.
  phase?: SessionPhase;
  createdAt?: number; // epoch ms, client-set for stable ordering
}

/** StoredEntry plus fields derived client-side for display (never persisted). */
export interface Entry extends StoredEntry {
  mmHg?: number;
  delta?: number;
  idx?: number;
  rr?: number;
}

export type SessionFeeling = "slecht" | "eerder_slecht" | "ok" | "eerder_goed" | "goed";

export const FEELING_LABELS: Record<SessionFeeling, string> = {
  slecht: "Slecht",
  eerder_slecht: "Eerder slecht",
  ok: "OK",
  eerder_goed: "Eerder goed",
  goed: "Goed",
};

// Rood-naar-groen gradient zodat gevoel in de geschiedenislijst in één
// oogopslag scanbaar is, zonder de tekst te moeten lezen.
export const FEELING_COLORS: Record<SessionFeeling, string> = {
  slecht: "#E5735A",
  eerder_slecht: "#F2B84B",
  ok: "#7C8C86",
  eerder_goed: "#4FD1C5",
  goed: "#5EEAA0",
};

// "nulmeting" (P12): ongestuurde rustmetingen vóór de start van het
// protocol, zelfde meetscherm als een rustcontrole.
export type SessionType = "cart" | "rustcontrole" | "nulmeting";

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  cart: "Oefensessie",
  rustcontrole: "Rustcontrole",
  nulmeting: "Nulmeting",
};

export interface SessionMeta {
  id: string;
  createdAt: number; // epoch ms
  sessionType: SessionType;
  bandLow: number;
  bandHigh: number;
  readingCount: number;
  kpaSum: number;
  kpaSumSq: number;
  sighSuccessCount: number;
  sighTotalCount: number;
  lastTSec: number;
  feeling?: SessionFeeling;
  // Bemonsteringsfactor: hoeveelste adem er gelogd werd (P1b). Ontbreekt bij
  // sessies van voor P1b en bij rustcontroles, die lezen als per-adem (1).
  logEveryNthBreath?: number;
}

export const DEVICE_MIN_KPA = 0.0;
export const DEVICE_MAX_KPA = 9.9; // EMMA kPa-versie toont EtCO2 enkel binnen 0.0-9.9 kPa (operator's manual)

export const DEFAULT_BAND_LOW = 3.8;
export const DEFAULT_BAND_HIGH = 4.9;
// Minimum aantal CART-sessies voor een eigen referentieband. Vroeger een
// aantal metingen (20), maar sinds bemonsterd loggen (P1b) haalt één sessie
// dat al, en één sessie toont enkel de spreiding binnen die sessie, niet de
// schommeling van dag tot dag. Vier sessies = twee dagen protocol.
export const MIN_SESSIONS_FOR_BASELINE = 4;

// Nulmeting (P12): drie rustmetingen per dag over vijf tot zeven dagen.
// Streefaantal meetmomenten voor een bruikbare nulmeting.
export const NULMETING_TARGET_SESSIONS = 20;

/** Bevroren samenvatting van de nulmeting, vastgelegd bij de start van het
 * protocol en daarna nooit meer gewijzigd (P12). */
export interface NulmetingBaseline {
  meanKpa: number;
  sdKpa: number;
  readingCount: number;
  sessionCount: number;
  frozenAt: number; // epoch ms
}

// CART-doelbereik (Ritz et al., CHEST 2014, methodesectie): 40-42 mmHg.
// Vast trajectdoel, in tegenstelling tot de meebewegende referentieband
// hierboven: dit is normocapnie, geen persoonlijke baseline (P3).
export const CART_GOAL_KPA_LOW = 5.33;
export const CART_GOAL_KPA_HIGH = 5.6;

// CART-protocol (Meuret et al. 2008): richtwaarden, geen harde grens. Meer
// oefenen dan dit mag altijd; minder wordt gesignaleerd, niet geblokkeerd.
export const CART_TARGET_MINUTES = 17;
export const CART_TARGET_SESSIONS_PER_DAY = 2;
// Een sessie telt pas mee voor het dagdoel vanaf deze duur (P9): rust plus
// het grootste deel van gepaced ademen. Twee losse waarden halen het niet.
export const MIN_SESSION_SEC_FOR_DAILY_GOAL = 10 * 60;

// Driedelige sessiestructuur uit CATCH (docs/codeinstructies.md P8): 2 min
// stille rust (baseline-proxy), 10 min gepaced, 5 min transfer zonder
// pacing. Som is exact CART_TARGET_MINUTES, geen toeval.
export const CART_REST_SEC = 2 * 60;
export const CART_PACED_SEC = 10 * 60;
export const CART_TRANSFER_SEC = 5 * 60;

export interface BreathSampling {
  n: number; // elke hoeveelste adem loggen
  intervalSec: number; // bijhorend logsignaal-interval
}

// Elke hoeveelste adem loggen per doelfrequentie (docs/codeinstructies.md
// P1b): logmoment hangt aan de ademcyclus, niet aan de klok, zodat elk
// meetpunt op hetzelfde punt in de cyclus valt.
export const BREATH_SAMPLING: Record<number, BreathSampling> = {
  13: { n: 7, intervalSec: 32 },
  11: { n: 6, intervalSec: 33 },
  9: { n: 5, intervalSec: 33 },
  6: { n: 3, intervalSec: 30 },
};

// Vaste cuemomenten tijdens elke ongestuurde rustmeting: de stille rust aan
// het begin van een oefensessie, de nulmeting en de rustcontrole. Twee
// waarden, na 1 en na bijna 2 minuten stilzitten vanaf de tik op Start, zodat
// de drie ongestuurde reeksen onderling vergelijkbaar zijn.
export const REST_CUE_SEC = [60, 110] as const;
export const REST_MEASUREMENT_SEC = 120;
