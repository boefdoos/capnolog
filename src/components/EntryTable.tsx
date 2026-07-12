"use client";

import { fmtTime } from "@/lib/format";
import type { Entry } from "@/types/capnolog";

export default function EntryTable({
  entries,
  onDelete,
}: {
  entries: Entry[];
  onDelete?: (entry: Entry) => void;
}) {
  if (!entries.length) {
    return <div className="py-6 text-center text-xs text-muted">Nog geen metingen.</div>;
  }

  const rows = [...entries].reverse();

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {["#", "Tijd", "kPa", "mmHg", "\u0394", ""].map((h) => (
            <th
              key={h}
              className="border-b border-panel-border px-2 py-1.5 text-left text-[10px] uppercase tracking-wide text-muted"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          if (e.type === "marker") {
            return (
              <tr key={e.id} className="bg-amber/5">
                <td colSpan={5} className="border-b border-[#1A2320] px-2 py-1.5 text-amber">
                  &#9873; klacht gemarkeerd &middot; t+{fmtTime(e.tSec)}
                </td>
                {onDelete && (
                  <td className="border-b border-[#1A2320] px-2 py-1.5">
                    <button onClick={() => onDelete(e)} className="text-muted hover:text-danger">
                      &times;
                    </button>
                  </td>
                )}
              </tr>
            );
          }
          if (e.type === "sigh") {
            const success = e.subtype === "success";
            return (
              <tr key={e.id} className={success ? "bg-teal/5" : "bg-danger/5"}>
                <td
                  colSpan={5}
                  className={
                    "border-b border-[#1A2320] px-2 py-1.5 " + (success ? "text-teal" : "text-danger")
                  }
                >
                  {success ? "\u2713 zucht geslaagd" : "\u2717 zucht mislukt"} &middot; t+{fmtTime(e.tSec)}
                </td>
                {onDelete && (
                  <td className="border-b border-[#1A2320] px-2 py-1.5">
                    <button onClick={() => onDelete(e)} className="text-muted hover:text-danger">
                      &times;
                    </button>
                  </td>
                )}
              </tr>
            );
          }
          const delta = typeof e.delta === "number" && e.delta !== 0 ? e.delta : null;
          return (
            <tr key={e.id} className="font-mono hover:bg-[#151D1A]">
              <td className="border-b border-[#1A2320] px-2 py-1.5">{e.idx}</td>
              <td className="border-b border-[#1A2320] px-2 py-1.5">{fmtTime(e.tSec)}</td>
              <td className="border-b border-[#1A2320] px-2 py-1.5">{(e.kpa ?? 0).toFixed(1)}</td>
              <td className="border-b border-[#1A2320] px-2 py-1.5">{(e.mmHg ?? 0).toFixed(0)}</td>
              <td className="border-b border-[#1A2320] px-2 py-1.5">
                {delta ? (delta > 0 ? "+" : "") + delta.toFixed(1) : "\u2014"}
              </td>
              {onDelete && (
                <td className="border-b border-[#1A2320] px-2 py-1.5">
                  <button onClick={() => onDelete(e)} className="text-muted hover:text-danger">
                    &times;
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
