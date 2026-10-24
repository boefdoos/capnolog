"use client";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

// Nooit een stuk van het account-ID tonen: dat leest als een foute code.
export const UNNAMED_CLIENT = "Cliënt zonder naam";

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
            return { uid: clientUid, name: displayName || linkName || UNNAMED_CLIENT };
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

/** Weergavenaam van één cliënt, met dezelfde terugval als in de lijst:
 * displayName op het document van de cliënt, dan de naam uit de uitnodiging
 * (links). `null` zolang dat laadt, zodat er niets flitst. */
export function useClientName(coachUid: string, clientUid: string): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const db = getFirebaseDb();
    async function load() {
      const fromUser = await getDoc(doc(db, "users", clientUid))
        .then((snap) => snap.data()?.displayName as string | undefined)
        .catch(() => undefined);
      if (fromUser) return fromUser;
      const fromLink = await getDoc(doc(db, "links", `${coachUid}_${clientUid}`))
        .then((snap) => snap.data()?.clientName as string | undefined)
        .catch(() => undefined);
      return fromLink || UNNAMED_CLIENT;
    }
    setName(null);
    void load().then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [coachUid, clientUid]);
  return name;
}
