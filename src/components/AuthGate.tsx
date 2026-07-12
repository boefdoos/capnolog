"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

export default function AuthGate({
  children,
}: {
  children: (user: User) => React.ReactNode;
}) {
  const { user, loading, configured, error, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setSubmitting(true);
      try {
        await signIn(email, password);
      } catch {
        // foutmelding zit al in de hook (error state)
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace"
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-trace px-5 py-3 text-sm font-semibold text-[#06120B] active:scale-95 disabled:opacity-50"
          >
            {submitting ? "..." : "Aanmelden"}
          </button>
        </form>
        {error && <div className="max-w-xs text-center text-xs text-danger">{error}</div>}
      </div>
    );
  }

  return <>{children(user)}</>;
}
