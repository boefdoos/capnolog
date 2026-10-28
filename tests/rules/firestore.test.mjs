// Regeltests tegen de Firestore-emulator (P14, docs/plan_gegevensverwerking.md).
// Draaien met `npm run test:rules` (vraagt Java). Elke regelwijziging krijgt
// hier tests: wie mag lezen, wie niet, en wat er gebeurt na intrekken.

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const DAY = 24 * 60 * 60 * 1000;
const future = () => Timestamp.fromMillis(Date.now() + 14 * DAY);
const past = () => Timestamp.fromMillis(Date.now() - DAY);

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-capnolog",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await env.cleanup();
});

// Vaste uitgangssituatie: Thomas is admin, "kine" is begeleider van "client",
// "vreemde" heeft niets met wie dan ook te maken.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "admins/thomas"), {});
    await setDoc(doc(db, "coaches/kine"), { name: "Kine" });
    await setDoc(doc(db, "users/client"), { displayName: "Cliënt", coachUids: ["kine"] });
    await setDoc(doc(db, "users/client/sessions/s1"), { readingCount: 2, kpaSum: 9 });
    await setDoc(doc(db, "users/vreemde"), { displayName: "Vreemde" });
    await setDoc(doc(db, "coachInvites/NIEUW"), {
      createdBy: "thomas",
      coachName: "Nieuwe kine",
      expiresAt: future(),
      usedBy: null,
    });
    await setDoc(doc(db, "coachInvites/VERLOPEN"), {
      createdBy: "thomas",
      coachName: "Te laat",
      expiresAt: past(),
      usedBy: null,
    });
    await setDoc(doc(db, "invites/KLANT"), {
      coachUid: "kine",
      coachName: "Kine",
      clientName: "Nieuwe cliënt",
      expiresAt: future(),
      usedBy: null,
    });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

/** Zelfde batch als acceptCoachInvite in src/lib/coachInvites.ts. */
function acceptCoachInviteBatch(db, uid, code, name = "Nieuwe kine") {
  const batch = writeBatch(db);
  batch.set(doc(db, "coaches", uid), { name, inviteCode: code, createdAt: serverTimestamp() });
  batch.set(doc(db, "users", uid), { displayName: name }, { merge: true });
  batch.update(doc(db, "coachInvites", code), { usedBy: uid, usedAt: serverTimestamp() });
  return batch.commit();
}

/** Zelfde batch als acceptInvite in src/lib/invites.ts, met het
 * toestemmingsrecord uit addConsent (src/lib/consents.ts). */
function acceptClientInviteBatch(db, uid, code, coachUid = "kine") {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "users", uid, "consents")), {
    kind: "begeleiding",
    targetUid: coachUid,
    textVersion: "2026-10-28",
    text: "Kine kan je metingen lezen.",
    grantedAt: serverTimestamp(),
    withdrawnAt: null,
  });
  batch.set(
    doc(db, "users", uid),
    { displayName: "Nieuwe cliënt", coachUids: arrayUnion(coachUid), coachNames: { [coachUid]: "Kine" } },
    { merge: true }
  );
  batch.set(doc(db, "links", `${coachUid}_${uid}`), {
    coachUid,
    clientUid: uid,
    clientName: "Nieuwe cliënt",
    inviteCode: code,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "invites", code), { usedBy: uid, usedAt: serverTimestamp() });
  return batch.commit();
}

describe("gebruikersgegevens", () => {
  it("de eigenaar leest en schrijft de eigen sessies", async () => {
    await assertSucceeds(getDoc(doc(as("client"), "users/client/sessions/s1")));
    await assertSucceeds(setDoc(doc(as("client"), "users/client/sessions/s2"), { readingCount: 0 }));
  });

  it("een begeleider met toegang leest, maar schrijft niet", async () => {
    await assertSucceeds(getDoc(doc(as("kine"), "users/client/sessions/s1")));
    await assertFails(setDoc(doc(as("kine"), "users/client/sessions/s9"), { readingCount: 0 }));
    await assertFails(updateDoc(doc(as("kine"), "users/client"), { displayName: "Gewijzigd" }));
  });

  it("wie geen toegang kreeg, leest niets", async () => {
    await assertFails(getDoc(doc(as("vreemde"), "users/client/sessions/s1")));
    await assertFails(getDoc(doc(anonymous(), "users/client")));
  });

  it("na intrekken door de cliënt leest de begeleider niets meer", async () => {
    await assertSucceeds(updateDoc(doc(as("client"), "users/client"), { coachUids: [] }));
    await assertFails(getDoc(doc(as("kine"), "users/client/sessions/s1")));
  });
});

