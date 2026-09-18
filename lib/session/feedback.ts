/**
 * Rest complete cue: vibration + short beep when the browser allows it.
 * Failures are ignored (autoplay / missing APIs).
 */
export function playSessionCue(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(200);
    }
  } catch {
    // ignore
  }

  try {
    playRestBeep();
  } catch {
    // autoplay policies
  }
}

function playRestBeep(): void {
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return;
  }
  const ctx = new Ctor();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.07;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.12);
  window.setTimeout(() => {
    void ctx.close();
  }, 200);
}
