"use client";

import Link from "next/link";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";
import { useSessionsList } from "@/lib/useSessionsList";
import { fmtTime } from "@/lib/format";
import { exportFullPeriodCsv, exportSessionsOverviewCsv, fetchSessionsInPeriod } from "@/lib/exportCsv";
import { FEELING_COLORS, FEELING_LABELS, SESSION_TYPE_LABELS, type SessionType } from "@/types/capnolog";

function SessionsListInner({ uid }: { uid: string }) {
  const { sessions, loading } = useSessionsList(uid);
  const [filter, setFilter] = useState<"alle" | SessionType>("alle");
  const [exportPeriod, setExportPeriod] = useState<"week" | "month">("week");
  const presentTypes = (["cart", "rustcontrole", "nulmeting"] as const).filter((t) =>
    sessions.some((s) => s.sessionType === t)
  );
  const visible = filter === "alle" ? sessions : sessions.filter((s) => s.sessionType === filter);
  const [exportingFull, setExportingFull] = useState<"week" | "month" | null>(null);
  const [exportingOverview, setExportingOverview] = useState<"week" | "month" | null>(null);

  async function handleOverviewExport(period: "week" | "month") {
    setExportingOverview(period);
    try {
      const sinceMs = Date.now() - (period === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
      const inPeriod = await fetchSessionsInPeriod(uid, sinceMs);
      exportSessionsOverviewCsv(inPeriod, `etco2-overzicht-${period === "week" ? "week" : "maand"}`);
    } catch {
      window.alert("Exporteren mislukt, probeer opnieuw.");
    } finally {
      setExportingOverview(null);
    }
  }

  async function handleFullExport(period: "week" | "month") {
    setExportingFull(period);
    try {
      const sinceMs = Date.now() - (period === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
      const inPeriod = await fetchSessionsInPeriod(uid, sinceMs);
      await exportFullPeriodCsv(uid, inPeriod, `etco2-volledig-${period === "week" ? "week" : "maand"}`);
    } catch {
      window.alert("Exporteren mislukt, probeer opnieuw.");
    } finally {
      setExportingFull(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Geschiedenis</h1>
          <p className="text-[12.5px] text-muted">Alle sessies en metingen</p>
        </div>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !sessions.length && (
        <div className="py-6 text-center text-xs text-muted">Nog geen sessies gelogd.</div>
      )}

      {!loading && presentTypes.length > 1 && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {(["alle", ...presentTypes] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                (filter === t ? "border-trace text-trace" : "border-panel-border text-muted")
              }
            >
              {t === "alle" ? "Alle" : SESSION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {/* Verwijderen gebeurt enkel in het sessiedetail (docs/ui_doorlichting.md G2). */}
      <div className="space-y-2">
        {visible.map((s) => {
          const avgKpa = s.readingCount > 0 ? s.kpaSum / s.readingCount : null;
          const sighPct =
            s.sighTotalCount > 0 ? Math.round((s.sighSuccessCount / s.sighTotalCount) * 100) : null;
          return (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              prefetch={false}
              className="panel flex items-center justify-between gap-3 hover:border-trace"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text">
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
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                      (s.sessionType === "cart" ? "border-panel-border text-muted" : "border-amber/60 text-amber")
                    }
                  >
                    {SESSION_TYPE_LABELS[s.sessionType]}
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
                <div className="mt-1 text-xs text-muted">
                  {s.readingCount} waarden &middot; {fmtTime(s.lastTSec)}
                  {sighPct != null && <> &middot; zucht gelukt {sighPct}%</>}
                </div>
              </div>
              {avgKpa != null && (
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xl text-trace">{avgKpa.toFixed(1)}</div>
                  <div className="text-[10px] text-muted">kPa</div>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {!loading && sessions.length > 0 && (
        <div className="panel mt-6">
          <h2 className="mb-1 text-[11px] uppercase tracking-wide text-muted">Exporteren</h2>
          <p className="mb-3 text-xs text-muted">CSV-bestand, bijvoorbeeld voor je begeleider of huisarts.</p>
          <div className="mb-3 flex gap-2">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setExportPeriod(p)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                  (exportPeriod === p ? "border-trace text-trace" : "border-panel-border text-muted")
                }
              >
                {p === "week" ? "Laatste 7 dagen" : "Laatste 30 dagen"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => handleOverviewExport(exportPeriod)}
              disabled={exportingOverview !== null}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text disabled:opacity-50"
            >
              {exportingOverview ? "bezig..." : "Samenvatting per sessie"}
            </button>
            <button
              onClick={() => handleFullExport(exportPeriod)}
              disabled={exportingFull !== null}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text disabled:opacity-50"
            >
              {exportingFull ? "bezig..." : "Alle meetwaarden"}
            </button>
          </div>
        </div>
      )}
      <TabBar uid={uid} />
    </div>
  );
}

export default function SessionsPage() {
  return <AuthGate>{(user) => <SessionsListInner uid={user.uid} />}</AuthGate>;
}
