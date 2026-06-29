// src/components/chrono/timerAudio.ts
// Professional timer sounds using Web Audio API.
// - "start"   : clean ascending double-beep (timer started)
// - "warning" : sharp single mid-tone beep (last 5 seconds, fires once per second)
// - "end"     : firm triple descending beep (time is up)

export type TimerAlertType = "start" | "warning" | "end";

function getCtx(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

// Plays one clean beep: frequency Hz, duration seconds, volume 0-1, delay seconds
function beep(ctx: AudioContext, freq: number, duration: number, volume: number, delay: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

  const t = ctx.currentTime + delay;
  // Short attack then smooth exponential decay — no click, no harsh tail
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.start(t);
  osc.stop(t + duration + 0.01);
}

export function playTimerAlert(type: TimerAlertType) {
  const ctx = getCtx();
  if (!ctx) return;

  if (type === "start") {
    // Two short ascending tones — clean and neutral, like a starting pistol click
    beep(ctx, 880, 0.12, 0.5, 0.0);
    beep(ctx, 1100, 0.14, 0.55, 0.16);
  } else if (type === "warning") {
    // Single sharp mid-range beep — urgent but not alarming
    beep(ctx, 1047, 0.18, 0.6, 0.0); // C6 — a standard alert tone
  } else if (type === "end") {
    // Triple descending beep — firm and final, like an official buzzer
    beep(ctx, 987, 0.22, 0.7, 0.0); // B5
    beep(ctx, 880, 0.22, 0.7, 0.27); // A5
    beep(ctx, 740, 0.35, 0.75, 0.54); // F#5 — slightly longer last tone
  }
}
