// ========================
// EL-KHETM — Crisp Cardstock Sound Engine
// ========================

import { useCallback, useEffect } from 'react';
import type { SoundEffect } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = useGameStore.getState().isMuted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  if (!useGameStore.getState().isMuted && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getDestination(): AudioNode {
  const ctx = getAudioCtx();
  return masterGain ?? ctx.destination;
}

/** Generate a 1s white-noise buffer once for realistic paper cardstock bursts */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = ctx.sampleRate;
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

/** Helper to trigger a crisp filtered-noise cardstock burst */
function triggerPaperBurst(
  ctx: AudioContext,
  startOffset: number,
  duration: number,
  freqStart: number,
  freqEnd: number,
  q: number,
  peakGain: number,
  filterType: BiquadFilterType = 'bandpass',
) {
  const t = ctx.currentTime + startOffset;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freqStart, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), t + duration);
  filter.Q.value = q;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(peakGain, t + Math.min(0.006, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  src.connect(filter).connect(gain).connect(getDestination());
  src.start(t, Math.random() * 0.5, duration + 0.02);
  src.stop(t + duration + 0.02);
}

// === Realistic Cardstock & Game Synth Sounds ===

/** Crisp card draw off deck (paper friction slide + quick snap) */
function synthCardDraw() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.055, 2200, 4800, 1.8, 0.42, 'bandpass');
  triggerPaperBurst(ctx, 0.032, 0.028, 3600, 1800, 2.2, 0.25, 'highpass');
}

/** Tactile 3D card flip (two crisp cardstock flicks + subtle wooden tap) */
function synthCardFlip() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.035, 3200, 1600, 2.5, 0.45, 'bandpass');
  triggerPaperBurst(ctx, 0.048, 0.045, 2100, 4200, 1.9, 0.35, 'bandpass');
  // Subtle wood contact
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, ctx.currentTime + 0.055);
  osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.1);
  g.gain.setValueAtTime(0.18, ctx.currentTime + 0.055);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
  osc.connect(g).connect(getDestination());
  osc.start(ctx.currentTime + 0.055);
  osc.stop(ctx.currentTime + 0.12);
}

/** Crisp card slap onto wooden desk / Archive pile */
function synthCardSlap() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.042, 2600, 900, 1.4, 0.55, 'bandpass');
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(165, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.07);
  gain.gain.setValueAtTime(0.45, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.09);
}

/** Crisp double-card slap + celebratory chime on successful Basra/Archive match */
function synthCardMatch() {
  synthCardSlap();
  const ctx = getAudioCtx();
  const dest = getDestination();
  const notes = [659.25, 987.77]; // E5 -> B5 crisp interval
  notes.forEach((freq, idx) => {
    const t = ctx.currentTime + 0.04 + idx * 0.08;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

/** Mysterious paper slip + bright reveal chime for secret peeks */
function synthPeekChime() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.04, 2800, 3800, 2.0, 0.3, 'bandpass');
  const t = ctx.currentTime + 0.025;
  [783.99, 1174.66].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.06);
    g.gain.setValueAtTime(0.18, t + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.22);
    osc.connect(g).connect(getDestination());
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + 0.24);
  });
}

function synthStamp() {
  synthCardSlap();
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.14);
  gain.gain.setValueAtTime(0.55, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.17);
}

function synthPrankAlarm() {
  const ctx = getAudioCtx();
  const dest = getDestination();
  triggerPaperBurst(ctx, 0, 0.04, 3000, 1200, 1.5, 0.4, 'bandpass');
  const t = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, t + i * 0.13);
    osc.frequency.setValueAtTime(720, t + i * 0.13 + 0.06);
    gain.gain.setValueAtTime(0.28, t + i * 0.13);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.12);
    osc.connect(gain).connect(dest);
    osc.start(t + i * 0.13);
    osc.stop(t + i * 0.13 + 0.13);
  }
}

function synthShieldBlock() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.03, 2500, 1500, 2.0, 0.35, 'bandpass');
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1750, ctx.currentTime + 0.06);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.22);
  gain.gain.setValueAtTime(0.32, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.27);
}

function synthTickTock() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.015, 2200, 1200, 3.0, 0.22, 'bandpass');
}

function synthWinFanfare() {
  const ctx = getAudioCtx();
  const dest = getDestination();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const start = ctx.currentTime + i * 0.12;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.28, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain).connect(dest);
    osc.start(start);
    osc.stop(start + 0.36);
  });
}

function synthShutterClose() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.16, 1200, 240, 1.1, 0.7, 'lowpass');
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.22);
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.26);
}

function synthSwoosh() {
  const ctx = getAudioCtx();
  triggerPaperBurst(ctx, 0, 0.14, 900, 3600, 1.6, 0.45, 'bandpass');
  triggerPaperBurst(ctx, 0.09, 0.04, 2400, 1000, 1.8, 0.3, 'bandpass');
}

function synthBuzz() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(105, ctx.currentTime + 0.22);
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
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
      masterGain.gain.setValueAtTime(isMuted ? 0 : 1, audioCtx.currentTime);
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
