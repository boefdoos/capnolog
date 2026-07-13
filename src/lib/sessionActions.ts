"use client";

import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
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
