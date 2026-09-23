"use client";

import { useEffect, useRef, useState } from "react";
import { fireLogCue, firePhaseChangeCue, playPacerTone, triggerVibration } from "./pacer";
import {
  breathSamplingForTarget,
  logIntervalForPhase,
  phaseDurationSec,
  phaseForElapsedSec,
  phaseStartSec,
  restCueCount,
} from "./sessionPhase";
import type { BreathSampling, SessionPhase } from "@/types/capnolog";

export interface SessionCuesState {
  phase: SessionPhase | null;
  phaseElapsedSec: number;
  phaseRemainingSec: number;
  sampling: BreathSampling | null;
}

/**
 * Vuurt de logcue tijdens een actieve CART-sessie (docs/codeinstructies.md
 * P1b/P7/P8). Tijdens de gepacede fase valt de pacertoon samen met het
 * logmoment (zelfde cadans als de bemonsteringstabel), plus trilling erbij
 * waar een trilmotor bestaat: geen apart, dichter metronoomtikje per
 * ademhaling meer, dat voelde over tien minuten te opdringerig aan. In rust
 * en transfer is er geen pacer, enkel het logsignaal (een hoorbare tik, plus
 * trilling waar een trilmotor bestaat). De rustcues (REST_CUE_SEC) vallen
 * altijd; zonder gekende doelfrequentie (protocol niet geactiveerd) is er in
 * gepaced en transfer geen pacer en geen logcue.
 */
export function useSessionCues(
  active: boolean,
  startedAtMs: number | null,
  targetRR: number | null
): SessionCuesState {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active || !startedAtMs) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active, startedAtMs]);

  const elapsedSec = active && startedAtMs ? Math.max(0, (Date.now() - startedAtMs) / 1000) : 0;
  const phase = active && startedAtMs ? phaseForElapsedSec(elapsedSec) : null;
  const phaseElapsedSec = phase ? elapsedSec - phaseStartSec(phase) : 0;
  const phaseRemainingSec = phase ? Math.max(0, phaseDurationSec(phase) - phaseElapsedSec) : 0;
  const sampling = breathSamplingForTarget(targetRR);
  const logIntervalSec = phase ? logIntervalForPhase(phase, sampling) : null;
  const logIdx =
    phase === "rest"
      ? restCueCount(phaseElapsedSec)
      : logIntervalSec
        ? Math.floor(phaseElapsedSec / logIntervalSec)
        : null;

  const lastPhaseRef = useRef<SessionPhase | null>(null);
  const lastLogIdxRef = useRef(0);

  // Faseovergang: reset de logteller meteen zodat idx 0 van de nieuwe fase
  // niet nog eens cuet bovenop de faseovergangscue zelf.
  useEffect(() => {
    if (!phase) {
      lastPhaseRef.current = null;
      lastLogIdxRef.current = 0;
      return;
    }
    if (lastPhaseRef.current !== null && lastPhaseRef.current !== phase) {
      firePhaseChangeCue();
    }
    lastPhaseRef.current = phase;
    lastLogIdxRef.current = 0;
  }, [phase]);

  useEffect(() => {
    if (logIdx == null || !phase) return;
    if (lastLogIdxRef.current !== logIdx) {
      lastLogIdxRef.current = logIdx;
      if (phase === "paced") {
        playPacerTone();
        triggerVibration(60);
      } else {
        fireLogCue();
      }
    }
  }, [logIdx, phase]);

  return { phase, phaseElapsedSec, phaseRemainingSec, sampling };
}
