"use client";

import { fmtTime } from "@/lib/format";
import type { CartWeekTarget } from "@/lib/useCartProtocol";
import type { SessionCuesState } from "@/lib/useSessionCues";

const PHASE_LABELS: Record<NonNullable<SessionCuesState["phase"]>, string> = {
  rest: "Tot rust komen",
  paced: "Ademen op het ritme",
  transfer: "Zelf verder ademen",
};

/**
 * Eén kaart voor fase en streefdoel (P8), in plaats van een aparte
 * weekbadge erboven. Tijdens stille rust bewust geen doelfrequentie: die fase
 * is de ongestuurde baseline-meting, een zichtbaar doel lokt sturen uit.
 * Geen countdown-getal in rood, gewoon de resterende tijd in dezelfde
 * neutrale toon als de rest van de app.
 */
export default function PhaseBadge({
  cues,
  target,
}: {
  cues: SessionCuesState;
  target: CartWeekTarget | null;
}) {
  if (!cues.phase) return null;

  const cueDescription =
    cues.phase === "rest"
      ? "twee waarden, na 1 en na 2 minuten, bij het geluidssignaal"
      : !cues.sampling
        ? "geen ritme ingesteld, start de CO2-training onder Traject"
        : cues.phase === "paced"
          ? `pacertoon elke ${cues.sampling.n}de adem (~${cues.sampling.intervalSec}s), dan loggen`
          : `geen pacer · geluidssignaal elke ${cues.sampling.n}de adem (~${cues.sampling.intervalSec}s)`;

  return (
    <div className="panel">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="text-text">{PHASE_LABELS[cues.phase]}</span>
        <span className="font-mono">{fmtTime(cues.phaseRemainingSec)}</span>
      </div>

      {cues.phase === "rest" ? (
        <div className="mt-1.5 text-sm text-text">Geen ritme, adem zoals het vanzelf gaat</div>
      ) : (
        target && (
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl text-trace">{target.targetRR}</span>
            <span className="text-sm text-muted">ademhalingen per minuut &middot; week {target.week}</span>
          </div>
        )
      )}

      <div className="mt-1 text-xs text-muted">{cueDescription}</div>
    </div>
  );
}
