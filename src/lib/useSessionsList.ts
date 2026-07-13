"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { parseSessionMeta } from "./format";
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
      setSessions(snap.docs.map((d) => parseSessionMeta(d.id, d.data() as Record<string, unknown>)));
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { sessions, loading };
}
