/** Lightweight chess sounds via Web Audio API (no assets needed). */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  freqEnd?: number
) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playMoveSound() {
  tone(420, 0.07, "triangle", 0.06);
}

export function playCaptureSound() {
  tone(180, 0.1, "square", 0.05);
  setTimeout(() => tone(120, 0.08, "triangle", 0.04), 40);
}

export function playCheckSound() {
  tone(660, 0.09, "sine", 0.07);
  setTimeout(() => tone(880, 0.12, "sine", 0.06), 90);
}

export function playWinSound() {
  tone(523, 0.12, "sine", 0.08); // C
  setTimeout(() => tone(659, 0.12, "sine", 0.08), 120); // E
  setTimeout(() => tone(784, 0.22, "sine", 0.09), 240); // G
}

export function playLoseSound() {
  tone(400, 0.15, "sawtooth", 0.04, 180);
}

export function playDrawSound() {
  tone(440, 0.12, "sine", 0.05);
  setTimeout(() => tone(440, 0.18, "sine", 0.04), 150);
}

export function playGameSound(opts: {
  capture?: boolean;
  check?: boolean;
  checkmate?: boolean;
  win?: boolean;
  lose?: boolean;
  draw?: boolean;
}) {
  if (opts.win) {
    playWinSound();
    return;
  }
  if (opts.lose) {
    playLoseSound();
    return;
  }
  if (opts.draw) {
    playDrawSound();
    return;
  }
  if (opts.checkmate || opts.check) {
    playCheckSound();
    return;
  }
  if (opts.capture) {
    playCaptureSound();
    return;
  }
  playMoveSound();
}
