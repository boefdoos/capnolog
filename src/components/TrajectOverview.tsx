"use client";

import AveragesCard from "./AveragesCard";
import { CART_WEEK_TARGETS, cartWeekStartDate, computeTrajectPhase, protocolEndDate } from "@/lib/traject";
import { computeNulmetingSummary, type WindowAverage } from "@/lib/useAverages";
import { computeRustcontroleStatus } from "@/lib/useRustcontrole";
import { NULMETING_TARGET_SESSIONS, type NulmetingBaseline, type SessionMeta } from "@/types/capnolog";

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
 * rustcontroles, plus de gemiddelden (docs/ui_doorlichting.md §3.2). Zowel
 * op het eigen Trajectscherm als, alleen-lezen, per cliënt bij Begeleiding.
 * Een voorbij moment zonder meting krijgt geen status, enkel zijn datum.
 */
export default function TrajectOverview({
  startDate,
  sessions,
  nulmetingBaseline,
  week,
  month,
}: {
  startDate: number | null;
  sessions: SessionMeta[];
  nulmetingBaseline: NulmetingBaseline | null;
  week: WindowAverage;
  month: WindowAverage;
}) {
  const phase = computeTrajectPhase(startDate);
  const nulmetingNow = computeNulmetingSummary(sessions);
  const rustcontrole = computeRustcontroleStatus(startDate, sessions);

  return (
    <div className="space-y-3.5">
      <div className="panel">
        <h2 className="mb-1 text-[11px] uppercase tracking-wide text-muted">Nulmeting</h2>
        {nulmetingBaseline ? (
          <Row
            label={`${nulmetingBaseline.meanKpa.toFixed(2)} ± ${nulmetingBaseline.sdKpa.toFixed(2)} kPa`}
            value={`${nulmetingBaseline.sessionCount} metingen · vastgelegd ${fmtDate(nulmetingBaseline.frozenAt, true)}`}
          />
        ) : phase.kind === "nulmeting" ? (
          <Row
            label={`${nulmetingNow?.sessionCount ?? 0} van ${NULMETING_TARGET_SESSIONS} metingen`}
            value="loopt"
            current
          />
        ) : (
          <Row label="Geen nulmeting" value="protocol gestart zonder nulmeting" />
        )}
      </div>

      <div className="panel">
        <h2 className="mb-1 text-[11px] uppercase tracking-wide text-muted">CART-protocol</h2>
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
                  value={`vanaf ${fmtDate(cartWeekStartDate(startDate, weekNr))}${current ? " · nu" : ""}`}
                  current={current}
                />
              );
            })}
            <Row label="Einde protocol" value={fmtDate(protocolEndDate(startDate), true)} />
          </>
        )}
      </div>

      <div className="panel">
        <h2 className="mb-1 text-[11px] uppercase tracking-wide text-muted">Rustcontroles</h2>
        {rustcontrole.moments.length === 0 ? (
          <Row label="Volgen na het protocol" value="" />
        ) : (
          rustcontrole.moments.map((m, i) => {
            const isNext = m.date === rustcontrole.nextDate;
            return (
              <Row
                key={m.date}
                label={RUSTCONTROLE_LABELS[i] ?? ""}
                value={`${fmtDate(m.date, true)}${m.done ? " · gedaan" : ""}`}
                current={isNext}
              />
            );
          })
        )}
      </div>

      <AveragesCard week={week} month={month} />
    </div>
  );
}
