// ========================
// EL-KHETM — Studio Acoustic Sound Engine (Web Audio API Foley + Warm Room Reverb)
// ========================

import { useCallback, useEffect } from 'react';
import type { SoundEffect } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let dryBus: GainNode | null = null;
let reverbSend: GainNode | null = null;
let pinkNoiseBuf: AudioBuffer | null = null;

function createWarmRoomImpulse(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.42);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 2.8);
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.08 * white) / 1.08; // Gentle warm room low-pass
      data[i] = lastOut * env * 0.7;
    }
  }
  return impulse;
}

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
    compressor.knee.setValueAtTime(18, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.004, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.18, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = useGameStore.getState().isMuted ? 0 : 0.92;
    compressor.connect(masterGain).connect(audioCtx.destination);

    dryBus = audioCtx.createGain();
    dryBus.gain.value = 1.0;
    dryBus.connect(compressor);

    const convolver = audioCtx.createConvolver();
    convolver.buffer = createWarmRoomImpulse(audioCtx);
    reverbSend = audioCtx.createGain();
    reverbSend.gain.value = 0.22;
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

/** Smooth 1.2s pink-noise buffer (much warmer and more natural than harsh white noise) */
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
  filter.frequency.setValueAtTime(fStart, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, fEnd), t + duration);
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + Math.min(0.008, duration * 0.25));
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);

  src.connect(filter).connect(g);
  routeAudio(g, wet);
  src.start(t, Math.random() * 0.6, duration + 0.03);
  src.stop(t + duration + 0.03);
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
) {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + offset;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, freqEnd), t + duration);
  }

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(lpfCutoff, t);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(gainPeak, t + Math.min(0.01, duration * 0.2));
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(lpf).connect(g);
  routeAudio(g, wet);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// === Tactile Card & Egyptian Office Sound Effects ===

/** Crisp card slide off felt deck + soft parchment flick */
function synthCardDraw() {
  playFilteredNoise(0, 0.075, 1100, 3200, 1.5, 0.65, 'bandpass');
  playFilteredNoise(0.04, 0.035, 3600, 1800, 2.1, 0.45, 'bandpass');
  playTone(0.042, 0.045, 220, 110, 'sine', 0.18, 900);
}

/** Realistic 2-stage cardstock flip with muted wood settle */
function synthCardFlip() {
  playFilteredNoise(0, 0.038, 2800, 1300, 2.2, 0.55, 'bandpass');
  playFilteredNoise(0.055, 0.052, 1600, 3800, 1.8, 0.55, 'bandpass');
  playTone(0.06, 0.065, 165, 68, 'sine', 0.28, 750);
}

/** Heavy felt-and-mahogany desk slap */
function synthCardSlap() {
  playFilteredNoise(0, 0.055, 1900, 620, 1.2, 0.72, 'bandpass');
  playTone(0, 0.09, 145, 44, 'sine', 0.52, 520);
  playTone(0, 0.04, 290, 95, 'triangle', 0.2, 950);
}

/** Authoritative brass-and-rubber Egyptian desk stamp THUNK */
function synthStamp() {
  // Subtle spring latch click
  playFilteredNoise(0, 0.018, 3800, 2200, 3.0, 0.4, 'highpass');
  // Deep mahogany thud
  playTone(0.012, 0.17, 115, 32, 'sine', 0.68, 420);
  playTone(0.012, 0.075, 210, 58, 'triangle', 0.28, 700);
  playFilteredNoise(0.012, 0.05, 1200, 380, 1.1, 0.55, 'lowpass');
  // Subtle rubber ink-pad release
  playFilteredNoise(0.11, 0.03, 900, 1600, 1.8, 0.16, 'bandpass');
}

/** Warm tactile card snap + velvet marimba chord */
function synthCardMatch() {
  synthCardSlap();
  const chord = [523.25, 659.25, 783.99, 1046.5];
  chord.forEach((f, idx) => {
    playTone(0.045 + idx * 0.055, 0.34, f, f, 'sine', 0.22, 3600);
    playTone(0.045 + idx * 0.055, 0.16, f * 2, f * 2, 'triangle', 0.06, 2800);
  });
}

