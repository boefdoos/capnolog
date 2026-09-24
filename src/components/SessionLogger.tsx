"use client";

import { useEffect, useRef, useState } from "react";
import BandInfo from "./BandInfo";
import Co2Chart from "./Co2Chart";
import CompensationNote from "./CompensationNote";
import EntryTable from "./EntryTable";
import EventButtons from "./EventButtons";
import FeelingSelector from "./FeelingSelector";
import KpaInput from "./KpaInput";
import NowCard from "./NowCard";
import PhaseBadge from "./PhaseBadge";
import RRInput from "./RRInput";
import RustcontroleLogger from "./RustcontroleLogger";
import StatsRow from "./StatsRow";
import TabBar from "./TabBar";
import TrendChart from "./TrendChart";
import { checkCompensation } from "@/lib/compensation";
import { useActiveSession } from "@/lib/useActiveSession";
import { computeNulmetingSummary, useAverages } from "@/lib/useAverages";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { useRustcontrole } from "@/lib/useRustcontrole";
import { computeTrajectPhase } from "@/lib/traject";
import { useSessionCues } from "@/lib/useSessionCues";
import { unlockAudioContext } from "@/lib/pacer";
import { breathSamplingForTarget } from "@/lib/sessionPhase";
import { computeAvgKpa, computeAvgRR, fmtTime } from "@/lib/format";
import { exportSessionCsv } from "@/lib/exportCsv";
import { CART_TARGET_MINUTES } from "@/types/capnolog";

type ViewMode = "idle" | "active" | "review" | "rustcontrole" | "nulmeting";

export default function SessionLogger({ uid }: { uid: string }) {
  const { band, sessionsToday, trend, sessions, loading: averagesLoading } = useAverages(uid);
  const {
    startDate: cartStartDate,
    target: cartTarget,
    nulmetingBaseline,
    loading: protocolLoading,
  } = useCartProtocol(uid);
  const phase = computeTrajectPhase(cartStartDate);
  // Zolang protocol of sessies nog laden, geen protocol- of nulmetingregel:
  // anders staat er even "CART-protocol starten", en één tik daarop zou de
  // echte startdatum overschrijven.
  const protocolReady = !protocolLoading && !averagesLoading;
  const nulmetingSummary = computeNulmetingSummary(sessions);
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
    startedAt,
    begin,
  } = useActiveSession(uid, band, "cart", sampling);
  const rustcontrole = useRustcontrole(cartStartDate, sessions);
  const [viewMode, setViewMode] = useState<ViewMode>("idle");
  const [refocusToken, setRefocusToken] = useState(0);
  const [rrFocusToken, setRrFocusToken] = useState(0);
  const cues = useSessionCues(viewMode === "active", startedAt, cartTarget?.targetRR ?? null);

  function bumpRefocus() {
    setRefocusToken((t) => t + 1);
  }

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const durationSec = startedAt != null ? (Date.now() - startedAt) / 1000 : 0;
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

  if (viewMode === "rustcontrole" || viewMode === "nulmeting") {
    return <RustcontroleLogger uid={uid} band={band} kind={viewMode} onDone={() => setViewMode("idle")} />;
  }

  if (viewMode === "idle") {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-10">
        <header className="mb-4 border-b border-panel-border pb-3.5">
          <h1 className="text-[19px] font-semibold tracking-wide">CapnoLog</h1>
        </header>

        {/* Fase-opbouw (docs/ui_doorlichting.md §3.1): één kaart met de fase
            en de hoofdactie, daaronder de evolutie. Protocolbeheer en
            gemiddelden staan op het Trajectscherm. */}
        <div className="space-y-3.5">
          {protocolReady ? (
            <NowCard
              phase={phase}
              nulmetingCount={nulmetingSummary?.sessionCount ?? 0}
              sessionsToday={sessionsToday}
              rustcontrole={rustcontrole}
              onStartCart={() => {
                unlockAudioContext();
                begin();
                setViewMode("active");
              }}
              onStartRustcontrole={() => {
                unlockAudioContext();
                setViewMode("rustcontrole");
              }}
              onStartNulmeting={() => {
                unlockAudioContext();
                setViewMode("nulmeting");
              }}
            />
          ) : (
            <div className="panel py-10 text-center text-xs text-muted">...</div>
          )}

          <TrendChart trend={trend} band={band} nulmetingMeanKpa={nulmetingBaseline?.meanKpa ?? null} />
        </div>

        <TabBar uid={uid} />
      </div>
    );
  }

  if (viewMode === "review") {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-10">
        <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
          <div>
            <h1 className="text-[19px] font-semibold tracking-wide">Sessie afronden</h1>
            <p className="text-[12.5px] text-muted">Laatste controle voor je afsluit</p>
          </div>
          {hasSession && (
            <button
              onClick={() => exportSessionCsv(entries, meta?.createdAt ?? Date.now(), "co2-sessie", meta?.feeling)}
              className="text-xs text-muted underline decoration-panel-border underline-offset-2 hover:text-text"
            >
              Exporteer CSV
            </button>
          )}
        </header>

        {/* Alles wat tijdens het oefenen weg is (gevoel, grafiek, cijfers,
            band, log), staat hier (docs/ui_doorlichting.md §3.3). */}
        <div className="space-y-3.5">
          {hasSession ? (
            <>
              <FeelingSelector value={meta?.feeling} onChange={setFeeling} />

              <div className="panel">
                <Co2Chart entries={entries} bandLow={chartBand.low} bandHigh={chartBand.high} sampleN={sampleN} />
              </div>

              <StatsRow entries={entries} feeling={meta?.feeling} sampleN={sampleN} />

              <CompensationNote check={compensation} />

              <BandInfo band={meta ? { ...band, low: meta.bandLow, high: meta.bandHigh } : band} />

              <div className="panel">
                <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-muted">
                  Log &middot; verwijder eventuele anomalieën
                </h2>
                <EntryTable entries={entries} onDelete={deleteEntry} sampleN={sampleN} />
              </div>
            </>
          ) : (
            <div className="panel text-sm text-muted">Nog geen waarden gelogd. Er wordt niets opgeslagen.</div>
          )}

          <div className="space-y-2">
            <button
              onClick={confirmEndSession}
              className="w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
            >
              {hasSession ? "Bevestig en beëindig sessie" : "Sessie sluiten"}
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

  // Tijdens het oefenen enkel wat je nodig hebt: fase en streefdoel, het
  // invoerveld, verstoring en zucht. Geen grafiek of cijfers, de feedback
  // zit op het EMMA-scherm zelf (docs/ui_doorlichting.md §3.3).
  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-3 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">Oefensessie</h1>
          <p className="text-[12.5px] text-muted">
            {cartTargetReached ? "17 minuten bereikt" : `${CART_TARGET_MINUTES} minuten`}
          </p>
        </div>
        <div className="font-mono text-2xl text-trace">{duration}</div>
      </header>

      <div className="space-y-3.5">
        {cues.phase && <PhaseBadge cues={cues} target={cartTarget} />}

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

        <button
          onClick={() => setViewMode("review")}
          className={
            cartTargetReached
              ? "w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
              : "w-full py-3 text-xs text-muted underline decoration-panel-border underline-offset-2"
          }
        >
          Sessie beëindigen
        </button>
      </div>
    </div>
  );
}
