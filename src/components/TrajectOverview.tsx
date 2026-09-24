"use client";

import TrendChart from "./TrendChart";
import { CART_WEEK_TARGETS, cartWeekStartDate, computeTrajectPhase, protocolEndDate } from "@/lib/traject";
import { type BaselineBand, computeNulmetingSummary, countsAsCartSession, type Trend } from "@/lib/useAverages";
import { AVAILABLE_FROM_DAYS_BEFORE, computeRustcontroleStatus } from "@/lib/useRustcontrole";
import { NULMETING_TARGET_SESSIONS, type NulmetingBaseline, type SessionMeta } from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Gemiddelde kPa over een reeks sessies, gewogen per waarde. */
function meanKpa(sessions: SessionMeta[]): number | null {
  const n = sessions.reduce((sum, s) => sum + s.readingCount, 0);
  return n ? sessions.reduce((sum, s) => sum + s.kpaSum, 0) / n : null;
}

function fmtKpa(v: number | null): string {
  return v == null ? "" : ` · ${v.toFixed(1)} kPa`;
}

const RUSTCONTROLE_LABELS = ["+1 week", "+1 maand", "+2 maanden", "+6 maanden", "+12 maanden"];

function fmtDate(ms: number, withYear = false): string {
  return new Date(ms).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function Row({ label, value, current }: { label: string; value: string; current?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className={current ? "text-trace" : "text-text"}>{label}</span>
      <span className={"text-right text-xs " + (current ? "text-trace" : "text-muted")}>{value}</span>
    </div>
  );
}

/**
 * Tijdlijn van het traject: nulmeting, de vier CART-weken en de vijf
 * rustcontroles, elk met hun gemiddelde kPa, plus de evolutiegrafiek
 * (docs/ui_doorlichting.md §3.2). Zowel
 * op het eigen Trajectscherm als, alleen-lezen, per cliënt bij Begeleiding.
 * Een voorbij moment zonder meting krijgt geen status, enkel zijn datum.
 */
export default function TrajectOverview({
  startDate,
  sessions,
  nulmetingBaseline,
  trend,
  band,
}: {
  startDate: number | null;
  sessions: SessionMeta[];
  nulmetingBaseline: NulmetingBaseline | null;
  trend: Trend;
  band: BaselineBand;
}) {
  const phase = computeTrajectPhase(startDate);
  const nulmetingNow = computeNulmetingSummary(sessions);
  const rustcontrole = computeRustcontroleStatus(startDate, sessions);
  const cartSessions = sessions.filter(countsAsCartSession);
  const rustSessions = sessions
    .filter((s) => s.sessionType === "rustcontrole" && s.readingCount > 0)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Gemiddelde per protocolweek: het verloop in de volgorde van het protocol.
  function weekMean(weekNr: number): number | null {
    if (startDate == null) return null;
    const from = cartWeekStartDate(startDate, weekNr);
    return meanKpa(cartSessions.filter((s) => s.createdAt >= from && s.createdAt < from + 7 * DAY_MS));
  }

  // Waarde van een rustcontrolemoment: de eerste rustcontrole die ervoor telt,
  // vanaf het venster van dit moment tot het venster van het volgende.
  function momentMean(i: number): number | null {
    const window = (d: number) => d - AVAILABLE_FROM_DAYS_BEFORE * DAY_MS;
    const from = window(rustcontrole.moments[i].date);
    const next = rustcontrole.moments[i + 1];
    const to = next ? window(next.date) : Infinity;
    const first = rustSessions.find((s) => s.createdAt >= from && s.createdAt < to);
    return first ? meanKpa([first]) : null;
  }

  return (
    <div className="space-y-3.5">
      <div className="panel">
        <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Nulmeting</h2>
        {nulmetingBaseline ? (
          <Row
            label={`${nulmetingBaseline.meanKpa.toFixed(2)} ± ${nulmetingBaseline.sdKpa.toFixed(2)} kPa`}
            value={`${nulmetingBaseline.sessionCount} rustmetingen · vastgelegd ${fmtDate(nulmetingBaseline.frozenAt, true)}`}
          />
        ) : phase.kind === "nulmeting" ? (
          <Row
            label={`${nulmetingNow?.sessionCount ?? 0} van ${NULMETING_TARGET_SESSIONS} rustmetingen`}
            value="loopt"
            current
          />
        ) : (
          <Row label="Geen nulmeting" value="protocol gestart zonder nulmeting" />
        )}
      </div>

      <div className="panel">
        <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">CART-protocol</h2>
        {startDate == null ? (
          <Row label="Nog niet gestart" value="" />
        ) : (
          <>
            {CART_WEEK_TARGETS.map((target, i) => {
              const weekNr = i + 1;
              const current = phase.kind === "cart" && phase.week === weekNr;
              return (
                <Row
                  key={weekNr}
                  label={`Week ${weekNr} · ${target}/min`}
                  value={`vanaf ${fmtDate(cartWeekStartDate(startDate, weekNr))}${current ? " · nu" : ""}${fmtKpa(weekMean(weekNr))}`}
                  current={current}
                />
              );
            })}
            <Row label="Einde protocol" value={fmtDate(protocolEndDate(startDate), true)} />
          </>
        )}
      </div>

      <div className="panel">
        <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">Rustcontroles</h2>
        {rustcontrole.moments.length === 0 ? (
          <Row label="Volgen na het protocol" value="" />
        ) : (
          rustcontrole.moments.map((m, i) => {
            const isNext = m.date === rustcontrole.nextDate;
            return (
              <Row
                key={m.date}
                label={RUSTCONTROLE_LABELS[i] ?? ""}
                value={`${fmtDate(m.date, true)}${m.done ? fmtKpa(momentMean(i)) || " · gedaan" : ""}`}
                current={isNext}
              />
            );
          })
        )}
      </div>

      <TrendChart trend={trend} band={band} nulmetingMeanKpa={nulmetingBaseline?.meanKpa ?? null} />
    </div>
  );
}
