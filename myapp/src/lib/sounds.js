/**
 * Short UI sounds via Web Audio (no asset files).
 * Resume the context on a user gesture — swipe/tap already qualifies.
 */

/** @type {AudioContext | null} */
let ctx = null;

function audioCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Soft “pop” when a result icon appears on the board.
 * @param {'result' | 'clear'} [kind]
 */
export function playPop(kind = 'result') {
  const ac = audioCtx();
  if (!ac) return;

  const t = ac.currentTime;
  const brighter = kind === 'clear';

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(brighter ? 520 : 380, t);
  osc.frequency.exponentialRampToValueAtTime(brighter ? 980 : 760, t + 0.035);
  osc.frequency.exponentialRampToValueAtTime(brighter ? 280 : 220, t + 0.16);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(brighter ? 2400 : 1800, t);
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.16);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(brighter ? 0.2 : 0.16, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.2);

  // Brief noise click so it reads as a pop, not a beep.
  const noiseLen = Math.floor(ac.sampleRate * 0.04);
  const buffer = ac.createBuffer(1, noiseLen, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
  }
  const noise = ac.createBufferSource();
  const noiseGain = ac.createGain();
  const noiseFilter = ac.createBiquadFilter();
  noise.buffer = buffer;
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 1200;
  noiseGain.gain.setValueAtTime(0.08, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noise.start(t);
  noise.stop(t + 0.05);
}

/** Call from a tap/swipe so iOS will actually play later pops. */
export function unlockAudio() {
  audioCtx();
}
