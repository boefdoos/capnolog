import {
  BREATH_SAMPLING,
  REST_CUE_SEC,
  CART_PACED_SEC,
  CART_REST_SEC,
  CART_TRANSFER_SEC,
  type BreathSampling,
  type SessionPhase,
} from "@/types/capnolog";

/**
 * Zuivere afleiding uit verstreken sessietijd, geen eigen state (P8). Tijd
 * na de transferfase blijft "transfer": een sessie die uitloopt krijgt geen
 * vierde fase, gewoon langer transfer.
 */
export function phaseForElapsedSec(elapsedSec: number): SessionPhase {
  if (elapsedSec < CART_REST_SEC) return "rest";
  if (elapsedSec < CART_REST_SEC + CART_PACED_SEC) return "paced";
  return "transfer";
}

export function phaseStartSec(phase: SessionPhase): number {
  if (phase === "rest") return 0;
  if (phase === "paced") return CART_REST_SEC;
  return CART_REST_SEC + CART_PACED_SEC;
}

export function phaseDurationSec(phase: SessionPhase): number {
  if (phase === "rest") return CART_REST_SEC;
  if (phase === "paced") return CART_PACED_SEC;
  return CART_TRANSFER_SEC;
}

/**
 * Bemonstering hoort bij een gekende doelfrequentie (P1b-tabel). Zonder
 * actief CART-protocol (targetRR onbekend) blijft het gedrag ongewijzigd:
 * per adem loggen, geen pacer, geen fasecues.
 */
export function breathSamplingForTarget(targetRR: number | null): BreathSampling | null {
  if (targetRR == null) return null;
  return BREATH_SAMPLING[targetRR] ?? null;
}

/**
 * Logcue-interval voor gepaced en transfer: hetzelfde ademcyclus-interval,
 * transfer heeft geen audiopacer meer maar het logritme uit de gepacede fase
 * blijft de vergelijkingsbasis. De rustfase gebruikt vaste cuemomenten
 * (REST_CUE_SEC, zie `restCueCount`).
 */
export function logIntervalForPhase(phase: SessionPhase, sampling: BreathSampling | null): number | null {
  if (phase === "rest") return null;
  return sampling?.intervalSec ?? null;
}

/** Aantal rustcues dat na `elapsedSec` al gevallen is (0, 1 of 2). */
export function restCueCount(elapsedSec: number): number {
  return REST_CUE_SEC.filter((t) => elapsedSec >= t).length;
}
