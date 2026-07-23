"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AveragesCard from "./AveragesCard";
import BandInfo from "./BandInfo";
import Co2Chart from "./Co2Chart";
import DailyProgress from "./DailyProgress";
import EntryTable from "./EntryTable";
import EventButtons from "./EventButtons";
import FeelingSelector from "./FeelingSelector";
import KpaInput from "./KpaInput";
import StatsRow from "./StatsRow";
import TrendChart from "./TrendChart";
import { useActiveSession } from "@/lib/useActiveSession";
import { useAuth } from "@/lib/useAuth";
import { useAverages } from "@/lib/useAverages";
import { fmtTime } from "@/lib/format";
import { exportSessionCsv } from "@/lib/exportCsv";
import { CART_TARGET_MINUTES } from "@/types/capnolog";

type ViewMode = "idle" | "active" | "review";

export default function SessionLogger({ uid }: { uid: string }) {
  const { week, month, band, sessionsToday, trend } = useAverages(uid);
  const {
    meta,
    entries,
    logReading,
    markDisturbance,
    logSigh,
    deleteEntry,
    setFeeling,
    startNewSession,
  } = useActiveSession(uid, band);
  const { logOut } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("idle");
  const [refocusToken, setRefocusToken] = useState(0);

  function bumpRefocus() {
    setRefocusToken((t) => t + 1);
  }

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!meta) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [meta]);

  const durationSec = meta ? (Date.now() - meta.createdAt) / 1000 : 0;
  const duration = fmtTime(durationSec);
  const cartTargetReached = durationSec >= CART_TARGET_MINUTES * 60;
  const hasSession = Boolean(meta && entries.length > 0);
  const chartBand = { low: meta?.bandLow ?? band.low, high: meta?.bandHigh ?? band.high };

  function confirmEndSession() {
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
          <DailyProgress sessionsToday={sessionsToday} />
          <AveragesCard week={week} month={month} />
          <TrendChart trend={trend} band={band} />

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

        <div className="mt-10 text-center">
          <button onClick={() => logOut()} className="text-xs text-muted hover:text-danger">
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === "review") {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-10">
        <header className="mb-4 border-b border-panel-border pb-3.5">
          <h1 className="text-[19px] font-semibold tracking-wide">Sessie afronden</h1>
          <p className="text-[12.5px] text-muted">Laatste controle voor je afsluit</p>
        </header>

        <div className="space-y-3.5">
          <FeelingSelector value={meta?.feeling} onChange={setFeeling} />

          <div className="panel">
            <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} />
          </div>

          <div className="panel">
            <StatsRow entries={entries} liveDurationFrom={meta?.createdAt ?? null} feeling={meta?.feeling} />
          </div>

          <div className="panel">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                Log &middot; verwijder eventuele anomalieën
              </h2>
            </div>
            <EntryTable entries={entries} onDelete={deleteEntry} />
          </div>

          <div className="space-y-2">
            <button
              onClick={confirmEndSession}
              className="w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
            >
              Bevestig en beëindig sessie
            </button>
            <button
              onClick={() => setViewMode("active")}
              className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted active:scale-[0.99]"
            >
              Terug naar sessie
            </button>
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
        <div className="text-right">
          <div className="font-mono text-2xl text-trace" style={{ textShadow: "0 0 14px rgba(94,234,160,0.35)" }}>
            {duration}
          </div>
          <div className="text-[10px] text-muted">
            {cartTargetReached ? "\u2713 CART-doel (17:00) bereikt" : `doel ${CART_TARGET_MINUTES}:00`}
          </div>
        </div>
      </header>

      <button
        onClick={() => setViewMode("review")}
        className="mb-2.5 w-full rounded-lg border border-amber bg-amber/10 py-3 text-sm font-semibold text-amber active:scale-[0.99]"
      >
        Beëindig sessie
      </button>

      <nav className="mb-4 flex gap-3 text-xs text-muted">
        <Link href="/sessions" className="underline decoration-panel-border underline-offset-2 hover:text-text">
          Geschiedenis
        </Link>
        {hasSession && (
          <button onClick={() => exportSessionCsv(entries, "co2-sessie", meta?.feeling)} className="hover:text-text">
            Exporteer CSV
          </button>
        )}
      </nav>

      <div className="space-y-3.5">
        <KpaInput onLog={logReading} refocusToken={refocusToken} />
        <EventButtons
          onMarkDisturbance={() => {
            markDisturbance();
            bumpRefocus();
          }}
          onSigh={(subtype) => {
            logSigh(subtype);
            bumpRefocus();
          }}
        />
        <FeelingSelector
          value={meta?.feeling}
          onChange={(feeling) => {
            setFeeling(feeling);
            bumpRefocus();
          }}
        />

        <div className="panel">
          <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} />
        </div>

        <div className="panel">
          <StatsRow entries={entries} liveDurationFrom={meta?.createdAt ?? null} feeling={meta?.feeling} />
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
