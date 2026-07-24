"use client";

import Link from "next/link";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import { useSessionsList } from "@/lib/useSessionsList";
import { fmtTime } from "@/lib/format";
import { deleteSessionCompletely } from "@/lib/sessionActions";
import { exportFullPeriodCsv, exportSessionsOverviewCsv } from "@/lib/exportCsv";
import { FEELING_COLORS, FEELING_LABELS } from "@/types/capnolog";

function SessionsListInner({ uid }: { uid: string }) {
  const { sessions, loading } = useSessionsList(uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingFull, setExportingFull] = useState<"week" | "month" | null>(null);

  async function handleFullExport(period: "week" | "month") {
    setExportingFull(period);
    try {
      const sinceMs = Date.now() - (period === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
      const inPeriod = sessions.filter((s) => s.createdAt >= sinceMs);
      await exportFullPeriodCsv(uid, inPeriod, `etco2-volledig-${period === "week" ? "week" : "maand"}`);
    } catch {
      window.alert("Exporteren mislukt, probeer opnieuw.");
    } finally {
      setExportingFull(null);
    }
  }

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
          <p className="text-[12.5px] text-muted">Opgeslagen ETCO2-sessies</p>
        </div>
        <Link href="/" className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text">
          &lsaquo; Terug
        </Link>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !sessions.length && (
        <div className="py-6 text-center text-xs text-muted">Nog geen sessies gelogd.</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="mb-4 space-y-1.5 text-xs text-muted">
          <div className="flex gap-3">
            <span className="text-[10px] uppercase tracking-wide">Overzicht:</span>
            <button
              onClick={() => {
                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                exportSessionsOverviewCsv(
                  sessions.filter((s) => s.createdAt >= weekAgo),
                  "etco2-overzicht-week"
                );
              }}
              className="hover:text-text"
            >
              week
            </button>
            <button
              onClick={() => {
                const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                exportSessionsOverviewCsv(
                  sessions.filter((s) => s.createdAt >= monthAgo),
                  "etco2-overzicht-maand"
                );
              }}
              className="hover:text-text"
            >
              maand
            </button>
          </div>
          <div className="flex gap-3">
            <span className="text-[10px] uppercase tracking-wide">Volledig (alle datapunten):</span>
            <button
              onClick={() => handleFullExport("week")}
              disabled={exportingFull !== null}
              className="hover:text-text disabled:opacity-50"
            >
              {exportingFull === "week" ? "bezig..." : "week"}
            </button>
            <button
              onClick={() => handleFullExport("month")}
              disabled={exportingFull !== null}
              className="hover:text-text disabled:opacity-50"
            >
              {exportingFull === "month" ? "bezig..." : "maand"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => {
          const avgKpa = s.readingCount > 0 ? s.kpaSum / s.readingCount : null;
          const bsrPct =
            s.sighTotalCount > 0 ? Math.round((s.sighSuccessCount / s.sighTotalCount) * 100) : null;
          return (
            <div key={s.id} className="panel flex items-center justify-between gap-3 hover:border-trace">
              <Link href={`/sessions/${s.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm text-text">
                  <span>
                    {new Date(s.createdAt).toLocaleDateString("nl-BE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    <span className="text-muted">
                      {new Date(s.createdAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  {s.feeling && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: FEELING_COLORS[s.feeling] }}
                      />
                      {FEELING_LABELS[s.feeling]}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-xs text-muted">
                  {s.readingCount} metingen &middot; {fmtTime(s.lastTSec)}
                  {bsrPct != null && (
                    <>
                      {" "}
                      &middot; BSR {bsrPct}%
                    </>
                  )}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                {avgKpa != null && (
                  <div className="text-right">
                    <div className="font-mono text-xl text-trace">{avgKpa.toFixed(1)}</div>
                    <div className="text-[10px] text-muted">kPa</div>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="text-xs text-muted hover:text-danger disabled:opacity-50"
                >
                  {deletingId === s.id ? "..." : "verwijder"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return <AuthGate>{(user) => <SessionsListInner uid={user.uid} />}</AuthGate>;
}
