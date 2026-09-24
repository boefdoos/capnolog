import { useMemo } from "react";
import type { SessionMeta } from "@/types/capnolog";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CART_PROTOCOL_DAYS = 28;
export const AVAILABLE_FROM_DAYS_BEFORE = 3;

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
 * Vijf rustcontrolemomenten na protocol-einde (cartProtocolStartDate + 28
 * dagen), afgeleid van de follow-ups in de CART-trials: +1 week (benadert de
 * meting direct na de behandeling), +1 en +6 maanden (CATCH, Ritz et al. 2014),
 * +2 en +12 maanden (Meuret et al. 2008). De maandoffsets lopen via kalendermaand-
 * rekenen, niet via een vast aantal dagen, zodat "24/09" ook echt 24/09 is.
 */
export function computeRustcontroleSchedule(startDate: number): number[] {
  const protocolEnd = startOfDay(startDate) + CART_PROTOCOL_DAYS * DAY_MS;
  return [
    protocolEnd + 7 * DAY_MS,
    addCalendarMonths(protocolEnd, 1),
    addCalendarMonths(protocolEnd, 2),
    addCalendarMonths(protocolEnd, 6),
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

export interface RustcontroleMoment {
  date: number;
  done: boolean;
}

export interface RustcontroleStatus {
  moments: RustcontroleMoment[];
  nextDate: number | null;
  availableNow: boolean;
}

/**
 * Geen apart 'voortgang'-veld: een moment telt als gedaan zodra er een
 * sessie met sessionType 'rustcontrole' bestaat binnen of na het venster
 * van AVAILABLE_FROM_DAYS_BEFORE dagen voor die datum. Een
 * gemist moment krijgt geen status, het blijft gewoon het eerstvolgende
 * moment staan totdat het gelogd wordt (docs/codeinstructies.md §3).
 */
export function computeRustcontroleStatus(startDate: number | null, sessions: SessionMeta[]): RustcontroleStatus {
  if (startDate == null) return { moments: [], nextDate: null, availableNow: false };
  // Enkel rustcontroles met minstens één waarde: een sessie met enkel een
  // verstoring (per ongeluk aangetikt) is geen meting.
  const rustcontroleDates = sessions
    .filter((s) => s.sessionType === "rustcontrole" && s.readingCount > 0)
    .map((s) => s.createdAt);
  const moments = computeRustcontroleSchedule(startDate).map((date) => ({
    date,
    done: rustcontroleDates.some((d) => d >= date - AVAILABLE_FROM_DAYS_BEFORE * DAY_MS),
  }));
  // Eerste moment dat nog niet gedaan is. Een latere meting telt ook voor een
  // gemist vroeger moment, daarom "find" op de volgorde van het schema.
  const nextDate = moments.find((m) => !m.done)?.date ?? null;
  const availableNow = nextDate != null && Date.now() >= nextDate - AVAILABLE_FROM_DAYS_BEFORE * DAY_MS;
  return { moments, nextDate, availableNow };
}

export function useRustcontrole(startDate: number | null, sessions: SessionMeta[]): RustcontroleStatus {
  return useMemo(() => computeRustcontroleStatus(startDate, sessions), [startDate, sessions]);
}
