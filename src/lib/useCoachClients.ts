"use client";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface CoachClient {
  uid: string;
  name: string;
}

/**
 * Cliënten van een begeleider (P13), uit twee bronnen: koppelingen in
 * `links` (via een uitnodigingslink) en, voor met de hand gekoppelde
 * cliënten, `clientUids` op het eigen gebruikersdocument. Geen van beide
 * verleent zelf toegang: leesrecht komt enkel uit `coachUids` bij de cliënt
 * (firestore.rules). Een cliënt die toegang intrekt, valt hier dus vanzelf
 * weg als onleesbaar.
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
    let manual: string[] | null = null;
    let linked: { uid: string; name: string }[] | null = null;
    let generation = 0;

    async function resolve() {
      if (manual == null || linked == null) return;
      const current = ++generation;
      const names = new Map<string, string>();
      linked.forEach((l) => names.set(l.uid, l.name));
      manual.forEach((m) => {
        if (!names.has(m)) names.set(m, "");
      });
      const resolved = await Promise.all(
        Array.from(names.entries()).map(async ([clientUid, linkName]) => {
          try {
            const clientSnap = await getDoc(doc(db, "users", clientUid));
            const displayName = clientSnap.data()?.displayName as string | undefined;
            return { uid: clientUid, name: displayName || linkName || clientUid.slice(0, 6) };
          } catch {
            // Geen leesrecht (meer): toegang niet verleend of ingetrokken.
            return null;
          }
        })
      );
      if (current !== generation) return;
      setClients(
        resolved.filter((c): c is CoachClient => c != null).sort((a, b) => a.name.localeCompare(b.name, "nl"))
      );
      setLoading(false);
    }

    const unsubUser = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        manual = (snap.data()?.clientUids as string[] | undefined) ?? [];
        void resolve();
      },
      () => {
        manual = [];
        void resolve();
      }
    );
    const unsubLinks = onSnapshot(
      query(collection(db, "links"), where("coachUid", "==", uid)),
      (snap) => {
        linked = snap.docs.map((d) => ({ uid: d.data().clientUid as string, name: (d.data().clientName as string) ?? "" }));
        void resolve();
      },
      () => {
        // Regels nog niet gepubliceerd of geen toegang: enkel de handmatige lijst.
        linked = [];
        void resolve();
      }
    );
    return () => {
      unsubUser();
      unsubLinks();
    };
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
