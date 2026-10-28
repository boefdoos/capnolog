"use client";

import { useEffect, useState } from "react";

/**
 * Laadmelding. Verschijnt pas na een korte vertraging: met de lokale cache
 * zijn de gegevens meestal meteen daar, en dan hoort er niets te flitsen.
 * Duurt het langer dan STUCK_MS, dan een uitweg: een verbinding die blijft
 * hangen, kwam tot nu enkel los met een herlaadbeurt.
 * `fullScreen` voor het moment dat de app zelf nog opstart (AuthGate).
 */
const STUCK_MS = 10_000;

export default function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    const s = setTimeout(() => setStuck(true), STUCK_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
    };
  }, []);

  const text = (
    <span className={`text-xs text-muted transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      {stuck ? (
        <>
          Het laden duurt lang.{" "}
          <button
            onClick={() => window.location.reload()}
            className="text-text underline decoration-panel-border underline-offset-2"
          >
            Opnieuw laden
          </button>
        </>
      ) : (
        <>Even laden&hellip;</>
      )}
    </span>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <div className="text-lg font-semibold tracking-wide text-text">CapnoLog</div>
        {text}
      </div>
    );
  }
  return <div className="py-6 text-center">{text}</div>;
}
