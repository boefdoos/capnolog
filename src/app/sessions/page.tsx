"use client";

import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import { useSessionsList } from "@/lib/useSessionsList";
import { fmtTime } from "@/lib/format";

function SessionsListInner({ uid }: { uid: string }) {
  const { sessions, loading } = useSessionsList(uid);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Geschiedenis</h1>
          <p className="text-[12.5px] text-muted">Opgeslagen CO2-sessies</p>
        </div>
        <Link href="/" className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text">
          Nieuwe sessie
        </Link>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !sessions.length && (
        <div className="py-6 text-center text-xs text-muted">Nog geen sessies gelogd.</div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/sessions/${s.id}`}
            className="panel flex items-center justify-between hover:border-trace"
          >
            <div>
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
            </div>
            <div className="text-muted">&rsaquo;</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return <AuthGate>{(user) => <SessionsListInner uid={user.uid} />}</AuthGate>;
}