/** Soft mysterious paper whisper + warm glass-bell dyad */
function synthPeekChime() {
  playFilteredNoise(0, 0.055, 2200, 3800, 1.8, 0.36, 'bandpass');
  playTone(0.03, 0.32, 659.25, 659.25, 'sine', 0.18, 3200);
  playTone(0.095, 0.38, 987.77, 987.77, 'sine', 0.2, 3400);
  playTone(0.095, 0.18, 1975.5, 1975.5, 'sine', 0.05, 3600);
}

/** Playful muted-brass prank sting + snappy rim click (not harsh!) */
function synthPrankAlarm() {
  playFilteredNoise(0, 0.03, 2600, 1400, 2.0, 0.42, 'bandpass');
  // Muted comedic brass double-swell
  playTone(0.01, 0.14, 349.23, 392.0, 'sawtooth', 0.16, 1250);
  playTone(0.01, 0.14, 174.61, 196.0, 'triangle', 0.22, 900);
  playTone(0.16, 0.2, 466.16, 440.0, 'sawtooth', 0.17, 1350);
  playTone(0.16, 0.2, 233.08, 220.0, 'triangle', 0.24, 950);
}

/** Deep ceramic/bronze deflection chime + warm resonant shield */
function synthShieldBlock() {
  playTone(0, 0.08, 240, 95, 'sine', 0.34, 800);
  playTone(0.01, 0.35, 880, 880, 'sine', 0.22, 3400);
  playTone(0.01, 0.28, 1318.5, 1318.5, 'triangle', 0.1, 3200);
  playTone(0.075, 0.38, 1174.66, 1174.66, 'sine', 0.18, 3400);
}

/** Subtle crisp wristwatch mechanical tick */
function synthTickTock() {
  playFilteredNoise(0, 0.014, 2800, 1600, 3.2, 0.28, 'bandpass', false);
  playTone(0, 0.018, 1250, 750, 'sine', 0.1, 2500, false);
}

/** Rich warm celebratory marimba + brass fanfare */
function synthWinFanfare() {
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
  notes.forEach((freq, i) => {
    const start = i * 0.11;
    const isLast = i === notes.length - 1;
    const dur = isLast ? 0.65 : 0.28;
    playTone(start, dur, freq, freq, 'triangle', isLast ? 0.26 : 0.2, 3200);
    playTone(start, dur * 0.85, freq * 0.5, freq * 0.5, 'sine', 0.18, 1400);
    if (isLast) {
      playTone(start + 0.02, 0.55, 659.25, 659.25, 'sine', 0.14, 2600);
      playTone(start + 0.02, 0.55, 783.99, 783.99, 'sine', 0.14, 2800);
    }
  });
}

/** Metallic office-window shutter rail clatter + heavy bottom lock slam */
function synthShutterClose() {
  for (let i = 0; i < 4; i++) {
    playFilteredNoise(i * 0.042, 0.036, 2200 - i * 250, 900, 2.0, 0.45, 'bandpass');
  }
  playFilteredNoise(0.16, 0.09, 950, 260, 1.1, 0.72, 'lowpass');
  playTone(0.17, 0.2, 130, 38, 'sine', 0.6, 460);
  playTone(0.17, 0.09, 240, 82, 'triangle', 0.24, 900);
}

/** Silky card whip across the felt table */
function synthSwoosh() {
  playFilteredNoise(0, 0.16, 420, 2600, 1.4, 0.65, 'bandpass');
  playFilteredNoise(0.08, 0.1, 2200, 680, 1.5, 0.42, 'bandpass');
}

/** Soft muted wooden mallet "nope" double-tap */
function synthBuzz() {
  playTone(0, 0.075, 165, 110, 'sine', 0.34, 480);
  playTone(0.09, 0.11, 135, 82, 'sine', 0.36, 420);
  playFilteredNoise(0, 0.025, 700, 320, 1.4, 0.25, 'lowpass');
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
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.92, audioCtx.currentTime);
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
