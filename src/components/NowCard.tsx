"use client";

import Link from "next/link";
import type { TrajectPhase } from "@/lib/traject";
import { formatRustcontroleDate, type RustcontroleStatus } from "@/lib/useRustcontrole";
import { CART_TARGET_SESSIONS_PER_DAY, NULMETING_TARGET_SESSIONS } from "@/types/capnolog";

const primaryClass =
  "mt-3.5 w-full rounded-lg bg-trace py-4 text-base font-semibold text-[#06120B] active:scale-[0.99]";
const secondaryClass =
  "mt-2.5 w-full rounded-lg border border-panel-border py-3 text-sm font-semibold text-text active:scale-[0.99]";

/**
 * Bovenste kaart van het beginscherm: in welke fase van het traject je zit,
 * wat er vandaag verwacht wordt, en één hoofdactie die bij die fase hoort
 * (docs/ui_doorlichting.md §3.1). Geen countdown, geen "gemist".
 */
export default function NowCard({
  phase,
  nulmetingCount,
  sessionsToday,
  rustcontrole,
  onStartCart,
  onStartRustcontrole,
  onStartNulmeting,
}: {
  phase: TrajectPhase;
  nulmetingCount: number;
  sessionsToday: number;
  rustcontrole: RustcontroleStatus;
  onStartCart: () => void;
  onStartRustcontrole: () => void;
  onStartNulmeting: () => void;
}) {
  if (phase.kind === "nulmeting") {
    const complete = nulmetingCount >= NULMETING_TARGET_SESSIONS;
    return (
      <div className="panel">
        <div className="text-[11px] uppercase tracking-wide text-muted">Nulmeting</div>
        <div className="mt-1 text-lg text-text">
          {nulmetingCount} van {NULMETING_TARGET_SESSIONS} rustmetingen
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {complete
            ? "Nulmeting klaar, het protocol kan starten"
            : "Drie rustmetingen per dag, zonder oefenen. Elke rustmeting duurt 2 minuten en vraagt twee waarden."}
        </div>
        {complete ? (
          <>
            <Link href="/traject" prefetch={false} className={primaryClass + " block text-center"}>
              Protocol starten
            </Link>
            <button onClick={onStartNulmeting} className={secondaryClass}>
              Nog een rustmeting
            </button>
          </>
        ) : (
          <button onClick={onStartNulmeting} className={primaryClass}>
            Rustmeting
          </button>
        )}
      </div>
    );
  }

  if (phase.kind === "cart") {
    return (
      <div className="panel">
        <div className="text-[11px] uppercase tracking-wide text-muted">CART-protocol &middot; week {phase.week} van 4</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-3xl text-trace">{phase.targetRR}</span>
          <span className="text-sm text-muted">/min streefdoel</span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          Vandaag {Math.min(sessionsToday, CART_TARGET_SESSIONS_PER_DAY)} van {CART_TARGET_SESSIONS_PER_DAY} oefensessies
        </div>
        <button onClick={onStartCart} className={primaryClass}>
          Start oefensessie
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="text-[11px] uppercase tracking-wide text-muted">Na het protocol</div>
      {rustcontrole.availableNow ? (
        <>
          <div className="mt-1 text-lg text-text">Rustcontrole beschikbaar</div>
          <div className="mt-0.5 text-xs text-muted">Stil zitten, geen ademdoel, gewoon meten</div>
          <button onClick={onStartRustcontrole} className={primaryClass}>
            Rustcontrole
          </button>
        </>
      ) : (
        <div className="mt-1 text-lg text-text">
          {rustcontrole.nextDate != null
            ? `Volgende rustcontrole: ${formatRustcontroleDate(rustcontrole.nextDate)}`
            : "Alle rustcontroles gedaan"}
        </div>
      )}
      <button onClick={onStartCart} className={secondaryClass}>
        Oefensessie
      </button>
    </div>
  );
}
