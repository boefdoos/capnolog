"use client";

import { useState } from "react";
import InviteCoach from "./InviteCoach";
import Loading from "./Loading";
import { useCoachAdmin } from "@/lib/useCoachAdmin";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Beheer van begeleiders, enkel voor de admin (P15). Toont bewust niet welke
 * cliënten een begeleider heeft: die gaven toegang aan hun kinesist, niet
 * aan de admin.
 */
export default function CoachAdmin({ adminUid }: { adminUid: string }) {
  const { coaches, invites, loading, revokeCoach, restoreCoach, revokeInvite } = useCoachAdmin(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRevoke(uid: string) {
    setBusy(true);
    try {
      await revokeCoach(uid);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="panel">
        <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Begeleiders</h2>
        {loading ? (
          <Loading />
        ) : coaches.length === 0 ? (
          <p className="py-1.5 text-sm text-text">Nog geen begeleiders.</p>
        ) : (
          coaches.map((c) => (
            <div key={c.uid} className="border-t border-panel-border py-2.5 first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text">
                  {c.name}
                  {c.uid === adminUid && <span className="text-muted"> (jij)</span>}
                  {c.revokedAt != null ? (
                    <span className="block text-xs text-muted">rol ingetrokken op {fmtDate(c.revokedAt)}</span>
                  ) : (
                    c.since != null && <span className="block text-xs text-muted">sinds {fmtDate(c.since)}</span>
                  )}
                </span>
                {c.revokedAt != null && (
                  <button
                    onClick={() => restoreCoach(c.uid)}
                    className="shrink-0 text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
                  >
                    Rol teruggeven
                  </button>
                )}
                {c.revokedAt == null && c.uid !== adminUid && confirming !== c.uid && (
                  <button
                    onClick={() => setConfirming(c.uid)}
                    className="shrink-0 text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
                  >
                    Rol intrekken
                  </button>
                )}
              </div>
              {confirming === c.uid && (
                <div className="mt-2.5 space-y-2.5">
                  <p className="text-sm text-muted">
                    {c.name} kan daarna de gegevens van geen enkele cliënt meer lezen en geen cliënten meer
                    uitnodigen, en ziet bij het aanmelden enkel dat de rol ingetrokken is. De koppelingen blijven
                    bewaard: geef je de rol later terug, dan werkt de toegang weer.
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
          ))
        )}
      </div>

      {invites.length > 0 && (
        <div className="panel">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Openstaande uitnodigingen</h2>
          {invites.map((i) => (
            <div
              key={i.code}
              className="flex items-center justify-between gap-3 border-t border-panel-border py-2.5 first:border-t-0"
            >
              <span className="text-sm text-text">
                {i.coachName || "Zonder naam"}
                <span className="block text-xs text-muted">geldig tot {fmtDate(i.expiresAt)}</span>
              </span>
              <button
                onClick={() => revokeInvite(i.code)}
                className="shrink-0 text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
              >
                Intrekken
              </button>
            </div>
          ))}
        </div>
      )}

      <InviteCoach adminUid={adminUid} />
    </div>
  );
}
