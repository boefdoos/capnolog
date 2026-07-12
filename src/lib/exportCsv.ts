import { fmtTime } from "./format";
import type { Entry } from "@/types/capnolog";

export function exportSessionCsv(entries: Entry[], filenamePrefix = "co2-sessie") {
  const header = "idx,type,subtype,tijd_s,tijd_mmss,kpa,mmHg,delta_kpa\n";
  const rows = [...entries]
    .sort((a, b) => a.tSec - b.tSec)
    .map((e) => {
      if (e.type === "marker") {
        return ["", "markeer_klacht", "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", ""].join(",");
      }
      if (e.type === "sigh") {
        return ["", "zucht", e.subtype ?? "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", ""].join(",");
      }
      return [
        e.idx ?? "",
        "meting",
        "",
        e.tSec.toFixed(1),
        fmtTime(e.tSec),
        (e.kpa ?? 0).toFixed(2),
        (e.mmHg ?? 0).toFixed(1),
        e.delta ?? 0,
      ].join(",");
    });
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
