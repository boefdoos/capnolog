"use client";

import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CartWeekTarget {
  week: number; // 1-4, verzadigt op 4
  targetRR: number; // ademhalingen/min
}

/**
 * Gegradueerd CART-doel (vergelijkend onderzoek capnometry-assisted
 * respiratory training bij paniekstoornis, Matig bewijsniveau, real-time
 * geverifieerd in eerder gesprek): dalend RR-doel per week, verzadigt op
 * week 4 en blijft daar staan, geen verdere automatische verlaging.
 */
export function computeCartWeekTarget(startDate: number): CartWeekTarget {
  const daysSince = Math.max(0, Math.floor((Date.now() - startDate) / DAY_MS));
  if (daysSince < 7) return { week: 1, targetRR: 13 };
  if (daysSince < 14) return { week: 2, targetRR: 11 };
  if (daysSince < 21) return { week: 3, targetRR: 9 };
  return { week: 4, targetRR: 6 };
}

export function useCartProtocol(uid: string | null) {
  const [startDate, setStartDate] = useState<number | null>(null);
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
      const data = snap.data() as { cartProtocolStartDate?: number } | undefined;
      setStartDate(data?.cartProtocolStartDate ?? null);
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

  async function activate() {
    if (!uid) return;
    const db = getFirebaseDb();
    const ref = doc(db, "users", uid, "settings", "protocol");
    const now = Date.now();
    await setDoc(ref, { cartProtocolStartDate: now }, { merge: true });
    setStartDate(now);
  }

  const target = startDate != null ? computeCartWeekTarget(startDate) : null;

  return { startDate, target, loading, activate };
}
