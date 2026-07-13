"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { deriveEntries } from "./format";
import type { SessionMeta, SighSubtype, StoredEntry } from "@/types/capnolog";

const DEFAULT_BAND_LOW = 3.8;
const DEFAULT_BAND_HIGH = 4.9;

export function useActiveSession(uid: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [rawEntries, setRawEntries] = useState<StoredEntry[]>([]);
  const [bandLow, setBandLow] = useState(DEFAULT_BAND_LOW);
  const [bandHigh, setBandHigh] = useState(DEFAULT_BAND_HIGH);
  const sessionIdRef = useRef<string | null>(null);
  const metaRef = useRef<SessionMeta | null>(null);
  const bandRef = useRef({ bandLow: DEFAULT_BAND_LOW, bandHigh: DEFAULT_BAND_HIGH });
  sessionIdRef.current = sessionId;
  metaRef.current = meta;
  bandRef.current = { bandLow, bandHigh };

  // Live-sync entries of the active session.
  useEffect(() => {
    if (!uid || !sessionId) {
      setRawEntries([]);
      return;
    }
    const db = getFirebaseDb();
    const q = query(
      collection(db, "users", uid, "sessions", sessionId, "entries"),
      orderBy("tSec", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRawEntries(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredEntry, "id">) }))
      );
    });
    return () => unsub();
  }, [uid, sessionId]);

  const entries = useMemo(() => deriveEntries(rawEntries), [rawEntries]);

  async function ensureSession(): Promise<{ id: string; createdAt: number }> {
    if (sessionIdRef.current && metaRef.current) {
      return { id: sessionIdRef.current, createdAt: metaRef.current.createdAt };
    }
    if (!uid) throw new Error("Niet aangemeld.");
    const db = getFirebaseDb();
    const ref = doc(collection(db, "users", uid, "sessions"));
    const createdAt = Date.now();
    const newMeta: SessionMeta = {
      id: ref.id,
      createdAt,
      bandLow: bandRef.current.bandLow,
      bandHigh: bandRef.current.bandHigh,
      readingCount: 0,
      kpaSum: 0,
      sighSuccessCount: 0,
      sighTotalCount: 0,
      lastTSec: 0,
    };
    await setDoc(ref, { ...newMeta, createdAt: serverTimestamp() });
    sessionIdRef.current = ref.id;
    metaRef.current = newMeta;
    setSessionId(ref.id);
    setMeta(newMeta);
    return { id: ref.id, createdAt };
  }

  function nowTSec(createdAtMs: number): number {
    return Math.max(0, (Date.now() - createdAtMs) / 1000);
  }

  async function logReading(kpa: number) {
    if (!uid) return;
    const { id, createdAt } = await ensureSession();
    const tSec = nowTSec(createdAt);
    const db = getFirebaseDb();
    await addDoc(collection(db, "users", uid, "sessions", id, "entries"), {
      type: "reading",
      kpa,
      tSec,
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), {
      readingCount: increment(1),
      kpaSum: increment(kpa),
      lastTSec: tSec,
    });
  }

  async function markDisturbance() {
    if (!uid) return;
    const { id, createdAt } = await ensureSession();
    const tSec = nowTSec(createdAt);
    const db = getFirebaseDb();
    await addDoc(collection(db, "users", uid, "sessions", id, "entries"), {
      type: "marker",
      tSec,
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), { lastTSec: tSec });
  }

  async function logSigh(subtype: SighSubtype) {
    if (!uid) return;
    const { id, createdAt } = await ensureSession();
    const tSec = nowTSec(createdAt);
    const db = getFirebaseDb();
    await addDoc(collection(db, "users", uid, "sessions", id, "entries"), {
      type: "sigh",
      subtype,
      tSec,
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), {
      sighTotalCount: increment(1),
      sighSuccessCount: increment(subtype === "success" ? 1 : 0),
      lastTSec: tSec,
    });
  }

  async function deleteEntry(entry: StoredEntry) {
    if (!uid || !sessionId) return;
    const db = getFirebaseDb();
    await deleteDoc(doc(db, "users", uid, "sessions", sessionId, "entries", entry.id));
    const patch: Record<string, unknown> = {};
    if (entry.type === "reading") {
      patch.readingCount = increment(-1);
      patch.kpaSum = increment(-(entry.kpa ?? 0));
    }
    if (entry.type === "sigh") {
      patch.sighTotalCount = increment(-1);
      if (entry.subtype === "success") patch.sighSuccessCount = increment(-1);
    }
    if (Object.keys(patch).length) {
      await updateDoc(doc(db, "users", uid, "sessions", sessionId), patch);
    }
  }

  async function updateBand(low: number, high: number) {
    setBandLow(low);
    setBandHigh(high);
    if (!uid || !sessionIdRef.current) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "users", uid, "sessions", sessionIdRef.current), {
      bandLow: low,
      bandHigh: high,
    });
  }

  function startNewSession() {
    setSessionId(null);
    setMeta(null);
    setRawEntries([]);
  }

  return {
    sessionId,
    meta,
    entries,
    bandLow,
    bandHigh,
    logReading,
    markDisturbance,
    logSigh,
    deleteEntry,
    updateBand,
    startNewSession,
  };
}
