"use client";

import type { User } from "firebase/auth";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/useAuth";
import { useOwnAccess } from "@/lib/useOwnAccess";

/**
 * Account: wie je gegevens kan lezen, met intrekken (P13, vereist vóór een
 * tweede cliënt), en uitloggen.
 */
function AccountInner({ user }: { user: User }) {
  const { coaches, loading, revoke } = useOwnAccess(user.uid);
  const { logOut } = useAuth();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRevoke(coachUid: string) {
    setBusy(true);
    try {
      await revoke(coachUid);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 border-b border-panel-border pb-3.5">
        <h1 className="text-[19px] font-semibold tracking-wide">Account</h1>
        <p className="text-[12.5px] text-muted">{user.email}</p>
      </header>

      <div className="space-y-3.5">
        <div className="panel">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Wie kan je gegevens lezen</h2>
          {loading ? (
            <div className="py-2 text-xs text-muted">...</div>
          ) : coaches.length === 0 ? (
            <p className="py-1.5 text-sm text-text">Niemand. Je gegevens zijn enkel voor jou zichtbaar.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">
                Een begeleider kan je sessies en metingen lezen, maar niets wijzigen.
              </p>
              {coaches.map((c) => (
                <div key={c.uid} className="border-t border-panel-border py-2.5 first:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text">{c.name}</span>
                    {confirming !== c.uid && (
                      <button
                        onClick={() => setConfirming(c.uid)}
                        className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
                      >
                        Toegang intrekken
                      </button>
                    )}
                  </div>
                  {confirming === c.uid && (
                    <div className="mt-2.5 space-y-2.5">
                      <p className="text-sm text-muted">
                        {c.name} kan daarna je gegevens niet meer lezen. Opnieuw toegang geven gebeurt via je
                        begeleider.
                      </p>
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => setConfirming(null)}
                          className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted"
                        >
                          Annuleer
                        </button>
                        <button
                          onClick={() => confirmRevoke(c.uid)}
                          disabled={busy}
                          className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text disabled:opacity-50"
                        >
                          Intrekken
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <button
          onClick={() => logOut()}
          className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
        >
          Uitloggen
        </button>
      </div>

      <TabBar uid={user.uid} />
    </div>
  );
}

export default function AccountPage() {
  return <AuthGate>{(user) => <AccountInner user={user} />}</AuthGate>;
}
