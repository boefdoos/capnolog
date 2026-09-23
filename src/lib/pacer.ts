"use client";

/**
 * Pacertoon en logcue vallen samen op het logritme (docs/codeinstructies.md
 * P1b/P7): geen apart metronoomtikje per ademhaling meer, dat voelde over
 * tien minuten te opdringerig aan (feedback Thomas, 18 september 2026).
 * Het logsignaal is altijd hoorbaar, met een ander klankbeeld dan de
 * pacertoon zodat de twee niet door elkaar lopen. Trilling komt er enkel bij
 * waar een trilmotor bestaat: Safari/iOS kent de Vibration API niet, en op
 * iPhone is de toon dus het enige signaal (feedback Thomas, 23/09).
 * Alles hier faalt stil bij ontbrekende of geblokkeerde browser-API's (geen
 * user-gesture, geen trilmotor), dit is een comfortsignaal, geen kritiek pad.
 */

let audioCtx: AudioContext | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/**
 * Moet aangeroepen worden vanuit een echte user-gesture (bv. de
 * "Start nieuwe sessie"-klik), niet vanuit een timer. Chrome's
 * autoplay-beleid start een AudioContext die buiten een gesture ontstaat
 * "suspended": geen fout, gewoon stil geluid.
 */
export function unlockAudioContext() {
  try {
    const ctx = ensureAudioCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    // Web Audio niet beschikbaar, pacer valt stil weg.
  }
}

/**
 * iOS Safari kent geen Vibration API (zie boven), dus daar draait alle
 * logcuing op deze toon. Safari suspendt een AudioContext ook geruime tijd na
 * de laatste user-gesture, dus tussen de "Start sessie"-tap en de eerste
 * rustcue (tot ~35s later) kan hij alweer stil liggen. `resume()` teruggeven
 * zonder te wachten plant de oscillator dan tegen een klok die nog niet
 * loopt, en Safari laat die geluidloos wegvallen. Pas na een afgeronde
 * `resume()` plannen voorkomt dat.
 */
function tone(freq: number, startOffsetSec: number, durationSec: number, peakGain: number) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    const start = ctx.currentTime + startOffsetSec;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + Math.min(0.03, durationSec / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(play).catch(() => {
      // Resume geweigerd (geen recente user-gesture), toon valt stil weg.
    });
  } else {
    play();
  }
}

/** Zacht toontje op het logmoment tijdens de gepacede fase. */
export function playPacerTone() {
  try {
    tone(220, 0, 0.4, 0.15);
  } catch {
    // Web Audio niet beschikbaar of geblokkeerd, pacer valt stil weg.
  }
}

/** Korte, hogere tik: het hoorbare logsignaal. */
function playLogTick() {
  try {
    tone(660, 0, 0.12, 0.08);
  } catch {
    // Web Audio niet beschikbaar of geblokkeerd.
  }
}

/** Twee korte, stijgende tonen: het hoorbare signaal voor de faseovergang. */
function playPhaseChangeTone() {
  try {
    tone(440, 0, 0.2, 0.12);
    tone(660, 0.15, 0.2, 0.12);
  } catch {
    // Web Audio niet beschikbaar of geblokkeerd.
  }
}

export function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Rechtstreekse trilling, no-op waar geen trilmotor bestaat. */
export function triggerVibration(pattern: number | number[]) {
  try {
    if (supportsVibration()) navigator.vibrate(pattern);
  } catch {
    // Vibration API niet beschikbaar, geen harde fout.
  }
}

/** Logmoment buiten de gepacede fase (rust/transfer): hoorbare tik, plus trilling waar mogelijk. */
export function fireLogCue() {
  playLogTick();
  triggerVibration(60);
}

/** Faseovergang: idem, met een ander klankbeeld dan de logtik en de pacer. */
export function firePhaseChangeCue() {
  playPhaseChangeTone();
  triggerVibration([40, 80, 40]);
}
