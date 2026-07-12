"use client";

import { fmtTime } from "@/lib/format";
import type { Entry } from "@/types/capnolog";

export default function StatsRow({ entries, liveDurationFrom }: { entries: Entry[]; liveDurationFrom?: number | null }) {
  const readings = entries.filter((e) => e.type === "reading" && e.kpa != null);
  const sighs = entries.filter((e) => e.type === "sigh");

  if (!readings.length && !sighs.length) return null;

  const chips: [string, string | number][] = [];

  if (readings.length) {
    const vals = readings.map((r) => r.kpa as number);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const last = readings[readings.length - 1];
    chips.push(["N", readings.length]);
    chips.push(["Min", min.toFixed(1)]);
    chips.push(["Max", max.toFixed(1)]);
    chips.push(["Gem", avg.toFixed(1)]);
    chips.push(["Laatste", (last.kpa as number).toFixed(1)]);
  }

  const lastTSec = Math.max(0, ...entries.map((e) => e.tSec));
  const durationSec = liveDurationFrom
    ? (Date.now() - liveDurationFrom) / 1000
    : lastTSec;
  chips.push(["Duur", fmtTime(durationSec)]);

  if (sighs.length) {
    const success = sighs.filter((s) => s.subtype === "success").length;
    chips.push(["BSR", `${success}/${sighs.length}`]);
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {chips.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-panel-border bg-[#0D1210] px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted">{k}</div>
          <div className="mt-0.5 font-mono text-base text-text">{v}</div>
        </div>
      ))}
    </div>
  );
}
