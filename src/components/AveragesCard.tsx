"use client";

import type { WindowAverage } from "@/lib/useAverages";

function Block({ label, data }: { label: string; data: WindowAverage }) {
  return (
    <div className="flex-1 rounded-lg border border-panel-border bg-[#0D1210] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      {data.avgKpa == null ? (
        <div className="mt-1 font-mono text-lg text-muted">&mdash;</div>
      ) : (
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-mono text-3xl text-trace">{data.avgKpa.toFixed(1)}</span>
          <span className="text-xs text-muted">kPa</span>
        </div>
      )}
      <div className="mt-1 text-[11px] text-muted">
        {data.avgKpa == null
          ? "nog geen metingen"
          : `${data.avgMmHg?.toFixed(0)} mmHg \u00b7 ${data.readingCount} metingen`}
      </div>
    </div>
  );
}

export default function AveragesCard({
  week,
  month,
}: {
  week: WindowAverage;
  month: WindowAverage;
}) {
  return (
    <div className="panel flex gap-3">
      <Block label="Deze week" data={week} />
      <Block label="Deze maand" data={month} />
    </div>
  );
}
