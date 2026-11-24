// ========================
// EL-KHETM — Sound Engine (Web Audio API + optional .mp3 assets)
// ========================

import { useCallback, useEffect, useRef } from 'react';
import type { SoundEffect } from '@el-khetm/shared';
import { SOUND_FILES } from '../config/assets';
import { useGameStore } from '../store/useGameStore';

// Singleton AudioContext + Master Gain for instantaneous hardware mute
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

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

// Cache for loaded mp3 buffers
const bufferCache = new Map<string, AudioBuffer | null>();

// Try to load an mp3 file; returns null if not found
async function tryLoadMp3(url: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url) ?? null;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      bufferCache.set(url, null);
      return null;
    }
    const fullRes = await fetch(url);
    const arrayBuf = await fullRes.arrayBuffer();
    const ctx = getAudioCtx();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    bufferCache.set(url, decoded);
    return decoded;
  } catch {
    bufferCache.set(url, null);
    return null;
  }
}

// Play an AudioBuffer
function playBuffer(buffer: AudioBuffer) {
  const ctx = getAudioCtx();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(getDestination());
  source.start();
}

// === Synthesized Sounds ===

function synthStamp() {
  const ctx = getAudioCtx();
  const dest = getDestination();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain).connect(dest);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
  // Add a click/thud
  const noise = ctx.createOscillator();
  const nGain = ctx.createGain();
  noise.type = 'triangle';
  noise.frequency.setValueAtTime(150, ctx.currentTime);
  noise.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08);
  nGain.gain.setValueAtTime(0.8, ctx.currentTime);
  nGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  noise.connect(nGain).connect(dest);
  noise.start();
  noise.stop(ctx.currentTime + 0.1);
}

function synthCardFlip() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

function synthCardDraw() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function synthPrankAlarm() {
  const ctx = getAudioCtx();
  const dest = getDestination();
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t + i * 0.12);
    osc.frequency.setValueAtTime(800, t + i * 0.12 + 0.06);
    gain.gain.setValueAtTime(0.35, t + i * 0.12);
    gain.gain.setValueAtTime(0.35, t + i * 0.12 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.11);
    osc.connect(gain).connect(dest);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.12);
  }
}

function synthShieldBlock() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.05);
  osc.frequency.setValueAtTime(2400, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function synthTickTock() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

function synthWinFanfare() {
  const ctx = getAudioCtx();
  const dest = getDestination();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
    osc.connect(gain).connect(dest);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.3);
  });
}

function synthShutterClose() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

function synthSwoosh() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}

function synthBuzz() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.setValueAtTime(0.35, ctx.currentTime + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.connect(gain).connect(getDestination());
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

const SYNTH_MAP: Record<SoundEffect, () => void> = {
  stamp: synthStamp,
  card_flip: synthCardFlip,
  card_draw: synthCardDraw,
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
  const mp3CheckedRef = useRef(new Set<SoundEffect>());

  // Immediately silence or restore Web Audio master gain & hardware context when mute changes
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

  // Init AudioContext on first user interaction
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

  const play = useCallback(async (sound: SoundEffect) => {
    if (useGameStore.getState().isMuted) return;

    // Try mp3 first (auto-detect)
    const mp3Url = SOUND_FILES[sound];
    if (mp3Url && !mp3CheckedRef.current.has(sound)) {
      mp3CheckedRef.current.add(sound);
      const buffer = await tryLoadMp3(mp3Url);
      if (useGameStore.getState().isMuted) return;
      if (buffer) {
        playBuffer(buffer);
        return;
      }
    } else if (mp3Url) {
      const cached = bufferCache.get(mp3Url);
      if (cached) {
        playBuffer(cached);
        return;
      }
    }

    if (useGameStore.getState().isMuted) return;
    // Fallback to synth
    const synth = SYNTH_MAP[sound];
    if (synth) synth();
  }, []);

  return { play, toggleMute, isMuted };
}
