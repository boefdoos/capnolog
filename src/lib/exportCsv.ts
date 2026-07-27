import { collection, getDocs } from "firebase/firestore";
import { deriveEntries, fmtTime } from "./format";
import { getFirebaseDb } from "./firebase";
import {
  FEELING_LABELS,
  type Entry,
  type SessionFeeling,
  type SessionMeta,
  type StoredEntry,
} from "@/types/capnolog";

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
  sessionCreatedAt: number,
  filenamePrefix = "co2-sessie",
  feeling?: SessionFeeling
) {
  const sessionDate = new Date(sessionCreatedAt);
  const sessieDatum = sessionDate.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const sessieTijd = sessionDate.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
  const feelingLine = feeling ? `# algemeen_gevoel: ${FEELING_LABELS[feeling]}\n` : "";
  const header =
    "sessie_datum,sessie_tijd,absoluut_tijdstip,idx,type,subtype,tijd_s,tijd_mmss,kpa,mmHg,delta_kpa,rr_per_min\n";
  const rows = [...entries]
    .sort((a, b) => a.tSec - b.tSec)
    .map((e) => {
      const absoluutTijdstip = new Date(sessionCreatedAt + e.tSec * 1000).toISOString();
      const gedeeld = [sessieDatum, sessieTijd, absoluutTijdstip];
      if (e.type === "marker") {
        return [...gedeeld, "", "markeer_verstoring", "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(",");
      }
      if (e.type === "sigh") {
        return [...gedeeld, "", "zucht", e.subtype ?? "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(",");
      }
      return [
        ...gedeeld,
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

/**
 * Volledige export: één rij per individueel datapunt (meting, verstoring,
 * zucht) over alle sessies in een periode, elk verrijkt met sessiecontext
 * (datum, gevoel, band) zodat het bestand op zichzelf staat, geen join met
 * een apart sessieoverzicht nodig voor grondige analyse. Leest voor elke
 * sessie in de periode de entries-subcollectie op, dus dit kost N+1
 * Firestore-reads (N = aantal sessies), aanvaardbaar op persoonlijke schaal.
 */
export async function exportFullPeriodCsv(
  uid: string,
  sessions: SessionMeta[],
  filenamePrefix: string
): Promise<void> {
  const db = getFirebaseDb();
  const header =
    "sessie_datum,sessie_tijd,sessie_id,sessie_gevoel,band_onder_kpa,band_boven_kpa,absoluut_tijdstip,idx,type,subtype,tijd_s,tijd_mmss,kpa,mmHg,delta_kpa,rr_per_min\n";
  const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
  const rows: string[] = [];

  for (const s of sorted) {
    const snap = await getDocs(collection(db, "users", uid, "sessions", s.id, "entries"));
    const rawEntries: StoredEntry[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<StoredEntry, "id">),
    }));
    const derived = deriveEntries(rawEntries).sort((a, b) => a.tSec - b.tSec);

    const d = new Date(s.createdAt);
    const sessieDatum = d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const sessieTijd = d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
    const gevoel = s.feeling ? FEELING_LABELS[s.feeling] : "";

    derived.forEach((e) => {
      const absoluutTijdstip = new Date(s.createdAt + e.tSec * 1000).toISOString();
      const gedeeld = [
        sessieDatum,
        sessieTijd,
        s.id,
        gevoel,
        s.bandLow.toFixed(2),
        s.bandHigh.toFixed(2),
        absoluutTijdstip,
      ];
      if (e.type === "marker") {
        rows.push([...gedeeld, "", "markeer_verstoring", "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(","));
        return;
      }
      if (e.type === "sigh") {
        rows.push(
          [...gedeeld, "", "zucht", e.subtype ?? "", e.tSec.toFixed(1), fmtTime(e.tSec), "", "", "", ""].join(",")
        );
        return;
      }
      rows.push(
        [
          ...gedeeld,
          e.idx ?? "",
          "meting",
          "",
          e.tSec.toFixed(1),
          fmtTime(e.tSec),
          (e.kpa ?? 0).toFixed(2),
          (e.mmHg ?? 0).toFixed(1),
          e.delta ?? 0,
          typeof e.rr === "number" ? e.rr.toFixed(1) : "",
        ].join(",")
      );
    });
  }

  downloadCsv(header + rows.join("\n"), filenamePrefix);
}
