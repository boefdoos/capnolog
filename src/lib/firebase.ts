"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore, doc, getDoc } from "firebase/firestore";

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

export function getFirebaseDb(): Firestore {
  if (!db) db = getFirestore(ensureApp());
  return db;
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
