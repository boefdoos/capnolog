"use client";

import Link from "next/link";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import { useSessionsList } from "@/lib/useSessionsList";
import { fmtTime } from "@/lib/format";
import { deleteSessionCompletely } from "@/lib/sessionActions";

function SessionsListInner({ uid }: { uid: string }) {
  const { sessions, loading } = useSessionsList(uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(sessionId: string) {
    const ok = window.confirm(
      "Deze sessie en alle metingen erin definitief verwijderen? Dit kan niet ongedaan gemaakt worden."
    );
    if (!ok) return;
    setDeletingId(sessionId);
    try {
      await deleteSessionCompletely(uid, sessionId);
    } catch {
      window.alert("Verwijderen mislukt, probeer opnieuw.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Geschiedenis</h1>
          <p className="text-[12.5px] text-muted">Opgeslagen CO2-sessies</p>
        </div>
        <Link href="/" className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text">
          &lsaquo; Terug
        </Link>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !sessions.length && (
        <div className="py-6 text-center text-xs text-muted">Nog geen sessies gelogd.</div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="panel flex items-center justify-between gap-3 hover:border-trace">
            <Link href={`/sessions/${s.id}`} className="min-w-0 flex-1">
              <div className="text-sm text-text">
                {new Date(s.createdAt).toLocaleDateString("nl-BE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                <span className="text-muted">
                  {new Date(s.createdAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                {s.readingCount} metingen &middot; {fmtTime(s.lastTSec)}
                {s.sighTotalCount > 0 && (
                  <>
                    {" "}
                    &middot; BSR {s.sighSuccessCount}/{s.sighTotalCount}
                  </>
                )}
              </div>
            </Link>
            <button
              onClick={() => handleDelete(s.id)}
              disabled={deletingId === s.id}
              className="shrink-0 text-xs text-muted hover:text-danger disabled:opacity-50"
            >
              {deletingId === s.id ? "..." : "verwijder"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return <AuthGate>{(user) => <SessionsListInner uid={user.uid} />}</AuthGate>;
}
