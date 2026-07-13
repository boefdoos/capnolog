export const KPA_TO_MMHG = 7.50062;

export function fmtTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Auto-decimal digit buffer: interprets a raw digit string as the value
 * divided by 10, so one-handed entry never needs a decimal key.
 * "4" -> "0.4", "42" -> "4.2", "51" -> "5.1".
 */
export function formatDigits(raw: string): string {
  if (!raw) return "";
  if (raw.length === 1) return "0." + raw;
  const intPartRaw = raw.slice(0, raw.length - 1);
  const decPart = raw.slice(-1);
  const intPart = String(parseInt(intPartRaw, 10));
  return intPart + "." + decPart;
}

export function digitsFromInput(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 3);
}

export function parseSessionMeta(id: string, data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  const createdAtMs =
    createdAt && typeof (createdAt as { toMillis?: () => number }).toMillis === "function"
      ? (createdAt as { toMillis: () => number }).toMillis()
      : Date.now();
  return {
    id,
    createdAt: createdAtMs,
    bandLow: (data.bandLow as number) ?? 3.8,
    bandHigh: (data.bandHigh as number) ?? 4.9,
    readingCount: (data.readingCount as number) ?? 0,
    kpaSum: (data.kpaSum as number) ?? 0,
    kpaSumSq: (data.kpaSumSq as number) ?? 0,
    sighSuccessCount: (data.sighSuccessCount as number) ?? 0,
    sighTotalCount: (data.sighTotalCount as number) ?? 0,
    lastTSec: (data.lastTSec as number) ?? 0,
  };
}

export function deriveEntries<T extends { type: string; tSec: number; kpa?: number }>(
  stored: T[]
): (T & { mmHg?: number; delta?: number; idx?: number })[] {
  const sorted = [...stored].sort((a, b) => a.tSec - b.tSec);
  let n = 0;
  let prevKpa: number | null = null;
  return sorted.map((e) => {
    if (e.type === "reading" && typeof e.kpa === "number") {
      n += 1;
      const delta = prevKpa === null ? 0 : +(e.kpa - prevKpa).toFixed(2);
      prevKpa = e.kpa;
      return { ...e, mmHg: e.kpa * KPA_TO_MMHG, delta, idx: n };
    }
    return { ...e };
  });
}
