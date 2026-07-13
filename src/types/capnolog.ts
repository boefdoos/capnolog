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
}

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
}

export const DEVICE_MIN_KPA = 0.0;
export const DEVICE_MAX_KPA = 9.9; // EMMA kPa-versie toont EtCO2 enkel binnen 0.0-9.9 kPa (operator's manual)

export const DEFAULT_BAND_LOW = 3.8;
export const DEFAULT_BAND_HIGH = 4.9;
export const MIN_READINGS_FOR_BASELINE = 20;
