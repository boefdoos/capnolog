"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

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

  async function logOut() {
    await signOut(getFirebaseAuth());
  }

  return { user, loading, configured, error, signIn, logOut };
}
