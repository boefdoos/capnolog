"use client";

import { CART_TARGET_SESSIONS_PER_DAY } from "@/types/capnolog";

export default function DailyProgress({ sessionsToday }: { sessionsToday: number }) {
  const met = sessionsToday >= CART_TARGET_SESSIONS_PER_DAY;
  const remaining = CART_TARGET_SESSIONS_PER_DAY - sessionsToday;

  return (
    <div className="panel flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted">Vandaag</div>
        <div className="mt-0.5 font-mono text-lg" style={{ color: met ? "#5EEAA0" : "#E7EEEA" }}>
          {sessionsToday} / {CART_TARGET_SESSIONS_PER_DAY} sessies
        </div>
      </div>
      <div className="max-w-[55%] text-right text-[11px] text-muted">
        {met
          ? "CART-doel gehaald, meer oefenen mag altijd"
          : `nog ${remaining} sessie${remaining === 1 ? "" : "s"} voor het CART-doel van ${CART_TARGET_SESSIONS_PER_DAY}x/dag`}
      </div>
    </div>
  );
}
