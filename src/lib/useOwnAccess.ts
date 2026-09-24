"use client";

import { arrayRemove, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface CoachAccess {
  uid: string;
  name: string;
}

/**
 * Wie de eigen gegevens mag lezen (P13): `coachUids` op het eigen
 * gebruikersdocument. Een naam kan meegegeven worden in `coachNames`
 * ({ uid: naam }), met de hand gezet bij het koppelen, want het document van
 * de begeleider zelf is voor de cliënt niet leesbaar.
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
    const unsub = onSnapshot(doc(getFirebaseDb(), "users", uid), (snap) => {
      const data = snap.data();
      const coachUids = (data?.coachUids as string[] | undefined) ?? [];
      const names = (data?.coachNames as Record<string, string> | undefined) ?? {};
      setCoaches(coachUids.map((c) => ({ uid: c, name: names[c] ?? `Begeleider ${c.slice(0, 6)}` })));
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
