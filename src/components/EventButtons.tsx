"use client";

import { useState } from "react";

const buttonClass =
  "flex-1 rounded-lg border border-panel-border px-3.5 py-3 text-sm font-semibold text-text active:scale-95";

/**
 * Verstoring en zucht. De zucht is één knop met daarna de keuze, in neutrale
 * kleuren: rood voor "mislukt" was een oordeel (docs/ui_doorlichting.md S4).
 */
export default function EventButtons({
  onMarkDisturbance,
  onSigh,
}: {
  onMarkDisturbance: () => void;
  onSigh: (subtype: "success" | "fail") => void;
}) {
  const [choosingSigh, setChoosingSigh] = useState(false);

  function sigh(subtype: "success" | "fail") {
    onSigh(subtype);
    setChoosingSigh(false);
  }

  return (
    <div className="flex gap-2.5">
      {choosingSigh ? (
        <>
          <button onClick={() => sigh("success")} className={buttonClass}>
            Zucht gelukt
          </button>
          <button onClick={() => sigh("fail")} className={buttonClass}>
            Niet gelukt
          </button>
          <button
            onClick={() => setChoosingSigh(false)}
            aria-label="Annuleer"
            className="rounded-lg border border-panel-border px-3.5 py-3 text-sm text-muted active:scale-95"
          >
            &times;
          </button>
        </>
      ) : (
        <>
          <button onClick={onMarkDisturbance} className={buttonClass}>
            Verstoring
          </button>
          <button onClick={() => setChoosingSigh(true)} className={buttonClass}>
            Zucht
          </button>
        </>
      )}
    </div>
  );
}
