"use client";

import { useEffect } from "react";

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockSentinel> };

/**
 * Houdt het scherm aan zolang `active` waar is. Tijdens de stille rust zit je
 * stil, en wanneer het scherm na 30 seconden vergrendelt, legt Safari de
 * pagina stil: de geluidssignalen op 60 en 110 s vallen dan weg. Safari geeft
 * de wake lock vrij bij het verbergen van de pagina, dus bij terugkeer opnieuw
 * aanvragen. Faalt stil waar de API ontbreekt.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await api.request("screen");
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        // Geweigerd (bv. batterijbesparing), geen harde fout.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel) void sentinel.release();
    };
  }, [active]);
}
