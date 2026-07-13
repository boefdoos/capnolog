"use client";

import { collection, deleteDoc, doc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

/**
 * Verwijdert een sessiedocument en al zijn entries. Firestore verwijdert
 * subcollecties niet automatisch mee met het ouderdocument, dus die worden
 * hier apart opgehaald en in batches (max 500 writes) verwijderd.
 */
export async function deleteSessionCompletely(uid: string, sessionId: string): Promise<void> {
  const db = getFirebaseDb();
  const entriesRef = collection(db, "users", uid, "sessions", sessionId, "entries");
  const snap = await getDocs(entriesRef);

  const docs = snap.docs;
  const CHUNK = 450; // marge onder Firestore's limiet van 500 writes per batch
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, "users", uid, "sessions", sessionId));
}

/**
 * Herberekent readingCount/kpaSum/kpaSumSq vanuit de echte entries van een
 * sessie en schrijft dat terug naar het sessiedocument. Nodig voor sessies
 * die aangemaakt zijn voor kpaSum/kpaSumSq bestonden in het datamodel: die
 * hebben een correcte readingCount maar een kpaSum die op 0 is blijven
 * staan, wat het week/maandgemiddelde en de referentieband vertekent.
 */
export async function backfillSessionAggregates(uid: string, sessionId: string): Promise<void> {
  const db = getFirebaseDb();
  const entriesSnap = await getDocs(collection(db, "users", uid, "sessions", sessionId, "entries"));

  let readingCount = 0;
  let kpaSum = 0;
  let kpaSumSq = 0;
  entriesSnap.docs.forEach((d) => {
    const data = d.data() as { type?: string; kpa?: number };
    if (data.type === "reading" && typeof data.kpa === "number") {
      readingCount += 1;
      kpaSum += data.kpa;
      kpaSumSq += data.kpa * data.kpa;
    }
  });

  await updateDoc(doc(db, "users", uid, "sessions", sessionId), {
    readingCount,
    kpaSum,
    kpaSumSq,
  });
}
