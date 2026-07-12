"use client";

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "./firebase";

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
    const auth = getFirebaseAuth();
    // Vangt de terugkeer op na signInWithRedirect. Faalt stil als er geen
    // redirect-flow bezig was (normale paginabezoeken), dus geen noodzaak
    // om dit apart te onderscheiden van een gewone herlaad.
    getRedirectResult(auth).catch((err) => {
      setError(err?.message ?? "Aanmelden mislukt.");
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [configured]);

  async function signIn() {
    setError(null);
    await signInWithRedirect(getFirebaseAuth(), googleProvider);
  }

  async function logOut() {
    await signOut(getFirebaseAuth());
  }

  return { user, loading, configured, error, signIn, logOut };
}
