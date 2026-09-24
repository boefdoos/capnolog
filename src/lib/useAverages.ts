"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { parseSessionMeta } from "./format";
import { backfillSessionAggregates } from "./sessionActions";
import {
  DEFAULT_BAND_HIGH,
  DEFAULT_BAND_LOW,
  DEVICE_MIN_KPA,
  MIN_SESSIONS_FOR_BASELINE,
  MIN_CART_SESSION_SEC,
  type NulmetingBaseline,
  type SessionMeta,
  type SessionType,
} from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Eén definitie van "deze oefensessie telt mee" (B4), zie MIN_CART_SESSION_SEC. */
export function countsAsCartSession(s: SessionMeta): boolean {
  return s.sessionType === "cart" && s.readingCount > 0 && s.lastTSec >= MIN_CART_SESSION_SEC;
}

export interface WindowAverage {
  avgKpa: number | null;
  avgMmHg: number | null;
  readingCount: number;
  sessionCount: number;
}

export interface BaselineBand {
  low: number;
  high: number;
  source: "baseline" | "default";
  readingCount: number;
  // Ondergrens opgetrokken tot het beste eerder bereikte niveau (P5).
  floorApplied: boolean;
}

/**
 * Enkel CART-sessies: het week- en maandgemiddelde gaat over gestuurde
 * oefendata, rustcontroles zijn bewust een aparte, ongestuurde reeks
 * (docs/codeinstructies.md P2).
 */
function computeWindow(sessions: SessionMeta[], sinceMs: number): WindowAverage {
  const inWindow = sessions.filter((s) => countsAsCartSession(s) && s.createdAt >= sinceMs);
  const readingCount = inWindow.reduce((sum, s) => sum + s.readingCount, 0);
  const kpaSum = inWindow.reduce((sum, s) => sum + s.kpaSum, 0);
  if (!readingCount) {
    return { avgKpa: null, avgMmHg: null, readingCount: 0, sessionCount: inWindow.length };
  }
  const avgKpa = kpaSum / readingCount;
  return {
    avgKpa,
    avgMmHg: avgKpa * 7.50062,
    readingCount,
    sessionCount: inWindow.length,
  };
}

const BAND_WINDOW_DAYS = 28;
// Een venster telt pas mee voor de vloer vanaf zoveel CART-sessies, zodat
// één uitschieter in het begin niet voorgoed de ondergrens vastlegt.
const MIN_SESSIONS_FOR_FLOOR = 6;

interface RawBand {
  low: number;
  high: number;
  readingCount: number;
  sessionCount: number;
}

function bandFromSessions(sessions: SessionMeta[]): RawBand | null {
  const n = sessions.reduce((sum, s) => sum + s.readingCount, 0);
  if (sessions.length < MIN_SESSIONS_FOR_BASELINE || !n) return null;
  const sum = sessions.reduce((acc, s) => acc + s.kpaSum, 0);
  const sumSq = sessions.reduce((acc, s) => acc + s.kpaSumSq, 0);
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return { low: mean - sd, high: mean + sd, readingCount: n, sessionCount: sessions.length };
}

function windowBand(cartSessions: SessionMeta[], endMs: number): RawBand | null {
  const since = endMs - BAND_WINDOW_DAYS * DAY_MS;
  return bandFromSessions(cartSessions.filter((s) => s.createdAt > since && s.createdAt <= endMs));
}

/**
 * Referentieband = gemiddelde ± 1 SD over de CART-sessies van de laatste
 * BAND_WINDOW_DAYS dagen, met een vloer die nooit daalt (P5). Een band over
 * alle sessies ooit verstarde: data uit de slechtste beginperiode bleef even
 * zwaar wegen, en wie verbeterde, sleepte de band nauwelijks mee. Het venster
 * volgt verbetering; de vloer zorgt dat een slechte week de band niet mee naar
 * beneden trekt. Je zit dan tijdelijk onder je band, dat is de bedoeling.
 * De vloer is de hoogste ondergrens die ooit bereikt werd over een venster
 * met minstens MIN_SESSIONS_FOR_FLOOR sessies.
 * Zonder genoeg recente data: band over alle CART-sessies ooit, en daaronder
 * de vaste terugvalband. Enkel CART-sessies (P2).
 */
function computeBaselineBand(allSessions: SessionMeta[]): BaselineBand {
  const cart = allSessions.filter(countsAsCartSession);
  const raw = windowBand(cart, Date.now()) ?? bandFromSessions(cart);
  if (!raw) {
    const n = cart.reduce((sum, s) => sum + s.readingCount, 0);
    return { low: DEFAULT_BAND_LOW, high: DEFAULT_BAND_HIGH, source: "default", readingCount: n, floorApplied: false };
  }

  let floor = -Infinity;
  for (const s of cart) {
    const w = windowBand(cart, s.createdAt);
    if (w && w.sessionCount >= MIN_SESSIONS_FOR_FLOOR) floor = Math.max(floor, w.low);
  }

  const width = raw.high - raw.low;
  const floorApplied = floor > raw.low;
  const low = Math.max(DEVICE_MIN_KPA, floorApplied ? floor : raw.low);
  const high = Math.max(raw.high, low + width);
  return { low, high, source: "baseline", readingCount: raw.readingCount, floorApplied };
}

