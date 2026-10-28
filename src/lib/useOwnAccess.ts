"use client";

import { arrayRemove, deleteDoc, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface CoachAccess {
  uid: string;
  name: string;
}

/**
 * Wie de eigen gegevens mag lezen (P13): `coachUids` op het eigen
 * gebruikersdocument. De naam komt uit `coachNames` ({ uid: naam }), gezet
 * bij het aanvaarden van een uitnodiging. Ontbreekt die (met de hand
 * gekoppeld), dan uit `coaches/{uid}`, dat een cliënt mag lezen voor de
 * begeleiders aan wie hij zelf toegang gaf.
 */
export function useOwnAccess(uid: string | null) {
  const [coaches, setCoaches] = useState<CoachAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setCoaches([]);
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    let generation = 0;
    const unsub = onSnapshot(doc(db, "users", uid), async (snap) => {
      const current = ++generation;
      const data = snap.data();
      const coachUids = (data?.coachUids as string[] | undefined) ?? [];
      const names = (data?.coachNames as Record<string, string> | undefined) ?? {};
      const resolved = await Promise.all(
        coachUids.map(async (c) => {
          if (names[c]) return { uid: c, name: names[c] };
          const name = await getDoc(doc(db, "coaches", c))
            .then((s) => s.data()?.name as string | undefined)
            .catch(() => undefined);
          return { uid: c, name: name || "Begeleider zonder naam" };
        })
      );
      if (current !== generation) return;
      setCoaches(resolved);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  /** Trekt de leestoegang van één begeleider in. Enkel de cliënt kan dit. */
  async function revoke(coachUid: string) {
    if (!uid) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, "users", uid), { coachUids: arrayRemove(coachUid) });
    // Koppeling opruimen zodat de cliënt uit de lijst van de begeleider
    // verdwijnt. Leesrecht is hierboven al ingetrokken, dus een fout hier
    // (bv. handmatig gekoppeld, geen link) is onschuldig.
    await deleteDoc(doc(db, "links", `${coachUid}_${uid}`)).catch(() => {});
  }

  return { coaches, loading, revoke };
}
