"use client";

import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "./firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function signIn() {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }

  async function logOut() {
    await signOut(getFirebaseAuth());
  }

  return { user, loading, configured, signIn, logOut };
}
