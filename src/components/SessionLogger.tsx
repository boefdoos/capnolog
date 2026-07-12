"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BandConfig from "./BandConfig";
import Co2Chart from "./Co2Chart";
import EntryTable from "./EntryTable";
import EventButtons from "./EventButtons";
import KpaInput from "./KpaInput";
import StatsRow from "./StatsRow";
import { useActiveSession } from "@/lib/useActiveSession";
import { fmtTime } from "@/lib/format";
import { exportSessionCsv } from "@/lib/exportCsv";

export default function SessionLogger({ uid }: { uid: string }) {
  const {
    meta,
    entries,
    bandLow,
    bandHigh,
    logReading,
    markComplaint,
    logSigh,
    deleteEntry,
    updateBand,
    startNewSession,
  } = useActiveSession(uid);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!meta) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [meta]);

  const duration = meta ? fmtTime((Date.now() - meta.createdAt) / 1000) : "00:00";

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">CO2-sessie</h1>
          <p className="text-[12.5px] text-muted">Live log per ademhaling &middot; EMMA capnograaf</p>
        </div>
        <div className="font-mono text-2xl text-trace" style={{ textShadow: "0 0 14px rgba(94,234,160,0.35)" }}>
          {duration}
        </div>
      </header>

      <nav className="mb-4 flex gap-3 text-xs text-muted">
        <Link href="/sessions" className="underline decoration-panel-border underline-offset-2 hover:text-text">
          Geschiedenis
        </Link>
        {meta && entries.length > 0 && (
          <>
            <button onClick={() => exportSessionCsv(entries)} className="hover:text-text">
              Exporteer CSV
            </button>
            <button onClick={startNewSession} className="hover:text-danger">
              Nieuwe sessie
            </button>
          </>
        )}
      </nav>

      <div className="space-y-3.5">
        <KpaInput onLog={logReading} />
        <EventButtons onMarkComplaint={markComplaint} onSigh={logSigh} />

        <div className="panel">
          <Co2Chart entries={entries} bandLow={bandLow} bandHigh={bandHigh} />
        </div>

        <div className="panel">
          <StatsRow entries={entries} liveDurationFrom={meta?.createdAt ?? null} />
        </div>

        <BandConfig bandLow={bandLow} bandHigh={bandHigh} onChange={updateBand} />

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
