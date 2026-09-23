"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AveragesCard from "./AveragesCard";
import BandInfo from "./BandInfo";
import Co2Chart from "./Co2Chart";
import CompensationNote from "./CompensationNote";
import DailyProgress from "./DailyProgress";
import EntryTable from "./EntryTable";
import EventButtons from "./EventButtons";
import FeelingSelector from "./FeelingSelector";
import KpaInput from "./KpaInput";
import PhaseBadge from "./PhaseBadge";
import RRInput from "./RRInput";
import RustcontroleLogger from "./RustcontroleLogger";
import StatsRow from "./StatsRow";
import TrendChart from "./TrendChart";
import { checkCompensation } from "@/lib/compensation";
import { useActiveSession } from "@/lib/useActiveSession";
import { useAuth } from "@/lib/useAuth";
import { useAverages } from "@/lib/useAverages";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { formatRustcontroleDate, useRustcontrole } from "@/lib/useRustcontrole";
import { useSessionCues } from "@/lib/useSessionCues";
import { unlockAudioContext } from "@/lib/pacer";
import { breathSamplingForTarget } from "@/lib/sessionPhase";
import { computeAvgKpa, computeAvgRR, fmtTime } from "@/lib/format";
import { exportSessionCsv } from "@/lib/exportCsv";
import { CART_TARGET_MINUTES } from "@/types/capnolog";

type ViewMode = "idle" | "active" | "review" | "rustcontrole";

