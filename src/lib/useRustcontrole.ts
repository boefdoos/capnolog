import { useMemo } from "react";
import type { SessionMeta } from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;
const CART_PROTOCOL_DAYS = 28;
const AVAILABLE_FROM_DAYS_BEFORE = 3;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addCalendarMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/**
 * Vier rustcontrolemomenten na protocol-einde (cartProtocolStartDate + 28
 * dagen), in lijn met docs/plan_post_trial_rustcontroles.md: +1 week,
 * +1 maand, +2 maanden, +12 maanden. De maandoffsets lopen via kalendermaand-
 * rekenen, niet via een vast aantal dagen, zodat "24/09" ook echt 24/09 is.
 */
export function computeRustcontroleSchedule(startDate: number): number[] {
  const protocolEnd = startOfDay(startDate) + CART_PROTOCOL_DAYS * DAY_MS;
  return [
    protocolEnd + 7 * DAY_MS,
    addCalendarMonths(protocolEnd, 1),
    addCalendarMonths(protocolEnd, 2),
    addCalendarMonths(protocolEnd, 12),
  ];
}

/** "woensdag 24 september", met jaartal enkel als het niet dit jaar is. */
export function formatRustcontroleDate(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export interface RustcontroleStatus {
  nextDate: number | null;
  availableNow: boolean;
}

/**
 * Geen apart 'voortgang'-veld: een moment telt als gedaan zodra er een
 * sessie met sessionType 'rustcontrole' bestaat op of na die datum. Een
 * gemist moment krijgt geen status, het blijft gewoon het eerstvolgende
 * moment staan totdat het gelogd wordt (docs/codeinstructies.md §3).
 */
export function useRustcontrole(
  startDate: number | null,
  sessions: SessionMeta[]
): RustcontroleStatus {
  return useMemo(() => {
    if (startDate == null) return { nextDate: null, availableNow: false };
    const rustcontroleDates = sessions
      .filter((s) => s.sessionType === "rustcontrole")
      .map((s) => s.createdAt);
    const schedule = computeRustcontroleSchedule(startDate);
    const nextDate =
      schedule.find((moment) => !rustcontroleDates.some((d) => d >= moment)) ?? null;
    const availableNow = nextDate != null && Date.now() >= nextDate - AVAILABLE_FROM_DAYS_BEFORE * DAY_MS;
    return { nextDate, availableNow };
  }, [startDate, sessions]);
}
