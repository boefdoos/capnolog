"use client";

import { useEffect, useRef, useState } from "react";
import KpaInput from "./KpaInput";
import { useActiveSession } from "@/lib/useActiveSession";
import { fmtTime } from "@/lib/format";
import { fireLogCue } from "@/lib/pacer";
import { restCueCount } from "@/lib/sessionPhase";
import { useWakeLock } from "@/lib/useWakeLock";
import type { BaselineBand } from "@/lib/useAverages";
import { REST_CUE_SEC, REST_MEASUREMENT_SEC } from "@/types/capnolog";

const TARGET_VALUES = REST_CUE_SEC.length;

/**
 * Rustmeting: kort, niet-gestuurd meetmoment. Dient voor de rustcontrole na
 * het protocol en voor de nulmeting ervoor (P12), enkel sessietype en titel
 * verschillen. Zelfde vorm als de stille rust aan het begin van een
 * oefensessie: de klok start bij het openen, een geluidssignaal na 1 en na
 * bijna 2 minuten vraagt telkens één waarde. Bewust geen grafiek, geen
 * statistieken, geen streefdoel: alles wat tot sturen uitnodigt hoort hier
 * niet thuis (docs/plan_post_trial_rustcontroles.md).
 */
export default function RustcontroleLogger({
  uid,
  band,
  kind = "rustcontrole",
  onDone,
}: {
  uid: string;
  band: BaselineBand;
  kind?: "rustcontrole" | "nulmeting";
  onDone: () => void;
}) {
  const { entries, logReading, startNewSession, startedAt, begin } = useActiveSession(
    uid,
    band,
    kind
  );
  const title = kind === "nulmeting" ? "Nulmeting" : "Rustcontrole";
  const [refocusToken, setRefocusToken] = useState(0);

  // De tik die dit scherm opende, is de start.
  useEffect(() => {
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = startedAt != null ? (Date.now() - startedAt) / 1000 : 0;
  const cuesFired = restCueCount(elapsedSec);
  const valueCount = entries.filter((e) => e.type === "reading").length;
  // Klaar pas bij twee waarden: het tweede signaal valt op 110 s, een vaste
  // eindtijd liet te weinig tijd om die waarde nog in te tikken. Na de
  // meettijd kan je wel zelf afronden met één waarde.
  const done = valueCount >= TARGET_VALUES;
  const canFinishEarly = !done && valueCount > 0 && elapsedSec >= REST_MEASUREMENT_SEC;
  // Scherm aan tot de meting klaar is, anders vallen de signalen weg.
  useWakeLock(!done);

  const lastCueRef = useRef(0);
  useEffect(() => {
    if (cuesFired > lastCueRef.current) {
      lastCueRef.current = cuesFired;
      fireLogCue();
      setRefocusToken((t) => t + 1);
    }
  }, [cuesFired]);

  const status = done
    ? "Klaar. Je kunt afronden."
    : cuesFired > valueCount
      ? `Lees de ETCO2-waarde af en tik waarde ${valueCount + 1} in.`
      : valueCount === 0
        ? "Zit stil en adem gewoon. Bij het geluidssignaal lees je de ETCO2-waarde af."
        : "Blijf stil zitten tot het tweede signaal.";

  function finish() {
    startNewSession();
    onDone();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <header className="mb-4 flex items-end justify-between border-b border-panel-border pb-3.5">
        <div>
          <h1 className="text-[19px] font-semibold tracking-wide">{title}</h1>
          <p className="text-[12.5px] text-muted">Twee waarden, na 1 en na 2 minuten. Geen ademdoel.</p>
        </div>
        <div className="font-mono text-lg text-muted">{fmtTime(elapsedSec)}</div>
      </header>

      <div className="space-y-3.5">
        <div className="panel">
          <div className="text-xs uppercase tracking-wide text-muted">
            Waarde {Math.min(valueCount + (done ? 0 : 1), TARGET_VALUES)} van {TARGET_VALUES}
          </div>
          <div className="mt-1 text-base text-text">{status}</div>
        </div>

        {!done && <KpaInput onLog={logReading} refocusToken={refocusToken} />}

        <button
          onClick={finish}
          className={
            done
              ? "w-full rounded-lg bg-trace py-3.5 text-sm font-semibold text-[#06120B] active:scale-[0.99]"
              : "w-full rounded-lg py-3 text-xs text-muted underline decoration-panel-border underline-offset-2"
          }
        >
          {done
            ? "Afronden"
            : valueCount === 0
              ? "Annuleren"
              : canFinishEarly
                ? `Afronden met ${valueCount} waarde`
                : "Nu stoppen"}
        </button>
      </div>
    </div>
  );
}