describe("toestemmingsrecords (P16)", () => {
  const consent = (overrides = {}) => ({
    kind: "begeleiding",
    targetUid: "kine",
    textVersion: "2026-10-28",
    text: "Kine kan je metingen lezen.",
    grantedAt: serverTimestamp(),
    withdrawnAt: null,
    ...overrides,
  });

  it("de eigenaar maakt een record aan en leest het", async () => {
    await assertSucceeds(setDoc(doc(as("client"), "users/client/consents/c1"), consent()));
    await assertSucceeds(getDoc(doc(as("client"), "users/client/consents/c1")));
  });

  it("een begeleider leest de records van de cliënt niet", async () => {
    await assertSucceeds(setDoc(doc(as("client"), "users/client/consents/c1"), consent()));
    await assertFails(getDoc(doc(as("kine"), "users/client/consents/c1")));
  });

  it("een record dat al ingetrokken is, of een onbekend soort, kan niet aangemaakt worden", async () => {
    await assertFails(setDoc(doc(as("client"), "users/client/consents/c2"), consent({ withdrawnAt: serverTimestamp() })));
    await assertFails(setDoc(doc(as("client"), "users/client/consents/c3"), consent({ kind: "onderzoek" })));
    await assertFails(setDoc(doc(as("client"), "users/client/consents/c4"), consent({ extra: 1 })));
  });

  it("intrekken kan één keer, de tekst wijzigen of het record wissen nooit", async () => {
    const ref = doc(as("client"), "users/client/consents/c1");
    await assertSucceeds(setDoc(ref, consent()));
    await assertFails(updateDoc(ref, { text: "Andere tekst" }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { withdrawnAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { withdrawnAt: serverTimestamp() }));
  });

  it("toegang intrekken en de toestemming intrekken gaan samen in één batch", async () => {
    await assertSucceeds(setDoc(doc(as("client"), "users/client/consents/c1"), consent()));
    const db = as("client");
    const batch = writeBatch(db);
    batch.update(doc(db, "users/client"), { coachUids: [] });
    batch.update(doc(db, "users/client/consents/c1"), { withdrawnAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(as("kine"), "users/client/sessions/s1")));
  });

  it("niemand anders maakt een record aan voor de cliënt", async () => {
    await assertFails(setDoc(doc(as("kine"), "users/client/consents/c1"), consent()));
  });
});

describe("rol vereist voor leesrecht (P15)", () => {
  const revoke = () => updateDoc(doc(as("thomas"), "coaches/kine"), { revokedAt: serverTimestamp() });

  it("met een ingetrokken rol leest een begeleider niets meer, ook met toegang van de cliënt", async () => {
    await assertSucceeds(revoke());
    await assertFails(getDoc(doc(as("kine"), "users/client/sessions/s1")));
  });

  it("met een ingetrokken rol nodigt een begeleider geen cliënten meer uit", async () => {
    await assertSucceeds(revoke());
    await assertFails(
      setDoc(doc(as("kine"), "invites/K2"), {
        coachUid: "kine",
        coachName: "Kine",
        clientName: "Y",
        expiresAt: future(),
        usedBy: null,
      })
    );
  });

  it("een ingetrokken begeleider ziet de eigen ingetrokken rol, maar kan ze niet terugzetten", async () => {
    await assertSucceeds(revoke());
    await assertSucceeds(getDoc(doc(as("kine"), "coaches/kine")));
    await assertFails(updateDoc(doc(as("kine"), "coaches/kine"), { revokedAt: deleteField() }));
  });

  it("de admin geeft de rol terug, en de toegang werkt weer zonder dat de cliënt iets doet", async () => {
    await assertSucceeds(revoke());
    await assertSucceeds(updateDoc(doc(as("thomas"), "coaches/kine"), { revokedAt: deleteField() }));
    await assertSucceeds(getDoc(doc(as("kine"), "users/client/sessions/s1")));
  });

  it("zonder roldocument leest een begeleider ook niets", async () => {
    await assertSucceeds(deleteDoc(doc(as("thomas"), "coaches/kine")));
    await assertFails(getDoc(doc(as("kine"), "users/client/sessions/s1")));
  });

  it("enkel de admin lijst begeleiders op en trekt een rol in", async () => {
    await assertSucceeds(getDocs(collection(as("thomas"), "coaches")));
    await assertFails(getDocs(collection(as("kine"), "coaches")));
    await assertFails(updateDoc(doc(as("vreemde"), "coaches/kine"), { revokedAt: serverTimestamp() }));
  });

  it("de admin leest de gegevens van cliënten van een andere begeleider niet", async () => {
    await assertFails(getDoc(doc(as("thomas"), "users/client/sessions/s1")));
  });
});

describe("admins", () => {
  it("enkel de eigenaar leest het eigen admin-document", async () => {
    await assertSucceeds(getDoc(doc(as("thomas"), "admins/thomas")));
    await assertFails(getDoc(doc(as("kine"), "admins/thomas")));
  });

  it("niemand maakt zichzelf admin vanuit de app", async () => {
    await assertFails(setDoc(doc(as("vreemde"), "admins/vreemde"), {}));
    await assertFails(setDoc(doc(as("thomas"), "admins/kine"), {}));
  });
});

describe("begeleiders (coaches)", () => {
  it("een cliënt leest de naam van de eigen begeleider, een ander niet", async () => {
    await assertSucceeds(getDoc(doc(as("client"), "coaches/kine")));
    await assertFails(getDoc(doc(as("vreemde"), "coaches/kine")));
  });

  it("zonder uitnodiging maakt niemand zichzelf begeleider", async () => {
    await assertFails(setDoc(doc(as("vreemde"), "coaches/vreemde"), { name: "Ik" }));
  });

  it("de admin maakt een eigen begeleidersdocument, enkel met een naam", async () => {
    await assertSucceeds(setDoc(doc(as("thomas"), "coaches/thomas"), { name: "Thomas" }));
  });

  it("de admin kan bij het eigen document geen andere velden zetten", async () => {
    await assertFails(setDoc(doc(as("thomas"), "coaches/thomas"), { name: "Thomas", extra: true }));
  });

  it("een begeleider wijzigt enkel de eigen naam", async () => {
    await assertSucceeds(updateDoc(doc(as("kine"), "coaches/kine"), { name: "Kine B." }));
    await assertFails(updateDoc(doc(as("kine"), "coaches/kine"), { inviteCode: "X" }));
  });
});

describe("begeleidersuitnodigingen (coachInvites)", () => {
  it("opvragen per code kan zonder account, een lijst enkel voor de admin", async () => {
    await assertSucceeds(getDoc(doc(anonymous(), "coachInvites/NIEUW")));
    await assertSucceeds(getDocs(collection(as("thomas"), "coachInvites")));
    await assertFails(getDocs(collection(as("kine"), "coachInvites")));
  });

  it("enkel de admin trekt een uitnodiging in", async () => {
    await assertFails(deleteDoc(doc(as("kine"), "coachInvites/NIEUW")));
    await assertSucceeds(deleteDoc(doc(as("thomas"), "coachInvites/NIEUW")));
  });

  it("enkel de admin maakt een uitnodiging", async () => {
    const data = { createdBy: "thomas", coachName: "X", expiresAt: future(), usedBy: null };
    await assertSucceeds(setDoc(doc(as("thomas"), "coachInvites/A"), data));
    await assertFails(setDoc(doc(as("kine"), "coachInvites/B"), { ...data, createdBy: "kine" }));
  });

  it("aanvaarden maakt de rol aan en verbruikt de code in één keer", async () => {
    await assertSucceeds(acceptCoachInviteBatch(as("nieuw"), "nieuw", "NIEUW"));
  });

  it("een verlopen uitnodiging aanvaarden lukt niet", async () => {
    await assertFails(acceptCoachInviteBatch(as("nieuw"), "nieuw", "VERLOPEN"));
  });

  it("een uitnodiging werkt maar één keer", async () => {
    await assertSucceeds(acceptCoachInviteBatch(as("nieuw"), "nieuw", "NIEUW"));
    await assertFails(acceptCoachInviteBatch(as("tweede"), "tweede", "NIEUW"));
  });

  it("de code verbruiken zonder de rol aan te maken, lukt niet", async () => {
    await assertFails(
      updateDoc(doc(as("nieuw"), "coachInvites/NIEUW"), { usedBy: "nieuw", usedAt: serverTimestamp() })
    );
  });

  it("wie al begeleider is, kan geen tweede uitnodiging aanvaarden", async () => {
    // Het geval dat op 28/10 stil mislukte: coaches/{uid} bestaat al.
    await assertFails(acceptCoachInviteBatch(as("kine"), "kine", "NIEUW"));
  });
});

describe("cliëntuitnodigingen (invites)", () => {
  const data = (coachUid) => ({ coachUid, coachName: "X", clientName: "Y", expiresAt: future(), usedBy: null });

  it("een begeleider en de admin maken een uitnodiging, een gewone gebruiker niet", async () => {
    await assertSucceeds(setDoc(doc(as("kine"), "invites/K1"), data("kine")));
    await assertSucceeds(setDoc(doc(as("thomas"), "invites/T1"), data("thomas")));
    await assertFails(setDoc(doc(as("vreemde"), "invites/V1"), data("vreemde")));
  });

  it("opvragen per code kan zonder account, een lijst nooit", async () => {
    await assertSucceeds(getDoc(doc(anonymous(), "invites/KLANT")));
    await assertFails(getDocs(collection(as("kine"), "invites")));
  });

  it("een cliënt aanvaardt en de begeleider kan daarna lezen", async () => {
    await assertSucceeds(acceptClientInviteBatch(as("nieuweklant"), "nieuweklant", "KLANT"));
    await assertSucceeds(getDoc(doc(as("kine"), "users/nieuweklant")));
  });

  it("een cliënt die al gekoppeld was, koppelt opnieuw met een nieuwe uitnodiging", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "links/kine_nieuweklant"), {
        coachUid: "kine",
        clientUid: "nieuweklant",
        clientName: "Oud",
        inviteCode: "OUD",
      })
    );
    await assertSucceeds(acceptClientInviteBatch(as("nieuweklant"), "nieuweklant", "KLANT"));
  });

  it("een koppeling zonder de uitnodiging te verbruiken lukt niet", async () => {
    await assertFails(
      setDoc(doc(as("vreemde"), "links/kine_vreemde"), {
        coachUid: "kine",
        clientUid: "vreemde",
        clientName: "Vreemde",
        inviteCode: "KLANT",
      })
    );
  });

  it("eenzelfde uitnodiging levert maar één koppeling op", async () => {
    await assertSucceeds(acceptClientInviteBatch(as("nieuweklant"), "nieuweklant", "KLANT"));
    await assertFails(acceptClientInviteBatch(as("vreemde"), "vreemde", "KLANT"));
    await assertFails(
      setDoc(doc(as("vreemde"), "links/kine_vreemde"), {
        coachUid: "kine",
        clientUid: "vreemde",
        clientName: "Vreemde",
        inviteCode: "KLANT",
      })
    );
  });

  it("een koppeling zonder geldige uitnodiging van die begeleider lukt niet", async () => {
    await assertFails(
      setDoc(doc(as("vreemde"), "links/thomas_vreemde"), {
        coachUid: "thomas",
        clientUid: "vreemde",
        inviteCode: "KLANT",
      })
    );
  });
});
