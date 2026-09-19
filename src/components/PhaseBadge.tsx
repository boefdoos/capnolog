"use client";

import { fmtTime } from "@/lib/format";
import type { SessionCuesState } from "@/lib/useSessionCues";

const PHASE_LABELS: Record<NonNullable<SessionCuesState["phase"]>, string> = {
  rest: "Stille rust",
  paced: "Gepaced ademen",
  transfer: "Transfer",
};

/**
 * Toont de huidige sessiefase (P8) en wat daarbij hoort: tijdens gepaced
 * ademen vallen pacertoon en logcue samen op het logritme uit de tabel,
 * tijdens rust en transfer enkel de trilcue. Geen countdown-getal in rood,
 * gewoon de resterende tijd in dezelfde neutrale toon als de rest van de app.
 */
export default function PhaseBadge({ cues }: { cues: SessionCuesState }) {
  if (!cues.phase) return null;

  const cueDescription =
    cues.phase === "rest"
      ? "zachte trilcue om de ~35s"
      : !cues.sampling
        ? "geen doelfrequentie ingesteld, activeer het CART-protocol voor pacer en logcue"
        : cues.phase === "paced"
          ? `pacertoon + trilcue elke ${cues.sampling.n}de adem (~${cues.sampling.intervalSec}s)`
          : `geen pacer · trilcue elke ${cues.sampling.n}de adem (~${cues.sampling.intervalSec}s)`;

  return (
    <div className="panel flex items-center justify-between text-xs text-muted">
      <span>
        <span className="text-text">{PHASE_LABELS[cues.phase]}</span> &middot; {cueDescription}
      </span>
      <span className="font-mono">{fmtTime(cues.phaseRemainingSec)}</span>
    </div>
  );
}
