"use client";

import Link from "next/link";
import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import TabBar from "@/components/TabBar";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { useSessionsList } from "@/lib/useSessionsList";
import { fmtTime } from "@/lib/format";
import { exportFullPeriodCsv, exportSessionsOverviewCsv, fetchSessionsInPeriod } from "@/lib/exportCsv";
import { FEELING_COLORS, FEELING_LABELS, SESSION_TYPE_LABELS, type SessionType } from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROTOCOL_TARGETS = [13, 11, 9, 6];

interface ExportPeriod {
  key: string;
  label: string;
  fileTag: string;
  from: number;
  to: number;
}

function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

/**
 * Exportperiodes: het volledige traject, en elke week afzonderlijk. Weken
 * tellen vanaf de protocolstart, zodat week 1 tot 4 de protocolweken zijn;
 * zonder protocol gewone kalenderweken vanaf maandag. Nieuwste week eerst.
 */
function exportPeriods(startDate: number | null): ExportPeriod[] {
  const now = Date.now();
  const all: ExportPeriod = { key: "traject", label: "Volledig traject", fileTag: "traject", from: 0, to: now + DAY_MS };
  const anchorDate = new Date(startDate ?? now);
  anchorDate.setHours(0, 0, 0, 0);
  if (startDate == null) anchorDate.setDate(anchorDate.getDate() - ((anchorDate.getDay() + 6) % 7));
  const anchor = anchorDate.getTime();
  const weeks: ExportPeriod[] = [];
  for (let n = 1; anchor + (n - 1) * 7 * DAY_MS <= now; n++) {
    const from = anchor + (n - 1) * 7 * DAY_MS;
    const to = from + 7 * DAY_MS;
    const range = `${fmtDay(from)} – ${fmtDay(to - DAY_MS)}`;
    const target = startDate != null && n <= 4 ? ` · ${PROTOCOL_TARGETS[n - 1]}/min` : "";
    weeks.push({
      key: `week-${n}`,
      label: startDate != null ? `Week ${n}${target} (${range})` : `Week van ${range}`,
      fileTag: startDate != null ? `week${n}` : `week-${new Date(from).toISOString().slice(0, 10)}`,
      from,
      to,
    });
  }
  return [all, ...weeks.reverse()];
}

function SessionsListInner({ uid }: { uid: string }) {
  const { sessions, loading } = useSessionsList(uid);
  const [filter, setFilter] = useState<"alle" | SessionType>("alle");
  const presentTypes = (["cart", "rustcontrole", "nulmeting"] as const).filter((t) =>
    sessions.some((s) => s.sessionType === t)
  );
  const visible = filter === "alle" ? sessions : sessions.filter((s) => s.sessionType === filter);
  const { startDate } = useCartProtocol(uid);
  const periods = exportPeriods(startDate);
  const [periodKey, setPeriodKey] = useState("traject");
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const [exporting, setExporting] = useState<"samenvatting" | "volledig" | null>(null);

  async function handleExport(kind: "samenvatting" | "volledig") {
    setExporting(kind);
    try {
      const inPeriod = await fetchSessionsInPeriod(uid, period.from, period.to);
      const name = `etco2-${kind}-${period.fileTag}`;
      if (kind === "samenvatting") exportSessionsOverviewCsv(inPeriod, name);
      else await exportFullPeriodCsv(uid, inPeriod, name);
    } catch {
      window.alert("Exporteren mislukt, probeer opnieuw.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Geschiedenis</h1>
          <p className="text-[12.5px] text-muted">Alle oefeningen en rustmetingen</p>
        </div>
      </header>

      {loading && <div className="py-6 text-center text-xs text-muted">...</div>}
      {!loading && !sessions.length && (
        <div className="py-6 text-center text-xs text-muted">Nog niets gelogd.</div>
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
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                      (s.sessionType === "cart" ? "border-panel-border text-muted" : "border-amber/60 text-amber")
                    }
                  >
                    {SESSION_TYPE_LABELS[s.sessionType]}
                  </span>
                  {s.feeling && (
                    <span className="flex items-center gap-1 text-xs text-muted">
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
                  <div className="text-[11px] text-muted">kPa</div>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {!loading && sessions.length > 0 && (
        <div className="panel mt-6">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Exporteren</h2>
          <p className="mb-3 text-xs text-muted">CSV-bestand, bijvoorbeeld voor je begeleider of huisarts.</p>
          <label className="mb-3 block space-y-1.5">
            <span className="text-xs text-muted">Periode</span>
            <select
              value={period.key}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="w-full rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-2.5 text-sm text-text outline-none focus:border-trace"
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => handleExport("samenvatting")}
              disabled={exporting !== null}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text disabled:opacity-50"
            >
              {exporting === "samenvatting" ? "bezig..." : "Samenvatting per sessie"}
            </button>
            <button
              onClick={() => handleExport("volledig")}
              disabled={exporting !== null}
              className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text disabled:opacity-50"
            >
              {exporting === "volledig" ? "bezig..." : "Alle meetwaarden"}
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
