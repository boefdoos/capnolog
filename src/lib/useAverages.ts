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
  type SessionMeta,
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

function computeWindow(sessions: SessionMeta[], sinceMs: number): WindowAverage {
  const inWindow = sessions.filter((s) => s.createdAt >= sinceMs && s.readingCount > 0);
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
 */
function computeBaselineBand(allSessions: SessionMeta[]): BaselineBand {
  const inWindow = allSessions.filter((s) => s.readingCount > 0);
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
      // bestonden hebben readingCount>0 maar kpaSum bleef op 0 staan, wat
      // het gemiddelde en de referentieband vertekent. Stil herberekenen
      // vanuit de echte entries; de listener hierboven pikt de correctie
      // vanzelf weer op.
      all.forEach((s) => {
        if (s.readingCount > 0 && s.kpaSum === 0) {
          backfillSessionAggregates(uid, s.id).catch(() => {});
        }
      });
    });
    return () => unsub();
  }, [uid]);

  const week = useMemo(() => computeWindow(sessions, Date.now() - 7 * DAY_MS), [sessions]);
  const month = useMemo(() => computeWindow(sessions, Date.now() - 30 * DAY_MS), [sessions]);
  const band = useMemo(() => computeBaselineBand(sessions), [sessions]);

  return { week, month, band, loading };
}
