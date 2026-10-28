"use client";

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface CoachEntry {
  uid: string;
  name: string;
  since: number | null; // epoch ms; ontbreekt bij het naamdocument van de admin
  revokedAt: number | null; // epoch ms als de rol ingetrokken is
}

export interface OpenCoachInvite {
  code: string;
  coachName: string;
  expiresAt: number;
}

/**
 * Beheer van begeleiders voor de admin (P15): wie begeleider is, welke
 * uitnodigingen openstaan, en die rol of uitnodiging intrekken. Geeft geen
 * zicht op de cliënten van die begeleiders, bewust niet.
 */
export function useCoachAdmin(enabled: boolean) {
  const [coaches, setCoaches] = useState<CoachEntry[]>([]);
  const [invites, setInvites] = useState<OpenCoachInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const db = getFirebaseDb();
    let coachesReady = false;
    let invitesReady = false;
    const done = () => coachesReady && invitesReady && setLoading(false);

    const unsubCoaches = onSnapshot(
      collection(db, "coaches"),
      (snap) => {
        setCoaches(
          snap.docs
            .map((d) => ({
              uid: d.id,
              name: (d.data().name as string | undefined) || "Begeleider zonder naam",
              since: (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? null,
              revokedAt: (d.data().revokedAt as Timestamp | undefined)?.toMillis() ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "nl"))
        );
        coachesReady = true;
        done();
      },
      () => {
        coachesReady = true;
        done();
      }
    );
    const unsubInvites = onSnapshot(
      query(collection(db, "coachInvites"), where("usedBy", "==", null)),
      (snap) => {
        const now = Date.now();
        setInvites(
          snap.docs
            .map((d) => ({
              code: d.id,
              coachName: (d.data().coachName as string | undefined) ?? "",
              expiresAt: (d.data().expiresAt as Timestamp).toMillis(),
            }))
            .filter((i) => i.expiresAt > now)
            .sort((a, b) => a.expiresAt - b.expiresAt)
        );
        invitesReady = true;
        done();
      },
      () => {
        invitesReady = true;
        done();
      }
    );
    return () => {
      unsubCoaches();
      unsubInvites();
    };
  }, [enabled]);

  /** Rol intrekken: markeren, niet wissen. De begeleider verliest meteen de
   * toegang bij al zijn cliënten (firestore.rules, hasActiveCoachRole), en de
   * app weet nog dat het account begeleider was. De koppelingen blijven
   * staan, zodat een teruggegeven rol de toegang herstelt. */
  async function revokeCoach(uid: string) {
    await updateDoc(doc(getFirebaseDb(), "coaches", uid), { revokedAt: serverTimestamp() });
  }

  async function restoreCoach(uid: string) {
    await updateDoc(doc(getFirebaseDb(), "coaches", uid), { revokedAt: deleteField() });
  }

  async function revokeInvite(code: string) {
    await deleteDoc(doc(getFirebaseDb(), "coachInvites", code));
  }

  return { coaches, invites, loading, revokeCoach, restoreCoach, revokeInvite };
}
