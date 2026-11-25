// ========================
// EL-KHETM — Studio Tabletop Acoustic Engine (Web Audio API Foley + Tight Felt Room)
// Zero-dependency procedural foley synced with 60fps card kinematics
// ========================

import { useCallback, useEffect } from 'react';
import type { SoundEffect } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let dryBus: GainNode | null = null;
let reverbSend: GainNode | null = null;
let pinkNoiseBuf: AudioBuffer | null = null;
let lastSettleMs = 0;

function jitter(base: number, pct: number = 0.055): number {
  return base * (1 + (Math.random() * 2 - 1) * pct);
}

/** Tight 0.22s felt-covered wooden game table room impulse */
function createFeltTableImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.22);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 3.4);
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.1 * white) / 1.1; // Damped warm woody reflection
      data[i] = lastOut * env * 0.52;
    }
  }
  return impulse;
}

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-15, audioCtx.currentTime);
    compressor.knee.setValueAtTime(16, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(3.6, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.14, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = useGameStore.getState().isMuted ? 0 : 0.9;
    compressor.connect(masterGain).connect(audioCtx.destination);

    dryBus = audioCtx.createGain();
    dryBus.gain.value = 1.0;
    dryBus.connect(compressor);

    const convolver = audioCtx.createConvolver();
    convolver.buffer = createFeltTableImpulse(audioCtx);
    reverbSend = audioCtx.createGain();
    reverbSend.gain.value = 0.18;
    reverbSend.connect(convolver).connect(compressor);
  }
  if (!useGameStore.getState().isMuted && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function routeAudio(node: AudioNode, sendWet: boolean = true) {
  const ctx = getAudioCtx();
  node.connect(dryBus ?? ctx.destination);
  if (sendWet && reverbSend) {
    node.connect(reverbSend);
  }
}

/** Smooth 1.2s pink-noise buffer (natural cardstock linen texture) */
function getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (pinkNoiseBuf && pinkNoiseBuf.sampleRate === ctx.sampleRate) {
    return pinkNoiseBuf;
  }
  const len = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  pinkNoiseBuf = buf;
  return buf;
}

function playFilteredNoise(
  offset: number,
  duration: number,
  fStart: number,
  fEnd: number,
  q: number,
  gainPeak: number,
  type: BiquadFilterType = 'bandpass',
  wet: boolean = true,
) {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + offset;
  const src = ctx.createBufferSource();
  src.buffer = getPinkNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(40, fStart), t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(50, fEnd), t + duration);
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0005, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + Math.min(0.006, duration * 0.22));
  g.gain.exponentialRampToValueAtTime(0.0005, t + duration);

  src.connect(filter).connect(g);
  routeAudio(g, wet);
  src.start(t, Math.random() * 0.55, duration + 0.025);
  src.stop(t + duration + 0.025);
}

function playTone(
  offset: number,
  duration: number,
  freqStart: number,
  freqEnd: number,
  type: OscillatorType,
  gainPeak: number,
  lpfCutoff: number = 4200,
  wet: boolean = true,
  pan: number = 0,
) {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + offset;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(25, freqStart), t);
  if (Math.abs(freqEnd - freqStart) > 0.5) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), t + duration);
  }

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(lpfCutoff, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0005, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + Math.min(0.009, duration * 0.18));
  g.gain.exponentialRampToValueAtTime(0.0005, t + duration);

  osc.connect(lpf).connect(g);
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, t);
    g.connect(panner);
    routeAudio(panner, wet);
  } else {
    routeAudio(g, wet);
  }

  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// === Individual Studio Foley Voices ===

/** UNO-style 3-stage linen card flick out of the deck */
function synthCardDraw() {
  playFilteredNoise(0, 0.015, jitter(3100), jitter(1950), 2.1, 0.42, 'bandpass', false);
  playFilteredNoise(0.012, 0.062, jitter(1550), jitter(2850), 1.5, 0.58, 'bandpass', true);
  playFilteredNoise(0.045, 0.045, jitter(1850), jitter(950), 1.2, 0.24, 'lowpass', true);
  playTone(0.01, 0.032, jitter(290), jitter(170), 'triangle', 0.09, 1050, false);
}

