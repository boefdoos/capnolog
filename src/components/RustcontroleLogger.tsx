"use client";

import { useEffect, useState } from "react";
import KpaInput from "./KpaInput";
import { useActiveSession } from "@/lib/useActiveSession";
import { fmtTime } from "@/lib/format";
import type { BaselineBand } from "@/lib/useAverages";

/**
 * Rustcontrole: kort, niet-gestuurd meetmoment na afloop van het actieve
 * CART-protocol. Bewust geen Co2Chart, geen StatsRow, geen streefdoel,
 * geen FeelingSelector, geen zucht-oefening: alles wat tot sturen uitnodigt
 * hoort hier niet thuis (docs/plan_post_trial_rustcontroles.md).
 */
export default function RustcontroleLogger({
  uid,
  band,
  onDone,
}: {
  uid: string;
  band: BaselineBand;
  onDone: () => void;
}) {
  const { meta, logReading, markDisturbance, startNewSession } = useActiveSession(
    uid,
    band,
    "rustcontrole"
  );

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!meta) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [meta]);

  const durationSec = meta ? (Date.now() - meta.createdAt) / 1000 : 0;

  function finish() {
    startNewSession();
    onDone();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 border-b border-panel-border pb-3.5">
        <h1 className="text-[19px] font-semibold tracking-wide">Rustcontrole</h1>
        <p className="text-[12.5px] text-muted">
          90 seconden tot 3 minuten stil zitten, geen ademdoel, gewoon meten
        </p>
      </header>

      <div className="mb-3.5 text-center font-mono text-2xl text-trace">{fmtTime(durationSec)}</div>

      <div className="space-y-3.5">
        <KpaInput onLog={logReading} />

        <button
          onClick={() => markDisturbance()}
          className="w-full rounded-lg border border-amber py-2.5 text-sm font-semibold text-amber active:scale-[0.99]"
        >
          Markeer verstoring
        </button>

        <button
          onClick={finish}
          className="w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
        >
          Beëindig rustcontrole
        </button>
      </div>
    </div>
  );
}
