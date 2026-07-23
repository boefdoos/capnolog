import { fmtTime } from "./format";
import { FEELING_LABELS, type Entry, type SessionFeeling, type SessionMeta } from "@/types/capnolog";

function downloadCsv(csv: string, filenamePrefix: string) {
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

export function exportSessionCsv(
  entries: Entry[],
  filenamePrefix = "co2-sessie",
  feeling?: SessionFeeling
) {
  const feelingLine = feeling ? `# algemeen_gevoel: ${FEELING_LABELS[feeling]}\n` : "";
  const header = "idx,type,subtype,tijd_s,tijd_mmss,kpa,mmHg,delta_kpa,rr_per_min\n";
  const rows = [...entries]
    .sort((a, b) => a.tSec - b.tSec)
    .map((e) => {
      if (e.type === "marker") {
        return ["", "markeer_verstoring", "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(",");
      }
      if (e.type === "sigh") {
        return ["", "zucht", e.subtype ?? "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(",");
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
        typeof e.rr === "number" ? e.rr.toFixed(1) : "",
      ].join(",");
    });
  downloadCsv(feelingLine + header + rows.join("\n"), filenamePrefix);
}

/**
 * Overzichtsexport: één rij per sessie binnen een periode (week/maand),
 * met de al beschikbare per-sessie aggregaten. Geen her-lees van individuele
 * metingen nodig.
 */
export function exportSessionsOverviewCsv(sessions: SessionMeta[], filenamePrefix: string) {
  const header = "datum,tijd,gemiddelde_kpa,gemiddelde_mmhg,metingen,duur_mmss,bsr_pct,gevoel\n";
  const rows = [...sessions]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((s) => {
      const avgKpa = s.readingCount > 0 ? s.kpaSum / s.readingCount : null;
      const bsrPct = s.sighTotalCount > 0 ? Math.round((s.sighSuccessCount / s.sighTotalCount) * 100) : "";
      const d = new Date(s.createdAt);
      const datum = d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const tijd = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
      return [
        datum,
        tijd,
        avgKpa != null ? avgKpa.toFixed(2) : "",
        avgKpa != null ? (avgKpa * 7.50062).toFixed(1) : "",
        s.readingCount,
        fmtTime(s.lastTSec),
        bsrPct,
        s.feeling ? FEELING_LABELS[s.feeling] : "",
      ].join(",");
    });
  downloadCsv(header + rows.join("\n"), filenamePrefix);
}
