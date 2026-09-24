"use client";

import { arrayRemove, doc, onSnapshot, updateDoc } from "firebase/firestore";
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
    await updateDoc(doc(getFirebaseDb(), "users", uid), { coachUids: arrayRemove(coachUid) });
  }

  return { coaches, loading, revoke };
}
