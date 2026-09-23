"use client";

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";
import type { NulmetingBaseline } from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CartWeekTarget {
  week: number; // 1-4, verzadigt op 4
  targetRR: number; // ademhalingen/min
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Gegradueerd CART-doel (vergelijkend onderzoek capnometry-assisted
 * respiratory training bij paniekstoornis, Matig bewijsniveau, real-time
 * geverifieerd in eerder gesprek): dalend RR-doel per week, verzadigt op
 * week 4 en blijft daar staan, geen verdere automatische verlaging.
 *
 * Telt in kalenderdagen (middernacht tot middernacht), niet in exacte
 * 24-uursblokken vanaf het activatie-tijdstip: anders zou "week 2" pas
 * beginnen op het uur-exacte moment van activeren, dagen later dan wat een
 * gebruiker intu\u00eftief als "week 2" beschouwt.
 */
export function computeCartWeekTarget(startDate: number): CartWeekTarget {
  const daysSince = Math.max(0, Math.round((startOfDay(Date.now()) - startOfDay(startDate)) / DAY_MS));
  if (daysSince < 7) return { week: 1, targetRR: 13 };
  if (daysSince < 14) return { week: 2, targetRR: 11 };
  if (daysSince < 21) return { week: 3, targetRR: 9 };
  return { week: 4, targetRR: 6 };
}

export function useCartProtocol(uid: string | null) {
  const [startDate, setStartDate] = useState<number | null>(null);
  const [nulmetingBaseline, setNulmetingBaseline] = useState<NulmetingBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!uid) {
      setStartDate(null);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    const ref = doc(db, "users", uid, "settings", "protocol");
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as
        | { cartProtocolStartDate?: number; nulmetingBaseline?: NulmetingBaseline }
        | undefined;
      setStartDate(data?.cartProtocolStartDate ?? null);
      setNulmetingBaseline(data?.nulmetingBaseline ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // computeCartWeekTarget leest Date.now() enkel op het moment van
  // renderen. Zonder deze eigen klok blijft de week hangen op de laatste
  // toevallige render (bv. wanneer de app dagenlang openstaat zonder
  // herlaad), ook al is de echte datum intussen een week verder.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /**
   * Start (of herstart) het protocol. De nulmeting wordt enkel bij de eerste
   * start bevroren (P12): een herstart overschrijft het oorspronkelijke
   * vertrekpunt nooit.
   */
  async function activate(nulmeting?: Omit<NulmetingBaseline, "frozenAt"> | null) {
    if (!uid) return;
    const db = getFirebaseDb();
    const ref = doc(db, "users", uid, "settings", "protocol");
    const now = Date.now();
    const freeze = !nulmetingBaseline && nulmeting ? { nulmetingBaseline: { ...nulmeting, frozenAt: now } } : {};
    await setDoc(ref, { cartProtocolStartDate: now, ...freeze }, { merge: true });
    setStartDate(now);
  }

  const target = startDate != null ? computeCartWeekTarget(startDate) : null;

  return { startDate, target, nulmetingBaseline, loading, activate };
}
