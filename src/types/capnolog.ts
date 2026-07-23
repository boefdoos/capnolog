export type EntryType = "reading" | "marker" | "sigh";
export type SighSubtype = "success" | "fail";

/** What actually gets written to Firestore for one logged event. */
export interface StoredEntry {
  id: string;
  type: EntryType;
  subtype?: SighSubtype;
  tSec: number;
  kpa?: number;
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

export interface SessionMeta {
  id: string;
  createdAt: number; // epoch ms
  bandLow: number;
  bandHigh: number;
  readingCount: number;
  kpaSum: number;
  kpaSumSq: number;
  sighSuccessCount: number;
  sighTotalCount: number;
  lastTSec: number;
  feeling?: SessionFeeling;
}

export const DEVICE_MIN_KPA = 0.0;
export const DEVICE_MAX_KPA = 9.9; // EMMA kPa-versie toont EtCO2 enkel binnen 0.0-9.9 kPa (operator's manual)

export const DEFAULT_BAND_LOW = 3.8;
export const DEFAULT_BAND_HIGH = 4.9;
export const MIN_READINGS_FOR_BASELINE = 20;

// CART-protocol (Meuret et al. 2008): richtwaarden, geen harde grens. Meer
// oefenen dan dit mag altijd; minder wordt gesignaleerd, niet geblokkeerd.
export const CART_TARGET_MINUTES = 17;
export const CART_TARGET_SESSIONS_PER_DAY = 2;
