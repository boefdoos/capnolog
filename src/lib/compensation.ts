import type { SessionMeta } from "@/types/capnolog";

const PRIOR_SESSIONS_WINDOW = 5;
const MIN_PRIOR_SESSIONS = 3;
const RR_DROP_THRESHOLD = 0.05; // relatieve daling van minstens 5%, tegen ruis
const KPA_RISE_EPSILON = 0.05; // kleiner dan de resolutie van één meting (0.1 kPa)

export interface CompensationCheck {
  flagged: boolean;
  currentAvgRR: number | null;
  baselineAvgRR: number | null;
  currentAvgKpa: number | null;
  baselineAvgKpa: number | null;
}

/**
 * Sessiegemiddelde ademfrequentie uit de opgeslagen aggregaten (readingCount,
 * lastTSec) i.p.v. de losse metingen: dezelfde formule als computeAvgRR in
 * format.ts, maar bruikbaar op afgesloten sessies zonder hun entries op te
 * hoeven halen. Benadering: neemt aan dat de eerste meting rond t=0 viel.
 * Enkel geldig bij per-ademhaling loggen; na P1b (bemonsterd loggen, zie
 * docs/codeinstructies.md) moet dit de bemonsteringsfactor verrekenen.
 */
function sessionAvgRR(session: Pick<SessionMeta, "readingCount" | "lastTSec">): number | null {
  if (session.readingCount < 2 || session.lastTSec <= 0) return null;
  return ((session.readingCount - 1) / session.lastTSec) * 60;
}

function sessionAvgKpa(session: Pick<SessionMeta, "readingCount" | "kpaSum">): number | null {
  return session.readingCount > 0 ? session.kpaSum / session.readingCount : null;
}

/**
 * P4: de kernfaalmodus van CART is compensatie. De werkzame ingreep is
 * hypoventilatie, niet traag ademen op zich: wie trager maar dieper ademt,
 * houdt de minuutventilatie gelijk en de CO2 stijgt niet. CapnoLog meet geen
 * teugvolume, maar kan de CO2-respons zelf als indirecte detector gebruiken:
 * als de ademfrequentie duidelijk daalt tegenover de laatste sessies terwijl
 * de gemiddelde kPa niet meestijgt, is de doelfrequentie wel gehaald maar de
 * fysiologische respons uitgebleven (docs/codeinstructies.md P4).
 *
 * Vergelijkt met het gemiddelde van de laatste PRIOR_SESSIONS_WINDOW eerdere
 * CART-sessies, niet met de volledige geschiedenis: net als bij de
 * referentieband (P5) zou een cumulatief gemiddelde hier te traag meebewegen
 * met de wekelijks dalende doelfrequentie van het protocol.
 */
export function checkCompensation(
  current: { avgRR: number | null; avgKpa: number | null },
  priorCartSessions: SessionMeta[]
): CompensationCheck {
  const empty: CompensationCheck = {
    flagged: false,
    currentAvgRR: current.avgRR,
    baselineAvgRR: null,
    currentAvgKpa: current.avgKpa,
    baselineAvgKpa: null,
  };
  if (current.avgRR == null || current.avgKpa == null) return empty;

  const baseline = priorCartSessions
    .filter((s) => s.sessionType === "cart" && s.readingCount >= 2)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, PRIOR_SESSIONS_WINDOW);
  if (baseline.length < MIN_PRIOR_SESSIONS) return empty;

  const rrValues = baseline.map(sessionAvgRR).filter((v): v is number => v != null);
  const kpaValues = baseline.map(sessionAvgKpa).filter((v): v is number => v != null);
  if (rrValues.length < MIN_PRIOR_SESSIONS || !kpaValues.length) return empty;

  const baselineAvgRR = rrValues.reduce((a, b) => a + b, 0) / rrValues.length;
  const baselineAvgKpa = kpaValues.reduce((a, b) => a + b, 0) / kpaValues.length;

  const rrDropped = current.avgRR < baselineAvgRR * (1 - RR_DROP_THRESHOLD);
  const kpaNotRisen = current.avgKpa <= baselineAvgKpa + KPA_RISE_EPSILON;

  return {
    flagged: rrDropped && kpaNotRisen,
    currentAvgRR: current.avgRR,
    baselineAvgRR,
    currentAvgKpa: current.avgKpa,
    baselineAvgKpa,
  };
}
