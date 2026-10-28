"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseDb } from "./firebase";

export interface Role {
  // Admin: maakt uitnodigingen voor begeleiders (met de hand aangemaakt in
  // de console, `admins/{uid}`).
  isAdmin: boolean;
  // Begeleider: via een uitnodiging (`coaches/{uid}`), of admin.
  isCoach: boolean;
}

// Laatst gekende rol, zoals hasClients in TabBar: zonder dit verschuift de
// tabbalk na elke herlaad even tot Firestore antwoordt.
const roleMemory = new Map<string, Role>();
const storageKey = (uid: string) => `capnolog.role.${uid}`;

function readRole(uid: string): Role | null {
  const known = roleMemory.get(uid);
  if (known) return known;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? (JSON.parse(raw) as Role) : null;
  } catch {
    return null;
  }
}

function writeRole(uid: string, role: Role) {
  roleMemory.set(uid, role);
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(role));
  } catch {
    // Opslag geblokkeerd (privévenster), enkel het geheugen blijft.
  }
}

/** Rol van de aangemelde gebruiker. `loading` enkel zolang er nog niets
 * gekend is, ook niet van een vorige keer. */
export function useRole(uid: string | null): Role & { loading: boolean } {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [coach, setCoach] = useState<boolean | null>(null);
  const cached = uid ? readRole(uid) : null;

  useEffect(() => {
    if (!uid) return;
    const db = getFirebaseDb();
    const unsubAdmin = onSnapshot(
      doc(db, "admins", uid),
      (snap) => setAdmin(snap.exists()),
      () => setAdmin(false)
    );
    const unsubCoach = onSnapshot(
      doc(db, "coaches", uid),
      (snap) => setCoach(snap.exists()),
      () => setCoach(false)
    );
    return () => {
      unsubAdmin();
      unsubCoach();
    };
  }, [uid]);

  const known = admin != null && coach != null;
  useEffect(() => {
    if (uid && known) writeRole(uid, { isAdmin: admin!, isCoach: coach! || admin! });
  }, [uid, known, admin, coach]);

  if (known) return { isAdmin: admin!, isCoach: coach! || admin!, loading: false };
  if (cached) return { ...cached, loading: false };
  return { isAdmin: false, isCoach: false, loading: !!uid };
}
