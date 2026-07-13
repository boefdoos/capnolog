"use client";

import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { deriveEntries, parseSessionMeta } from "./format";
import type { SessionMeta, StoredEntry } from "@/types/capnolog";

export function useSessionDetail(uid: string | null, sessionId: string | null) {
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [rawEntries, setRawEntries] = useState<StoredEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !sessionId) return;
    let cancelled = false;
    (async () => {
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, "users", uid, "sessions", sessionId));
      if (cancelled || !snap.exists()) return;
      setMeta(parseSessionMeta(snap.id, snap.data() as Record<string, unknown>));
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, sessionId]);

  useEffect(() => {
    if (!uid || !sessionId) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", uid, "sessions", sessionId, "entries"),
      orderBy("tSec", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRawEntries(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredEntry, "id">) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [uid, sessionId]);

  const entries = useMemo(() => deriveEntries(rawEntries), [rawEntries]);

  return { meta, entries, loading };
}
