"use client";

import type { User } from "firebase/auth";
import { useAuth } from "@/lib/useAuth";

export default function AuthGate({
  children,
}: {
  children: (user: User) => React.ReactNode;
}) {
  const { user, loading, configured, signIn } = useAuth();

  if (!configured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-muted">
        Firebase-config ontbreekt. Vul de env-variabelen in (zie .env.example) en herstart.
      </div>
    );
  }

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted text-sm">...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        <button
          onClick={() => signIn()}
          className="rounded-lg border border-panel-border bg-panel px-5 py-3 text-sm font-semibold text-text active:scale-95"
        >
          Aanmelden met Google
        </button>
      </div>
    );
  }

  return <>{children(user)}</>;
}
