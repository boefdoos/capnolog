"use client";

import { useEffect, useState } from "react";

/**
 * Laadmelding. Verschijnt pas na een korte vertraging: met de lokale cache
 * zijn de gegevens meestal meteen daar, en dan hoort er niets te flitsen.
 * `fullScreen` voor het moment dat de app zelf nog opstart (AuthGate).
 */
export default function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const text = (
    <span className={`text-xs text-muted transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      Even laden&hellip;
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
