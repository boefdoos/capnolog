"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import {
  type Firestore,
  clearIndexedDbPersistence,
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Lazily initialized on first call, only ever in the browser. This avoids
// touching the Firebase SDK during `next build` / server-side prerendering,
// where env vars for a not-yet-created Firebase project may be absent.
function ensureApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase mag enkel client-side geinitialiseerd worden.");
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}

// Lokale cache in IndexedDB: bij een koude start (op iOS vaak, de PWA wordt
// geregeld uit het geheugen gegooid) toont de app meteen de gegevens van de
// vorige keer en synct ze daarna, in plaats van eerst op het netwerk te
// wachten voor alle sessies. Meerdere tabbladen delen dezelfde cache. Waar
// IndexedDB niet beschikbaar is (privévenster), valt Firestore zelf terug op
// een cache in het geheugen.
export function getFirebaseDb(): Firestore {
  if (!db) {
    const firebaseApp = ensureApp();
    try {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Al geïnitialiseerd, bijvoorbeeld na een hot reload in dev.
      db = getFirestore(firebaseApp);
    }
  }
  return db;
}

/**
 * Wist de lokale cache na het afmelden: het zijn gezondheidsgegevens, en een
 * toestel kan gedeeld zijn (tablet in de praktijk, ook de begeleider heeft
 * cliëntdata in zijn cache). Lukt het wissen niet, bijvoorbeeld omdat een
 * ander tabblad de cache nog open heeft, dan blijft ze staan tot de volgende
 * keer; de regels laten zonder aanmelding toch niets meer lezen.
 */
export async function clearLocalData(): Promise<void> {
  if (!db) return;
  const current = db;
  db = null;
  try {
    await terminate(current);
    await clearIndexedDbPersistence(current);
  } catch {
    // zie hierboven
  }
}

/**
 * Zelfstandige debugfunctie: gebruikt uitsluitend de doc/getDoc uit deze
 * module's eigen (npm-gebundelde) Firestore-import, dus geen vermenging met
 * een apart CDN-geimporteerde SDK-kopie, die faalt op interne
 * instantie-checks van Firestore ondanks identiek versienummer.
 */
async function debugCartProtocol() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return { error: "niet ingelogd" };
  const ref = doc(getFirebaseDb(), "users", user.uid, "settings", "protocol");
  const snap = await getDoc(ref);
  const start = snap.exists() ? (snap.data() as { cartProtocolStartDate?: number }).cartProtocolStartDate : null;
  return {
    bestaatDoc: snap.exists(),
    ruweWaarde: start ?? null,
    alsDatum: start ? new Date(start).toString() : null,
    dagenGeleden: start ? Math.floor((Date.now() - start) / 86400000) : null,
    nu: new Date().toString(),
  };
}

// Debug-haakje voor de browserconsole. Firebase-webconfig is niet geheim,
// dit lekt niets.
if (typeof window !== "undefined") {
  (window as unknown as { __capnolog: unknown }).__capnolog = {
    getAuth: getFirebaseAuth,
    getDb: getFirebaseDb,
    debugCartProtocol,
  };
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
