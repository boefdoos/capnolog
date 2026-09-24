"use client";

import type { CompensationCheck } from "@/lib/compensation";

/**
 * Enkel zichtbaar als checkCompensation() effectief iets vaststelt: geen
 * blijvend UI-element, geen kruimelspoor van cijfers om op te fixeren.
 * Neutrale toon, geen alarmkleur: dit is een vaststelling, geen fout.
 */
export default function CompensationNote({ check }: { check: CompensationCheck }) {
  if (!check.flagged || check.currentAvgRR == null || check.baselineAvgRR == null || check.baselineAvgKpa == null) {
    return null;
  }
  return (
    <div className="panel text-xs text-muted">
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber align-middle" />
      Je ademde trager, maar je CO2-waarde steeg niet mee.{" "}
      <span className="text-text">
        {check.currentAvgRR.toFixed(1)} ademhalingen per minuut tegenover {check.baselineAvgRR.toFixed(1)} eerder, CO2-waarde{" "}
        {check.currentAvgKpa?.toFixed(1)} kPa tegenover {check.baselineAvgKpa.toFixed(1)}.
      </span>
    </div>
  );
}
