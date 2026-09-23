"use client";

import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import RustcontroleLogger from "@/components/RustcontroleLogger";
import TabBar from "@/components/TabBar";
import TrajectOverview from "@/components/TrajectOverview";
import { computeTrajectPhase, protocolEndDate } from "@/lib/traject";
import { computeNulmetingSummary, useAverages } from "@/lib/useAverages";
import { useAuth } from "@/lib/useAuth";
import { useCartProtocol } from "@/lib/useCartProtocol";
import { formatRustcontroleDate } from "@/lib/useRustcontrole";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trajectscherm (docs/ui_doorlichting.md §3.2). Enige plek waar het protocol
 * gestart of herstart wordt, met een bevestiging die zegt wat er verschuift,
 * en waar een losse meting buiten het venster kan.
 */
function TrajectInner({ uid }: { uid: string }) {
  const { week, month, band, sessions, loading: averagesLoading } = useAverages(uid);
  const { startDate, nulmetingBaseline, loading: protocolLoading, activate } = useCartProtocol(uid);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [measuring, setMeasuring] = useState<"rustcontrole" | "nulmeting" | null>(null);
  const { logOut } = useAuth();

  if (measuring) {
    return <RustcontroleLogger uid={uid} band={band} kind={measuring} onDone={() => setMeasuring(null)} />;
  }

  const ready = !averagesLoading && !protocolLoading;
  const phase = computeTrajectPhase(startDate);
  const nulmetingSummary = computeNulmetingSummary(sessions);
  const newEnd = protocolEndDate(Date.now());

  async function confirmStart() {
    setBusy(true);
    try {
      await activate(nulmetingSummary);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 border-b border-panel-border pb-3.5">
        <h1 className="text-[19px] font-semibold tracking-wide">Traject</h1>
        <p className="text-[12.5px] text-muted">Nulmeting, protocol en rustcontroles</p>
      </header>

      {!ready ? (
        <div className="py-6 text-center text-xs text-muted">...</div>
      ) : (
        <div className="space-y-3.5">
          <TrajectOverview
            startDate={startDate}
            sessions={sessions}
            nulmetingBaseline={nulmetingBaseline}
            week={week}
            month={month}
          />

          <div className="panel">
            <h2 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Losse meting</h2>
            <p className="mb-3 text-xs text-muted">Buiten de geplande momenten, bijvoorbeeld tijdens een afspraak.</p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setMeasuring("rustcontrole")}
                className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
              >
                Rustcontrole
              </button>
              <button
                onClick={() => setMeasuring("nulmeting")}
                className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
              >
                Nulmeting
              </button>
            </div>
          </div>

          <div className="panel">
            <h2 className="mb-2 text-[11px] uppercase tracking-wide text-muted">Protocol</h2>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]"
              >
                {startDate == null ? "Protocol starten" : "Protocol herstarten"}
              </button>
            ) : (
              <div className="space-y-2.5 text-sm text-text">
                <p>
                  Week 1 begint vandaag, met streefdoel 13/min. Het protocol loopt tot{" "}
                  {formatRustcontroleDate(newEnd)}.
                </p>
                <p className="text-muted">
                  De rustcontroles schuiven mee: de eerste valt dan op{" "}
                  {formatRustcontroleDate(newEnd + 7 * DAY_MS)}.
                  {phase.kind !== "nulmeting" && " De huidige planning vervalt."}
                  {!nulmetingBaseline &&
                    nulmetingSummary &&
                    ` De nulmeting (${nulmetingSummary.sessionCount} metingen) wordt vastgelegd.`}
                </p>
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-lg border border-panel-border py-3 text-sm font-semibold text-muted active:scale-[0.99]"
                  >
                    Annuleer
                  </button>
                  <button
                    onClick={confirmStart}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-trace py-3 text-sm font-semibold text-[#06120B] active:scale-[0.99] disabled:opacity-50"
                  >
                    {startDate == null ? "Start protocol" : "Herstart protocol"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <button onClick={() => logOut()} className="text-xs text-muted hover:text-danger">
          Uitloggen
        </button>
      </div>

      <TabBar uid={uid} />
    </div>
  );
}

export default function TrajectPage() {
  return <AuthGate>{(user) => <TrajectInner uid={user.uid} />}</AuthGate>;
}
