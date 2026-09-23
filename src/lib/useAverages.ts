"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { parseSessionMeta } from "./format";
import { backfillSessionAggregates } from "./sessionActions";
import {
  DEFAULT_BAND_HIGH,
  DEFAULT_BAND_LOW,
  MIN_READINGS_FOR_BASELINE,
  MIN_SESSION_SEC_FOR_DAILY_GOAL,
  type SessionMeta,
  type SessionType,
} from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;

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
}

/**
 * Enkel CART-sessies: het week- en maandgemiddelde gaat over gestuurde
 * oefendata, rustcontroles zijn bewust een aparte, ongestuurde reeks
 * (docs/codeinstructies.md P2).
 */
function computeWindow(sessions: SessionMeta[], sinceMs: number): WindowAverage {
  const inWindow = sessions.filter(
    (s) => s.sessionType === "cart" && s.createdAt >= sinceMs && s.readingCount > 0
  );
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

/**
 * Referentieband = persoonlijke baseline (mean ± 1 SD), zoals gangbaar in
 * biofeedback-apps (bv. Myndlift): een baseline die stabieler en preciezer
 * wordt naarmate er meer data is, in plaats van een glijdend venster dat
 * elke maand resette. Daarom over ALLE sessies ooit, niet enkel de laatste
 * maand. Onder MIN_READINGS_FOR_BASELINE metingen: vaste terugvalband.
 * Enkel CART-sessies (P2): rustcontroles zijn bewust ongestuurd en horen
 * niet mee te wegen in een band die als oefendoel dient.
 */
function computeBaselineBand(allSessions: SessionMeta[]): BaselineBand {
  const inWindow = allSessions.filter((s) => s.sessionType === "cart" && s.readingCount > 0);
  const n = inWindow.reduce((sum, s) => sum + s.readingCount, 0);
  if (n < MIN_READINGS_FOR_BASELINE) {
    return { low: DEFAULT_BAND_LOW, high: DEFAULT_BAND_HIGH, source: "default", readingCount: n };
  }
  const sum = inWindow.reduce((s, x) => s + x.kpaSum, 0);
  const sumSq = inWindow.reduce((s, x) => s + x.kpaSumSq, 0);
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const sd = Math.sqrt(variance);
  return { low: mean - sd, high: mean + sd, source: "baseline", readingCount: n };
}

export interface TrendPoint {
  date: number; // epoch ms (session createdAt)
  avgKpa: number;
}

export interface Trend {
  cart: TrendPoint[];
  rustcontrole: TrendPoint[];
}

function trendPoints(sessions: SessionMeta[], type: SessionType, sinceMs: number): TrendPoint[] {
  return sessions
    .filter((s) => s.sessionType === type && s.createdAt >= sinceMs && s.readingCount > 0)
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
  };
}

/** Aantal voltooide CART-sessies sinds lokale middernacht. Voltooid = minstens
 * MIN_SESSION_SEC_FOR_DAILY_GOAL tussen start en laatste log (P9). Het
 * CART-doel van 2x/dag gaat over oefensessies, een rustcontrole telt daar
 * niet in mee (P2). */
function computeSessionsToday(sessions: SessionMeta[]): number {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return sessions.filter(
    (s) =>
      s.sessionType === "cart" &&
      s.createdAt >= startOfDay.getTime() &&
      s.readingCount > 0 &&
      s.lastTSec >= MIN_SESSION_SEC_FOR_DAILY_GOAL
  ).length;
}

export function useAverages(uid: string | null) {
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
      all.forEach((s) => {
        if (s.readingCount > 0 && (s.kpaSum === 0 || s.kpaSumSq === 0)) {
          backfillSessionAggregates(uid, s.id).catch(() => {});
        }
      });
    });
    return () => unsub();
  }, [uid]);

  const week = useMemo(() => computeWindow(sessions, Date.now() - 7 * DAY_MS), [sessions]);
  const month = useMemo(() => computeWindow(sessions, Date.now() - 30 * DAY_MS), [sessions]);
  const band = useMemo(() => computeBaselineBand(sessions), [sessions]);
  const sessionsToday = useMemo(() => computeSessionsToday(sessions), [sessions]);
  const trend = useMemo(() => computeTrend(sessions), [sessions]);

  return { week, month, band, sessionsToday, trend, sessions, loading };
}