export default function SessionLogger({ uid }: { uid: string }) {
  const { week, month, band, sessionsToday, trend, sessions } = useAverages(uid);
  const { startDate: cartStartDate, target: cartTarget, activate: activateCartProtocol } = useCartProtocol(uid);
  // Bemonstering (P1b) hangt af van de weekdoelfrequentie: zonder actief
  // protocol is er geen doel, dus geen bemonstering, geen pacer, per-adem
  // loggen zoals voorheen.
  const sampling = breathSamplingForTarget(cartTarget?.targetRR ?? null);
  const sampleN = sampling?.n ?? 1;
  const {
    meta,
    entries,
    logReading,
    markDisturbance,
    logSigh,
    logRR,
    deleteEntry,
    setFeeling,
    startNewSession,
  } = useActiveSession(uid, band, "cart", sampling);
  const { logOut } = useAuth();
  const rustcontrole = useRustcontrole(cartStartDate, sessions);
  const [viewMode, setViewMode] = useState<ViewMode>("idle");
  const [refocusToken, setRefocusToken] = useState(0);
  const [rrFocusToken, setRrFocusToken] = useState(0);
  const cues = useSessionCues(viewMode === "active", meta?.createdAt ?? null, cartTarget?.targetRR ?? null);

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

  // Bij het bereiken van het CART-doel automatisch naar het afrondingsscherm,
  // maar hoogstens één keer per sessie: wie via "Terug naar sessie" verder
  // oefent, mag dat doen zonder meteen weer teruggeduwd te worden.
  const autoStoppedSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!meta || autoStoppedSessionIdRef.current === meta.id) return;
    if (viewMode === "active" && cartTargetReached) {
      autoStoppedSessionIdRef.current = meta.id;
      setViewMode("review");
    }
  }, [viewMode, cartTargetReached, meta]);
  const inRestPhase = cues.phase === "rest";
  // RR van de EMMA enkel in de ongestuurde fasen, één waarde per fase (P10):
  // tijdens gepaced ademen dicteert de pacer het tempo, daar valt niets te
  // meten. Het veld verdwijnt zodra de waarde voor deze fase gelogd is.
  const showRRInput =
    (cues.phase === "rest" || cues.phase === "transfer") &&
    !entries.some((e) => e.type === "rr" && e.phase === cues.phase);
  const chartBand = { low: meta?.bandLow ?? band.low, high: meta?.bandHigh ?? band.high };

  // meta.readingCount/kpaSum/lastTSec worden nooit live bijgewerkt (P11), dus
  // voor de huidige sessie uit de gesynchroniseerde entries herrekenen i.p.v.
  // uit meta te lezen. priorCartSessions sluit de huidige sessie uit: die
  // staat, eenmaal er iets gelogd is, ook al in `sessions` uit useAverages.
  const currentReadings = entries.filter((e) => e.type === "reading" && e.kpa != null);
  const compensation = checkCompensation(
    { avgRR: computeAvgRR(currentReadings, sampleN), avgKpa: computeAvgKpa(currentReadings) },
    sessions.filter((s) => s.id !== meta?.id)
  );

  function confirmEndSession() {
    startNewSession();
    setViewMode("idle");
  }

  if (viewMode === "rustcontrole") {
    return <RustcontroleLogger uid={uid} band={band} onDone={() => setViewMode("idle")} />;
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
            onClick={() => {
              unlockAudioContext();
              setViewMode("active");
            }}
            className="w-full rounded-lg bg-trace py-4 text-base font-semibold text-[#06120B] active:scale-[0.99]"
          >
            Start nieuwe sessie
          </button>

          <div className="text-center">
            <Link
              href="/sessions"
              prefetch={false}
              className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
            >
              Geschiedenis bekijken
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted">
          {cartTarget ? (
            <>
              CART-protocol: week {cartTarget.week} &middot; doel {cartTarget.targetRR}/min &middot;{" "}
              <button
                onClick={() => {
                  if (window.confirm("Protocol herstarten vanaf vandaag (terug naar week 1)?")) {
                    activateCartProtocol();
                  }
                }}
                className="underline decoration-panel-border underline-offset-2 hover:text-text"
              >
                herstart
              </button>
            </>
          ) : (
            <button
              onClick={() => activateCartProtocol()}
              className="underline decoration-panel-border underline-offset-2 hover:text-text"
            >
              CART-protocol starten (week 1 vanaf vandaag)
            </button>
          )}
        </div>

        {rustcontrole.availableNow ? (
          <div className="mt-2 text-center text-xs text-muted">
            Rustcontrole deze week beschikbaar &middot;{" "}
            <button
              onClick={() => setViewMode("rustcontrole")}
              className="underline decoration-panel-border underline-offset-2 hover:text-text"
            >
              start
            </button>
          </div>
        ) : (
          rustcontrole.nextDate != null && (
            // Enkel een datum, geen "over X dagen": dat zou een countdown worden.
            <div className="mt-2 text-center text-xs text-muted">
              Volgende rustcontrole: {formatRustcontroleDate(rustcontrole.nextDate)}
            </div>
          )
        )}

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
            <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} sampleN={sampleN} />
          </div>

          <div className="panel">
            <StatsRow
              entries={entries}
              liveDurationFrom={meta?.createdAt ?? null}
              feeling={meta?.feeling}
              sampleN={sampleN}
            />
          </div>

          <CompensationNote check={compensation} />

          <div className="panel">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                Log &middot; verwijder eventuele anomalieën
              </h2>
            </div>
            <EntryTable entries={entries} onDelete={deleteEntry} sampleN={sampleN} />
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
          <p className="text-[12.5px] text-muted">
            {sampleN > 1 ? `Bemonsterd loggen \u00b7 elke ${sampleN}de adem` : "Live log per ademhaling"} &middot; EMMA
            capnograaf
          </p>
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

      {cues.phase && <div className="mb-2.5"><PhaseBadge cues={cues} target={cartTarget} /></div>}

      <button
        onClick={() => setViewMode("review")}
        className="mb-2.5 w-full rounded-lg border border-amber bg-amber/10 py-3 text-sm font-semibold text-amber active:scale-[0.99]"
      >
        Beëindig sessie
      </button>

      <nav className="mb-4 flex gap-3 text-xs text-muted">
        <Link href="/sessions" prefetch={false} className="underline decoration-panel-border underline-offset-2 hover:text-text">
          Geschiedenis
        </Link>
        {hasSession && (
          <button onClick={() => exportSessionCsv(entries, meta?.createdAt ?? Date.now(), "co2-sessie", meta?.feeling)} className="hover:text-text">
            Exporteer CSV
          </button>
        )}
      </nav>

      <div className="space-y-3.5">
        <KpaInput
          onLog={logReading}
          onLogged={() => {
            if (showRRInput) setRrFocusToken((t) => t + 1);
          }}
          refocusToken={refocusToken}
        />
        {showRRInput && (
          <RRInput onLog={(rrValue) => logRR(rrValue)} onLogged={bumpRefocus} refocusToken={rrFocusToken} />
        )}
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

        {/* Tijdens stille rust geen grafiek, statistieken of band: die fase is
            de ongestuurde baseline-meting, en live feedback lokt sturen uit. */}
        {!inRestPhase && (
          <>
            <div className="panel">
              <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} sampleN={sampleN} />
            </div>

            <div className="panel">
              <StatsRow
                entries={entries}
                liveDurationFrom={meta?.createdAt ?? null}
                feeling={meta?.feeling}
                sampleN={sampleN}
              />
            </div>

            <BandInfo band={meta ? { ...band, low: meta.bandLow, high: meta.bandHigh } : band} />
          </>
        )}

        <div className="panel">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Log</h2>
          </div>
          <EntryTable entries={entries} onDelete={deleteEntry} sampleN={sampleN} />
        </div>
      </div>
    </div>
  );
}