export interface TrendPoint {
  date: number; // epoch ms (session createdAt)
  avgKpa: number;
}

export interface Trend {
  cart: TrendPoint[];
  rustcontrole: TrendPoint[];
  nulmeting: TrendPoint[];
}

function trendPoints(sessions: SessionMeta[], type: SessionType, sinceMs: number): TrendPoint[] {
  return sessions
    .filter(
      (s) =>
        s.sessionType === type &&
        s.createdAt >= sinceMs &&
        s.readingCount > 0 &&
        (type !== "cart" || countsAsCartSession(s))
    )
    .map((s) => ({ date: s.createdAt, avgKpa: s.kpaSum / s.readingCount }))
    .sort((a, b) => a.date - b.date);
}

/** Eén punt per sessie (datum + sessiegemiddelde), laatste 30 dagen,
 * chronologisch, voor een evolutie-grafiek op het startscherm. Twee aparte
 * reeksen (P2): gestuurde CART-sessies en ongestuurde rustcontroles meten
 * niet hetzelfde en horen niet in één lijn samengevoegd te worden. */
function computeTrend(sessions: SessionMeta[]): Trend {
  const monthAgo = Date.now() - 30 * DAY_MS;
  return {
    cart: trendPoints(sessions, "cart", monthAgo),
    rustcontrole: trendPoints(sessions, "rustcontrole", monthAgo),
    nulmeting: trendPoints(sessions, "nulmeting", monthAgo),
  };
}

/** Aantal voltooide CART-sessies sinds lokale middernacht. Voltooid = minstens
 * MIN_CART_SESSION_SEC tussen start en laatste log (P9). Het
 * CART-doel van 2x/dag gaat over oefensessies, een rustcontrole telt daar
 * niet in mee (P2). */
function computeSessionsToday(sessions: SessionMeta[]): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return sessions.filter((s) => countsAsCartSession(s) && s.createdAt >= startOfDay.getTime()).length;
}

/** Samenvatting van alle nulmetingen tot nu (P12). Bij de protocolstart wordt
 * dit bevroren in settings/protocol; daarna telt enkel de bevroren waarde. */
export function computeNulmetingSummary(
  sessions: SessionMeta[]
): Omit<NulmetingBaseline, "frozenAt"> | null {
  const nul = sessions.filter((s) => s.sessionType === "nulmeting" && s.readingCount > 0);
  const n = nul.reduce((sum, s) => sum + s.readingCount, 0);
  if (!n) return null;
  const mean = nul.reduce((sum, s) => sum + s.kpaSum, 0) / n;
  const sumSq = nul.reduce((sum, s) => sum + s.kpaSumSq, 0);
  return {
    meanKpa: mean,
    sdKpa: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    readingCount: n,
    sessionCount: nul.length,
  };
}

/**
 * `readOnly`: voor de begeleidersweergave (P13). Slaat de zelfherstellende
 * backfill over, want een begeleider mag niet schrijven in cliëntdata.
 */
export function useAverages(uid: string | null, { readOnly = false }: { readOnly?: boolean } = {}) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    // Alle sessies ophalen (geen datumfilter): week/maand worden hieruit
    // client-side afgeleid, en de baseline-band gebruikt bewust de volledige
    // geschiedenis. Een limiet van 1000 is een ruime veiligheidsmarge voor
    // persoonlijk gebruik, geen praktische impact.
    const q = query(collection(db, "users", uid, "sessions"), orderBy("createdAt", "desc"), limit(1000));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => parseSessionMeta(d.id, d.data() as Record<string, unknown>));
      setSessions(all);
      setLoading(false);

      // Zelfherstel: sessies die aangemaakt zijn voor kpaSum/kpaSumSq
      // bestonden hebben readingCount>0 maar kpaSum en/of kpaSumSq bleven
      // op 0 staan, wat het gemiddelde en vooral de referentieband (die op
      // kpaSumSq steunt voor de standaarddeviatie) vertekent. Stil
      // herberekenen vanuit de echte entries; de listener hierboven pikt
      // de correctie vanzelf weer op.
      if (readOnly) return;
      all.forEach((s) => {
        if (s.readingCount > 0 && (s.kpaSum === 0 || s.kpaSumSq === 0)) {
          backfillSessionAggregates(uid, s.id).catch(() => {});
        }
      });
    });
    return () => unsub();
  }, [uid, readOnly]);

  const week = useMemo(() => computeWindow(sessions, Date.now() - 7 * DAY_MS), [sessions]);
  const month = useMemo(() => computeWindow(sessions, Date.now() - 30 * DAY_MS), [sessions]);
  const band = useMemo(() => computeBaselineBand(sessions), [sessions]);
  const sessionsToday = useMemo(() => computeSessionsToday(sessions), [sessions]);
  const trend = useMemo(() => computeTrend(sessions), [sessions]);

  return { week, month, band, sessionsToday, trend, sessions, loading };
}