/** Crisp wrist snap & air bend on flip */
function synthCardFlip() {
  playFilteredNoise(0, 0.014, jitter(2600), jitter(1500), 1.9, 0.36, 'bandpass', false);
  playFilteredNoise(0.01, 0.054, jitter(1250), jitter(3300), 1.5, 0.54, 'bandpass', true);
  playTone(0.014, 0.045, jitter(420), jitter(590), 'sine', 0.08, 1800, true);
}

/** Grounded cardstock + walnut felt table placement thud */
function synthCardSlap() {
  playTone(0, 0.068, jitter(145), jitter(52), 'triangle', 0.34, 580, true);
  playTone(0.003, 0.032, jitter(340), jitter(165), 'sine', 0.2, 950, false);
  playFilteredNoise(0.002, 0.024, jitter(1900), jitter(680), 1.3, 0.52, 'bandpass', true);
}

/** Warm mechanical rubber+brass Stamp seal impact */
function synthStamp() {
  playTone(0, 0.14, 112, 42, 'sine', 0.48, 360, true);
  playTone(0.006, 0.075, 290, 96, 'triangle', 0.24, 920, false);
  playFilteredNoise(0, 0.03, 1300, 380, 1.0, 0.58, 'lowpass', true);
  playTone(0.03, 0.09, 820, 620, 'sine', 0.09, 1800, true);
}

/** Crisp ascending mallet-chime lock when matching / earning */
function synthCardMatch() {
  playTone(0, 0.11, 523.25, 523.25, 'triangle', 0.19, 3200, true, -0.15);
  playTone(0.06, 0.12, 659.25, 659.25, 'triangle', 0.2, 3400, true, 0.1);
  playTone(0.12, 0.26, 783.99, 783.99, 'sine', 0.24, 4200, true, 0);
  playTone(0.12, 0.22, 1046.5, 1046.5, 'sine', 0.13, 4600, true, 0.2);
}

/** Secret peek crystal marimba shimmer */
function synthPeekChime() {
  playTone(0, 0.15, 587.33, 587.33, 'sine', 0.16, 3600, true, -0.18);
  playTone(0.055, 0.2, 880, 880, 'sine', 0.14, 4200, true, 0.18);
  playFilteredNoise(0, 0.04, 2400, 3600, 2.0, 0.14, 'bandpass', true);
}

/** Cheeky, clean marimba+woodblock prank alert (zero harsh sawtooth) */
function synthPrankAlarm() {
  playTone(0, 0.085, 659.25, 622.25, 'triangle', 0.22, 2400, true, -0.2);
  playTone(0.075, 0.09, 932.33, 880, 'triangle', 0.22, 2800, true, 0.2);
  playTone(0.155, 0.13, 783.99, 740, 'triangle', 0.2, 2400, true, 0);
  playFilteredNoise(0, 0.018, 2200, 1400, 2.6, 0.25, 'bandpass', false);
  playFilteredNoise(0.075, 0.018, 2600, 1600, 2.6, 0.25, 'bandpass', false);
}

/** Warm bronze-coffee shield deflection chord */
function synthShieldBlock() {
  playTone(0, 0.08, 240, 140, 'triangle', 0.18, 1200, false);
  playTone(0.015, 0.24, 440, 440, 'sine', 0.2, 3400, true, -0.2);
  playTone(0.05, 0.26, 659.25, 659.25, 'sine', 0.18, 4200, true, 0.15);
  playTone(0.09, 0.3, 880, 880, 'sine', 0.15, 4800, true, 0);
}

/** Precision mechanical watch escapement tick-tock */
function synthTickTock() {
  playFilteredNoise(0, 0.011, 2700, 1550, 3.2, 0.32, 'bandpass', false);
  playTone(0, 0.022, 920, 740, 'sine', 0.11, 2100, false);
  playFilteredNoise(0.15, 0.011, 2200, 1250, 3.0, 0.25, 'bandpass', false);
  playTone(0.15, 0.022, 740, 610, 'sine', 0.09, 1700, false);
}

/** Celebratory layered brass & glockenspiel win fanfare */
function synthWinFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const off = i * 0.095;
    const isLast = i === notes.length - 1;
    const dur = isLast ? 0.56 : 0.22;
    const pan = (i - 1.5) * 0.18;
    playTone(off, dur, freq, freq, 'triangle', 0.21, 3200, true, pan);
    playTone(off + 0.01, dur, freq * 2, freq * 2, 'sine', isLast ? 0.14 : 0.08, 5200, true, -pan);
  });
  playFilteredNoise(0.28, 0.22, 3200, 6000, 1.0, 0.14, 'highpass', true);
}

