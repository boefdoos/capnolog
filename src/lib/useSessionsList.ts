"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";
import type { SessionMeta } from "@/types/capnolog";

export function useSessionsList(uid: string | null) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", uid, "sessions"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSessions(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const createdAt = data.createdAt;
          const createdAtMs =
            createdAt && typeof (createdAt as { toMillis?: () => number }).toMillis === "function"
              ? (createdAt as { toMillis: () => number }).toMillis()
              : Date.now();
          return {
            id: d.id,
            createdAt: createdAtMs,
            bandLow: (data.bandLow as number) ?? 3.8,
            bandHigh: (data.bandHigh as number) ?? 4.9,
            readingCount: (data.readingCount as number) ?? 0,
            sighSuccessCount: (data.sighSuccessCount as number) ?? 0,
            sighTotalCount: (data.sighTotalCount as number) ?? 0,
            lastTSec: (data.lastTSec as number) ?? 0,
          };
        })
      );
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { sessions, loading };
}
