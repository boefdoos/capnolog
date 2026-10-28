"use client";

import { arrayRemove, deleteDoc, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export const UNNAMED_COACH = "Begeleider zonder naam";

export interface CoachAccess {
  uid: string;
  // null zolang de naam nog opgezocht wordt.
  name: string | null;
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
    // Namen die al opgezocht worden, zodat een volgende snapshot niet
    // opnieuw dezelfde aanvraag start.
    const pending = new Set<string>();
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data();
      const coachUids = (data?.coachUids as string[] | undefined) ?? [];
      const names = (data?.coachNames as Record<string, string> | undefined) ?? {};
      // Lijst meteen tonen, ook als een naam nog ontbreekt: niet wachten op
      // de server voor iets wat enkel een naam is.
      setCoaches(coachUids.map((c) => ({ uid: c, name: names[c] || null })));
      setLoading(false);

      coachUids
        .filter((c) => !names[c] && !pending.has(c))
        .forEach((c) => {
          pending.add(c);
          getDoc(doc(db, "coaches", c))
            .then((s) => s.data()?.name as string | undefined)
            .catch(() => undefined)
            .then((name) => {
              const shown = name || UNNAMED_COACH;
              setCoaches((prev) => prev.map((x) => (x.uid === c ? { ...x, name: shown } : x)));
              // Op het eigen document bewaren, zodat het de volgende keer
              // meteen klopt. De snapshot die daarop volgt, zoekt niets meer op.
              if (name) {
                updateDoc(doc(db, "users", uid), { [`coachNames.${c}`]: name }).catch(() => {});
              }
            });
        });
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