/** Heavy steel window shutter roll & latch */
function synthShutterClose() {
  for (let i = 0; i < 4; i++) {
    playFilteredNoise(i * 0.04, 0.032, 2100 - i * 240, 850, 2.0, 0.38, 'bandpass', true);
  }
  playFilteredNoise(0.15, 0.085, 880, 240, 1.1, 0.62, 'lowpass', true);
  playTone(0.16, 0.18, 126, 38, 'sine', 0.48, 420, true);
  playTone(0.16, 0.08, 220, 76, 'triangle', 0.2, 850, false);
}

/** Silky card arc whoosh */
function synthSwoosh() {
  playFilteredNoise(0, 0.15, jitter(460), jitter(2600), 1.4, 0.52, 'bandpass', true);
  playFilteredNoise(0.07, 0.095, jitter(2100), jitter(720), 1.5, 0.34, 'bandpass', true);
}

/** Warm walnut double-tap error nope */
function synthBuzz() {
  playTone(0, 0.072, 168, 112, 'sine', 0.28, 480, false);
  playTone(0.088, 0.1, 138, 84, 'sine', 0.3, 420, false);
  playFilteredNoise(0, 0.022, 680, 300, 1.4, 0.2, 'lowpass', false);
}

/** Ultra-subtle tactile settle foley triggered right on visual landing contact */
export function playCardSettle(kind: 'felt' | 'hand' = 'felt'): void {
  if (useGameStore.getState().isMuted) return;
  if (!audioCtx || audioCtx.state !== 'running') return;

  const nowMs = performance.now();
  if (nowMs - lastSettleMs < 42) return;
  lastSettleMs = nowMs;

  try {
    if (kind === 'hand') {
      playFilteredNoise(0, 0.016, jitter(2450), jitter(1650), 2.1, 0.14, 'bandpass', false);
      playTone(0, 0.022, jitter(260), jitter(140), 'sine', 0.05, 850, false);
    } else {
      playTone(0, 0.036, jitter(118), jitter(56), 'sine', 0.14, 420, false);
      playFilteredNoise(0, 0.02, jitter(1420), jitter(620), 1.5, 0.11, 'bandpass', true);
    }
  } catch {
    // Ignore edge AudioContext timing errors
  }
}

const SYNTH_MAP: Record<SoundEffect, () => void> = {
  stamp: synthStamp,
  card_flip: synthCardFlip,
  card_draw: synthCardDraw,
  card_slap: synthCardSlap,
  card_match: synthCardMatch,
  peek_chime: synthPeekChime,
  prank_alarm: synthPrankAlarm,
  shield_block: synthShieldBlock,
  tick_tock: synthTickTock,
  win_fanfare: synthWinFanfare,
  shutter_close: synthShutterClose,
  swoosh: synthSwoosh,
  buzz: synthBuzz,
};

export function useSound() {
  const isMuted = useGameStore(s => s.isMuted);
  const toggleMute = useGameStore(s => s.toggleMute);

  useEffect(() => {
    if (!audioCtx) return;
    if (masterGain) {
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.9, audioCtx.currentTime);
    }
    if (isMuted && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    } else if (!isMuted && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }, [isMuted]);

  useEffect(() => {
    const initCtx = () => {
      if (!useGameStore.getState().isMuted) {
        getAudioCtx();
      }
      window.removeEventListener('touchstart', initCtx);
      window.removeEventListener('click', initCtx);
    };
    window.addEventListener('touchstart', initCtx, { once: true });
    window.addEventListener('click', initCtx, { once: true });
    return () => {
      window.removeEventListener('touchstart', initCtx);
      window.removeEventListener('click', initCtx);
    };
  }, []);

  const play = useCallback((sound: SoundEffect) => {
    if (useGameStore.getState().isMuted) return;
    const synthFn = SYNTH_MAP[sound];
    if (synthFn) {
      try {
        synthFn();
      } catch {
        // Ignore AudioContext error before user gesture
      }
    }
  }, []);

  return { play, isMuted, toggleMute };
}
