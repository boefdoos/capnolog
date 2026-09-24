"use client";

import { arrayUnion, doc, getDoc, serverTimestamp, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

const INVITE_DAYS = 14;
// Zonder verwarrende tekens (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface Invite {
  code: string;
  coachUid: string;
  coachName: string;
  clientName: string;
  expiresAt: number;
  usedBy: string | null;
}

function randomCode(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/uitnodiging/${code}`;
}

/**
 * Begeleider maakt een uitnodiging (P13). De code is lang genoeg om niet te
 * raden; wie ze heeft, kan één account koppelen, binnen INVITE_DAYS dagen.
 * De eigen naam wordt ook als displayName bewaard, voor een volgende keer.
 */
export async function createInvite(coachUid: string, coachName: string, clientName: string): Promise<string> {
  const db = getFirebaseDb();
  const code = randomCode();
  await setDoc(doc(db, "invites", code), {
    coachUid,
    coachName,
    clientName,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    usedBy: null,
  });
  await setDoc(doc(db, "users", coachUid), { displayName: coachName }, { merge: true });
  return code;
}

export async function getInvite(code: string): Promise<Invite | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "invites", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    code,
    coachUid: d.coachUid,
    coachName: d.coachName,
    clientName: d.clientName ?? "",
    expiresAt: (d.expiresAt as Timestamp).toMillis(),
    usedBy: d.usedBy ?? null,
  };
}

/**
 * De cliënt aanvaardt: in één batch krijgt de begeleider leesrecht
 * (`coachUids`, gecontroleerd door de regels), komt de koppeling in `links`
 * zodat ze in de lijst van de begeleider verschijnt, en is de code verbruikt.
 */
export async function acceptInvite(clientUid: string, invite: Invite, clientName: string) {
  const db = getFirebaseDb();
  const batch = writeBatch(db);
  batch.set(
    doc(db, "users", clientUid),
    {
      displayName: clientName,
      coachUids: arrayUnion(invite.coachUid),
      coachNames: { [invite.coachUid]: invite.coachName },
    },
    { merge: true }
  );
  batch.set(doc(db, "links", `${invite.coachUid}_${clientUid}`), {
    coachUid: invite.coachUid,
    clientUid,
    clientName,
    inviteCode: invite.code,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "invites", invite.code), { usedBy: clientUid, usedAt: serverTimestamp() });
  await batch.commit();
}
