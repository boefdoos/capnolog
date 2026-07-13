"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AveragesCard from "./AveragesCard";
import BandInfo from "./BandInfo";
import Co2Chart from "./Co2Chart";
import EntryTable from "./EntryTable";
import EventButtons from "./EventButtons";
import KpaInput from "./KpaInput";
import StatsRow from "./StatsRow";
import { useActiveSession } from "@/lib/useActiveSession";
import { useAverages } from "@/lib/useAverages";
import { fmtTime } from "@/lib/format";
import { exportSessionCsv } from "@/lib/exportCsv";

type ViewMode = "idle" | "active";

export default function SessionLogger({ uid }: { uid: string }) {
  const { week, month, band } = useAverages(uid);
  const {
    meta,
    entries,
    logReading,
    markDisturbance,
    logSigh,
    deleteEntry,
    startNewSession,
  } = useActiveSession(uid, band);
  const [viewMode, setViewMode] = useState<ViewMode>("idle");

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!meta) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [meta]);

  const duration = meta ? fmtTime((Date.now() - meta.createdAt) / 1000) : "00:00";
  const hasSession = Boolean(meta && entries.length > 0);
  const chartBand = { low: meta?.bandLow ?? band.low, high: meta?.bandHigh ?? band.high };

  function endSession() {
    startNewSession();
    setViewMode("idle");
  }

  if (viewMode === "idle") {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-10">
        <header className="mb-4 border-b border-panel-border pb-3.5">
          <h1 className="text-[19px] font-semibold tracking-wide">CapnoLog</h1>
          <p className="text-[12.5px] text-muted">EMMA capnograaf &middot; ETCO2-sessies</p>
        </header>

        <div className="space-y-3.5">
          <AveragesCard week={week} month={month} />

          <button
            onClick={() => setViewMode("active")}
            className="w-full rounded-lg bg-trace py-4 text-base font-semibold text-[#06120B] active:scale-[0.99]"
          >
            Start nieuwe sessie
          </button>

          <div className="text-center">
            <Link
              href="/sessions"
              className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
            >
              Geschiedenis bekijken
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-3 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">ETCO2-sessie</h1>
          <p className="text-[12.5px] text-muted">Live log per ademhaling &middot; EMMA capnograaf</p>
        </div>
        <div className="font-mono text-2xl text-trace" style={{ textShadow: "0 0 14px rgba(94,234,160,0.35)" }}>
          {duration}
        </div>
      </header>

      <button
        onClick={endSession}
        className="mb-2.5 w-full rounded-lg border border-amber bg-amber/10 py-3 text-sm font-semibold text-amber active:scale-[0.99]"
      >
        Beëindig sessie
      </button>

      <nav className="mb-4 flex gap-3 text-xs text-muted">
        <Link href="/sessions" className="underline decoration-panel-border underline-offset-2 hover:text-text">
          Geschiedenis
        </Link>
        {hasSession && (
          <button onClick={() => exportSessionCsv(entries)} className="hover:text-text">
            Exporteer CSV
          </button>
        )}
      </nav>

      <div className="space-y-3.5">
        <KpaInput onLog={logReading} />
        <EventButtons onMarkDisturbance={markDisturbance} onSigh={logSigh} />

        <div className="panel">
          <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} />
        </div>

        <div className="panel">
          <StatsRow entries={entries} liveDurationFrom={meta?.createdAt ?? null} />
        </div>

        <BandInfo band={meta ? { ...band, low: meta.bandLow, high: meta.bandHigh } : band} />

        <div className="panel">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Log</h2>
          </div>
          <EntryTable entries={entries} onDelete={deleteEntry} />
        </div>
      </div>
    </div>
  );
}
