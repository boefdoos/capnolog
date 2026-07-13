"use client";

import type { BaselineBand } from "@/lib/useAverages";

export default function BandInfo({ band }: { band: BaselineBand }) {
  return (
    <div className="panel text-xs text-muted">
      Referentieband: <span className="font-mono text-text">{band.low.toFixed(1)}&ndash;{band.high.toFixed(1)} kPa</span>{" "}
      {band.source === "baseline" ? (
        <>(maandgemiddelde &plusmn; 1 SD, {band.readingCount} metingen)</>
      ) : (
        <>(standaard, nog te weinig data voor een eigen baseline)</>
      )}
    </div>
  );
}
