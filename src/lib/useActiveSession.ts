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
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFirebaseDb } from "./firebase";
import { deriveEntries } from "./format";
import { phaseForElapsedSec } from "./sessionPhase";
import type { BaselineBand } from "./useAverages";
import type {
  BreathSampling,
  SessionMeta,
  SessionPhase,
  SessionType,
  SighSubtype,
  StoredEntry,
} from "@/types/capnolog";

export function useActiveSession(
  uid: string | null,
  baselineBand: BaselineBand,
  sessionType: SessionType = "cart",
  // Enkel voor sessionType "cart" en enkel als het CART-protocol een
  // doelfrequentie kent (P1b). Rustcontroles en sessies zonder actief
  // protocol loggen per adem, zoals voorheen.
  sampling: BreathSampling | null = null
) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  // Starttijd van de sessie: gezet bij de tik op Start (`begin`), niet pas bij
  // de eerste log. Zo loopt de stille rust vanaf het moment dat je gaat zitten.
  // Het sessiedocument zelf ontstaat nog altijd pas bij de eerste log, maar
  // met deze starttijd als createdAt, dus tSec telt vanaf de tik.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  startedAtRef.current = startedAt;
  const [rawEntries, setRawEntries] = useState<StoredEntry[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  // `meta` wordt enkel bij aanmaak gevuld en daarna niet uit Firestore
  // gesynct (P11): readingCount, kpaSum, kpaSumSq en lastTSec blijven hier op
  // nul staan. Tijdens een sessie herreken je die uit `entries`.
  const metaRef = useRef<SessionMeta | null>(null);
  const bandRef = useRef(baselineBand);
  sessionIdRef.current = sessionId;
  metaRef.current = meta;
  bandRef.current = baselineBand;

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

  const sampleN = sampling?.n ?? 1;
  const entries = useMemo(() => deriveEntries(rawEntries, sampleN), [rawEntries, sampleN]);

  async function ensureSession(): Promise<{ id: string; createdAt: number }> {
    if (sessionIdRef.current && metaRef.current) {
      return { id: sessionIdRef.current, createdAt: metaRef.current.createdAt };
    }
    if (!uid) throw new Error("Niet aangemeld.");
    const db = getFirebaseDb();
    const ref = doc(collection(db, "users", uid, "sessions"));
    const createdAt = startedAtRef.current ?? Date.now();
    // Referentieband wordt bevroren bij sessiestart (zie computeBaselineBand,
    // of de vaste terugvalband bij te weinig data), niet live herberekend
    // terwijl je aan het loggen bent.
    const newMeta: SessionMeta = {
      id: ref.id,
      createdAt,
      sessionType,
      bandLow: bandRef.current.low,
      bandHigh: bandRef.current.high,
      readingCount: 0,
      kpaSum: 0,
      kpaSumSq: 0,
      sighSuccessCount: 0,
      sighTotalCount: 0,
      lastTSec: 0,
      // Enkel gezet als er effectief bemonsterd wordt (P1b); anders geen
      // veld, wat als per-adem (1) leest via parseSessionMeta.
      ...(sampling ? { logEveryNthBreath: sampling.n } : {}),
    };
    // Zelfde klok als tSec (P11): met serverTimestamp() zou de opgeslagen
    // starttijd bij klokverschil afwijken van de basis van alle tSec-waarden.
    await setDoc(ref, { ...newMeta, createdAt: Timestamp.fromMillis(createdAt) });
    sessionIdRef.current = ref.id;
    metaRef.current = newMeta;
    setSessionId(ref.id);
    setMeta(newMeta);
    return { id: ref.id, createdAt };
  }

  function nowTSec(createdAtMs: number): number {
    return Math.max(0, (Date.now() - createdAtMs) / 1000);
  }

  // Fase-tag enkel zinvol voor cart-sessies (P8); rustcontroles hebben geen
  // fasestructuur en blijven ongetagd. Firestore aanvaardt geen `undefined`
  // veldwaarden, dus dit levert een leeg object i.p.v. `{ phase: undefined }`.
  function phaseField(tSec: number): { phase: SessionPhase } | Record<string, never> {
    return sessionType === "cart" ? { phase: phaseForElapsedSec(tSec) } : {};
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
      ...phaseField(tSec),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), {
      readingCount: increment(1),
      kpaSum: increment(kpa),
      kpaSumSq: increment(kpa * kpa),
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
      ...phaseField(tSec),
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
      ...phaseField(tSec),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), {
      sighTotalCount: increment(1),
      sighSuccessCount: increment(subtype === "success" ? 1 : 0),
      lastTSec: tSec,
    });
  }

  /**
   * Rechtstreeks van het EMMA-scherm afgelezen ademfrequentie (P10), een
   * eigen entry-type los van `readingCount`/`kpaSum`: telt dus niet mee in
   * de ETCO2-aggregaten, enkel `lastTSec` volgt mee voor de sessieduur.
   */
  async function logRR(rrValue: number) {
    if (!uid) return;
    const { id, createdAt } = await ensureSession();
    const tSec = nowTSec(createdAt);
    const db = getFirebaseDb();
    await addDoc(collection(db, "users", uid, "sessions", id, "entries"), {
      type: "rr",
      rrValue,
      tSec,
      ...phaseField(tSec),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "users", uid, "sessions", id), { lastTSec: tSec });
  }

  async function deleteEntry(entry: StoredEntry) {
    if (!uid || !sessionId) return;
    const db = getFirebaseDb();
    await deleteDoc(doc(db, "users", uid, "sessions", sessionId, "entries", entry.id));
    const patch: Record<string, unknown> = {};
    if (entry.type === "reading") {
      const kpa = entry.kpa ?? 0;
      patch.readingCount = increment(-1);
      patch.kpaSum = increment(-kpa);
      patch.kpaSumSq = increment(-(kpa * kpa));
    }
    if (entry.type === "sigh") {
      patch.sighTotalCount = increment(-1);
      if (entry.subtype === "success") patch.sighSuccessCount = increment(-1);
    }
    if (Object.keys(patch).length) {
      await updateDoc(doc(db, "users", uid, "sessions", sessionId), patch);
    }
  }

  function startNewSession() {
    setSessionId(null);
    setMeta(null);
    setRawEntries([]);
    setStartedAt(null);
  }

  /** Start de klok, zonder al iets weg te schrijven (zie `startedAt`). */
  function begin() {
    if (startedAtRef.current == null) setStartedAt(Date.now());
  }

  async function setFeeling(feeling: SessionMeta["feeling"]) {
    if (!uid) return;
    const { id } = await ensureSession();
    const db = getFirebaseDb();
    await updateDoc(doc(db, "users", uid, "sessions", id), { feeling });
    // meta wordt niet live gesynct (enkel entries), dus lokaal meenemen
    // zodat de selector meteen de nieuwe keuze toont.
    setMeta((m) => (m ? { ...m, feeling } : m));
    if (metaRef.current) metaRef.current = { ...metaRef.current, feeling };
  }

  return {
    sessionId,
    meta,
    startedAt: meta?.createdAt ?? startedAt,
    begin,
    entries,
    logReading,
    markDisturbance,
    logSigh,
    logRR,
    deleteEntry,
    setFeeling,
    startNewSession,
  };
}
