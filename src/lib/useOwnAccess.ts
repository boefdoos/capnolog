"use client";

import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { begeleidingText } from "./consentTexts";
import { addConsent, withdrawConsents } from "./consents";
import { getFirebaseDb } from "./firebase";

export const UNNAMED_COACH = "Begeleider zonder naam";

export interface CoachAccess {
  uid: string;
  // null zolang de naam nog opgezocht wordt.
  name: string | null;
  // Wanneer de cliënt toestemde (P16). null: toegang zonder record, van een
  // koppeling van voor de toestemmingsrecords of met de hand gemaakt.
  consentedAt: number | null;
}

/**
 * Wie de eigen gegevens mag lezen (P13): `coachUids` op het eigen
 * gebruikersdocument. De naam komt uit `coachNames` ({ uid: naam }), gezet
 * bij het aanvaarden van een uitnodiging. Ontbreekt die (met de hand
 * gekoppeld), dan uit `coaches/{uid}`, dat een cliënt mag lezen voor de
 * begeleiders aan wie hij zelf toegang gaf.
 */
export function useOwnAccess(uid: string | null) {
  const [coachList, setCoaches] = useState<Omit<CoachAccess, "consentedAt">[]>([]);
  const [consentedAt, setConsentedAt] = useState<Record<string, number>>({});
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
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
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
      },
      (err) => {
        // Geweigerd of afgebroken (bv. afgemeld in een ander tabblad): niet
        // eindeloos blijven laden.
        console.error("useOwnAccess", err);
        setLoading(false);
      }
    );
    // Geldige toestemmingen voor begeleiding, per begeleider de vroegste.
    const unsubConsents = onSnapshot(
      query(
        collection(db, "users", uid, "consents"),
        where("kind", "==", "begeleiding"),
        where("withdrawnAt", "==", null)
      ),
      (snap) => {
        const map: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const target = d.data().targetUid as string;
          // Net aangemaakt: grantedAt is lokaal nog leeg tot de server antwoordt.
          const at = (d.data().grantedAt as Timestamp | null)?.toMillis() ?? Date.now();
          map[target] = Math.min(map[target] ?? Infinity, at);
        });
        setConsentedAt(map);
      },
      () => setConsentedAt({})
    );
    return () => {
      unsub();
      unsubConsents();
    };
  }, [uid]);

  const coaches: CoachAccess[] = useMemo(
    () => coachList.map((c) => ({ ...c, consentedAt: consentedAt[c.uid] ?? null })),
    [coachList, consentedAt]
  );

  /** Trekt de leestoegang van één begeleider in, en in dezelfde batch de
   * toestemming (P16). Enkel de cliënt kan dit. */
  async function revoke(coachUid: string) {
    if (!uid) return;
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    batch.update(doc(db, "users", uid), { coachUids: arrayRemove(coachUid) });
    await withdrawConsents(batch, db, uid, "begeleiding", coachUid);
    await batch.commit();
    // Koppeling opruimen zodat de cliënt uit de lijst van de begeleider
    // verdwijnt. Leesrecht is hierboven al ingetrokken, dus een fout hier
    // (bv. handmatig gekoppeld, geen link) is onschuldig.
    await deleteDoc(doc(db, "links", `${coachUid}_${uid}`)).catch(() => {});
  }

  /** Toestemming vastleggen voor een bestaande koppeling zonder record. */
  async function confirm(coachUid: string, coachName: string) {
    if (!uid) return;
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    addConsent(batch, db, uid, "begeleiding", coachUid, begeleidingText(coachName));
    await batch.commit();
  }

  return { coaches, loading, revoke, confirm };
}
