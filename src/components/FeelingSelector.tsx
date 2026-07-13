"use client";

import { FEELING_LABELS, type SessionFeeling } from "@/types/capnolog";

const OPTIONS: SessionFeeling[] = ["slecht", "eerder_slecht", "ok", "eerder_goed", "goed"];

export default function FeelingSelector({
  value,
  onChange,
}: {
  value?: SessionFeeling;
  onChange: (feeling: SessionFeeling) => void;
}) {
  return (
    <div className="panel">
      <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">Algemeen gevoel</label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={
                "rounded-lg border px-3 py-2.5 text-sm font-semibold active:scale-95 " +
                (selected
                  ? "border-trace bg-trace text-[#06120B]"
                  : "border-panel-border text-muted hover:border-trace hover:text-text")
              }
            >
              {FEELING_LABELS[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
