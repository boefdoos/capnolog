"use client";

import { collection, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { parseSessionMeta } from "./format";
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
 * Referentieband = maandgemiddelde ± 1 standaarddeviatie, berekend uit de
 * per-sessie aggregaten (kpaSum, kpaSumSq) zodat geen individuele metingen
 * herlezen moeten worden. Bij minder dan MIN_READINGS_FOR_BASELINE metingen
 * in de laatste maand valt dit terug op de vaste 3.8-4.9 kPa band.
 */
function computeBaselineBand(monthSessions: SessionMeta[]): BaselineBand {
  const inWindow = monthSessions.filter((s) => s.readingCount > 0);
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
    const monthAgo = Date.now() - 30 * DAY_MS;
    // Enkel sessies uit de laatste maand ophalen; week is daar client-side
    // een subset van. Single-field range + orderBy op hetzelfde veld
    // (createdAt) heeft geen samengesteld Firestore-index nodig.
    const q = query(
      collection(db, "users", uid, "sessions"),
      where("createdAt", ">=", Timestamp.fromMillis(monthAgo)),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => parseSessionMeta(d.id, d.data() as Record<string, unknown>));
      setSessions(all);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const week = useMemo(() => computeWindow(sessions, Date.now() - 7 * DAY_MS), [sessions]);
  const month = useMemo(() => computeWindow(sessions, Date.now() - 30 * DAY_MS), [sessions]);
  const band = useMemo(() => computeBaselineBand(sessions), [sessions]);

  return { week, month, band, loading };
}
