import { VOICE_COUNT } from './HarmonyModel';
import type { VoiceState } from './HarmonyModel';

export type ArpMode = 'up' | 'down' | 'updown' | 'random';

export interface ArpState {
  enabled: boolean;
  mode: ArpMode;
  rateHz: number;
  gate: number;
}

export const ARP_MODES: { id: ArpMode; name: string }[] = [
  { id: 'up', name: 'Up' },
  { id: 'down', name: 'Down' },
  { id: 'updown', name: 'Up/Down' },
  { id: 'random', name: 'Random' },
];

export const DEFAULT_ARP: ArpState = {
  enabled: false,
  mode: 'up',
  rateHz: 2,
  gate: 0.7,
};

/** Build ordered list of enabled voice indices for arp steps. */
export function arpStepsFromVoices(voices: VoiceState[]): number[] {
  const steps: number[] = [];
  for (let i = 0; i < voices.length; i += 1) {
    if (voices[i]?.enabled) steps.push(i);
  }
  return steps.length > 0 ? steps : [0];
}

/**
 * Pick which step index (into `steps`) is active at time `t`.
 * Returns the voice index to emphasize.
 */
export function pickArpVoiceIndex(
  steps: number[],
  mode: ArpMode,
  rateHz: number,
  t: number,
): number {
  if (steps.length === 0) return 0;
  if (steps.length === 1) return steps[0]!;

  const rate = Math.max(0.05, rateHz);
  const phase = Math.floor(t * rate);

  switch (mode) {
    case 'up':
      return steps[phase % steps.length]!;
    case 'down':
      return steps[steps.length - 1 - (phase % steps.length)]!;
    case 'updown': {
      const span = steps.length * 2 - 2;
      const p = span <= 0 ? 0 : phase % span;
      const idx = p < steps.length ? p : span - p;
      return steps[idx]!;
    }
    case 'random': {
      // Stable pseudo-random per step phase
      const x = Math.sin(phase * 127.1 + 311.7) * 43758.5453;
      const r = x - Math.floor(x);
      return steps[Math.floor(r * steps.length) % steps.length]!;
    }
  }
}

/** Gain multipliers: active step → 1, others → (1 - gate). */
export function computeArpGainMultipliers(
  voices: VoiceState[],
  arp: ArpState,
  t: number,
): number[] {
  const mults = Array.from({ length: VOICE_COUNT }, () => 1);
  if (!arp.enabled) return mults;

  const steps = arpStepsFromVoices(voices);
  const active = pickArpVoiceIndex(steps, arp.mode, arp.rateHz, t);
  const other = Math.max(0, 1 - arp.gate);

  for (let i = 0; i < VOICE_COUNT; i += 1) {
    if (!voices[i]?.enabled) {
      mults[i] = 0;
      continue;
    }
    mults[i] = i === active ? 1 : other;
  }
  return mults;
}
