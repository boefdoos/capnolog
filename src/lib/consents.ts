"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import { CONSENT_TEXT_VERSION, type ConsentKind } from "./consentTexts";

/** Voegt een toestemmingsrecord toe aan een batch, samen met de wijziging
 * die de toegang zelf geeft (P16). De regels laten het record daarna enkel
 * nog intrekken. */
export function addConsent(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  kind: ConsentKind,
  targetUid: string,
  text: string
) {
  batch.set(doc(collection(db, "users", uid, "consents")), {
    kind,
    targetUid,
    textVersion: CONSENT_TEXT_VERSION,
    text,
    grantedAt: serverTimestamp(),
    withdrawnAt: null,
  });
}

/** Zet `withdrawnAt` op alle nog geldige records van deze soort voor deze
 * persoon, in dezelfde batch als het intrekken van de toegang. */
export async function withdrawConsents(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  kind: ConsentKind,
  targetUid: string
) {
  const active = await getDocs(
    query(
      collection(db, "users", uid, "consents"),
      where("kind", "==", kind),
      where("targetUid", "==", targetUid),
      where("withdrawnAt", "==", null)
    )
  );
  active.docs.forEach((d) => batch.update(d.ref, { withdrawnAt: serverTimestamp() }));
}
