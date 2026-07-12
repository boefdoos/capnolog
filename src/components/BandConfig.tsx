"use client";

export default function BandConfig({
  bandLow,
  bandHigh,
  onChange,
}: {
  bandLow: number;
  bandHigh: number;
  onChange: (low: number, high: number) => void;
}) {
  return (
    <div className="panel flex flex-wrap items-center gap-4 text-xs text-muted">
      <span>Referentieband:</span>
      <label className="flex items-center gap-1.5">
        onder
        <input
          type="number"
          step="0.1"
          value={bandLow}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0, bandHigh)}
          className="w-16 rounded-md border border-panel-border bg-[#0D1210] px-1.5 py-1 font-mono text-xs text-text"
        />
      </label>
      <label className="flex items-center gap-1.5">
        boven
        <input
          type="number"
          step="0.1"
          value={bandHigh}
          onChange={(e) => onChange(bandLow, parseFloat(e.target.value) || 0)}
          className="w-16 rounded-md border border-panel-border bg-[#0D1210] px-1.5 py-1 font-mono text-xs text-text"
        />
      </label>
    </div>
  );
}
