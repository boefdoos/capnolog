import { computeCartWeekTarget } from "./useCartProtocol";
import { CART_PROTOCOL_DAYS } from "./useRustcontrole";

const DAY_MS = 24 * 60 * 60 * 1000;

export const CART_WEEK_TARGETS = [13, 11, 9, 6] as const;

/**
 * Fase van het traject, enkel afgeleid uit de protocolstartdatum: zonder
 * startdatum loopt de nulmeting, de eerste 28 kalenderdagen is het
 * CART-protocol, daarna volgen de rustcontroles.
 */
export type TrajectPhase =
  | { kind: "nulmeting" }
  | { kind: "cart"; week: number; targetRR: number }
  | { kind: "na" };

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function protocolEndDate(startDate: number): number {
  return startOfDay(startDate) + CART_PROTOCOL_DAYS * DAY_MS;
}

export function cartWeekStartDate(startDate: number, week: number): number {
  return startOfDay(startDate) + (week - 1) * 7 * DAY_MS;
}

export function computeTrajectPhase(startDate: number | null): TrajectPhase {
  if (startDate == null) return { kind: "nulmeting" };
  if (startOfDay(Date.now()) >= protocolEndDate(startDate)) return { kind: "na" };
  const { week, targetRR } = computeCartWeekTarget(startDate);
  return { kind: "cart", week, targetRR };
}
