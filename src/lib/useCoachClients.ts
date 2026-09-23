"use client";

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface CoachClient {
  uid: string;
  name: string;
}

/**
 * Cliënten van een begeleider (P13). De lijst staat als `clientUids` op het
 * eigen gebruikersdocument van de begeleider, voor de piloot met de hand in
 * Firestore gezet. Die lijst verleent zelf geen toegang: leesrecht komt
 * enkel uit `coachUids` op het document van de cliënt (firestore.rules).
 * Een cliënt die toegang intrekt, verdwijnt hier dus vanzelf als onleesbaar.
 */
export function useCoachClients(uid: string | null) {
  const [clients, setClients] = useState<CoachClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setClients([]);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    const unsub = onSnapshot(doc(db, "users", uid), async (snap) => {
      const clientUids = (snap.data()?.clientUids as string[] | undefined) ?? [];
      const resolved = await Promise.all(
        clientUids.map(async (clientUid) => {
          try {
            const clientSnap = await getDoc(doc(db, "users", clientUid));
            const name = clientSnap.data()?.displayName as string | undefined;
            return { uid: clientUid, name: name ?? clientUid.slice(0, 6) };
          } catch {
            // Geen leesrecht (meer): toegang niet verleend of ingetrokken.
            return null;
          }
        })
      );
      setClients(resolved.filter((c): c is CoachClient => c != null));
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { clients, loading };
}

/** Weergavenaam van één cliënt, met dezelfde terugval als in de lijst. */
export function useClientName(clientUid: string): string {
  const [name, setName] = useState(clientUid.slice(0, 6));
  useEffect(() => {
    getDoc(doc(getFirebaseDb(), "users", clientUid))
      .then((snap) => {
        const displayName = snap.data()?.displayName as string | undefined;
        if (displayName) setName(displayName);
      })
      .catch(() => {});
  }, [clientUid]);
  return name;
}
