"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { clearLocalData, getFirebaseAuth, isFirebaseConfigured } from "./firebase";

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "E-mail of wachtwoord onjuist.";
  }
  if (code === "auth/too-many-requests") return "Te veel pogingen, probeer straks opnieuw.";
  if (code === "auth/invalid-email") return "Ongeldig e-mailadres.";
  if (code === "auth/email-already-in-use") return "Er bestaat al een account met dit e-mailadres. Meld je aan.";
  if (code === "auth/weak-password") return "Kies een wachtwoord van minstens 6 tekens.";
  if (code === "auth/missing-email") return "Vul eerst je e-mailadres in.";
  return "Aanmelden mislukt.";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured] = useState(isFirebaseConfigured());

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [configured]);

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err) {
      setError(mapAuthError(err));
      throw err;
    }
  }

  /** Enkel bereikbaar via een uitnodigingslink (/uitnodiging/[code]). */
  async function signUp(email: string, password: string) {
    setError(null);
    try {
      await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err) {
      setError(mapAuthError(err));
      throw err;
    }
  }

  /** Stuurt een mail om het wachtwoord opnieuw in te stellen, in het Nederlands. */
  async function resetPassword(email: string) {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      auth.languageCode = "nl";
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(mapAuthError(err));
      throw err;
    }
  }

  /** Na het afmelden de lokale cache wissen en de pagina herladen: lopende
   * listeners hangen aan de gestopte Firestore-instantie, een herlaadbeurt
   * begint proper. Zelfde adres, zodat afmelden op een uitnodigingspagina
   * de uitnodiging niet verliest. */
  async function logOut() {
    await signOut(getFirebaseAuth());
    await clearLocalData();
    window.location.reload();
  }

  return { user, loading, configured, error, signIn, signUp, resetPassword, logOut };
}
