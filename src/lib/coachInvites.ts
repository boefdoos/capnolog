"use client";

import { doc, getDoc, serverTimestamp, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { randomCode } from "./invites";

const COACH_INVITE_DAYS = 14;

export interface CoachInvite {
  code: string;
  coachName: string;
  expiresAt: number;
  usedBy: string | null;
}

export function coachInviteUrl(code: string): string {
  return `${window.location.origin}/uitnodiging/begeleider/${code}`;
}

/**
 * Een admin (Thomas) nodigt een begeleider uit, typisch een kinesitherapeut.
 * Enkel wie zo'n uitnodiging verbruikt, krijgt een document in `coaches` en
 * kan daarna cliënten uitnodigen (firestore.rules).
 */
export async function createCoachInvite(adminUid: string, coachName: string): Promise<string> {
  const code = randomCode();
  await setDoc(doc(getFirebaseDb(), "coachInvites", code), {
    createdBy: adminUid,
    coachName,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + COACH_INVITE_DAYS * 24 * 60 * 60 * 1000),
    usedBy: null,
  });
  return code;
}

export async function getCoachInvite(code: string): Promise<CoachInvite | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "coachInvites", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    code,
    coachName: d.coachName ?? "",
    expiresAt: (d.expiresAt as Timestamp).toMillis(),
    usedBy: d.usedBy ?? null,
  };
}

/**
 * In één batch: de rol (`coaches/{uid}`), de naam die cliënten te zien
 * krijgen (displayName), en de code verbruikt. De regels laten de rol enkel
 * ontstaan samen met het verbruiken van een geldige uitnodiging.
 */
export async function acceptCoachInvite(uid: string, invite: CoachInvite, name: string) {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  batch.set(doc(db, "coaches", uid), { name, inviteCode: invite.code, createdAt: serverTimestamp() });
  batch.set(doc(db, "users", uid), { displayName: name }, { merge: true });
  batch.update(doc(db, "coachInvites", invite.code), { usedBy: uid, usedAt: serverTimestamp() });
  await batch.commit();
}
