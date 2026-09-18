/** Post-filter FX + ladder + global FM state */

export type DelayAlgorithm = 'digital' | 'pingpong' | 'tape';
export type ReverbAlgorithm = 'room' | 'hall' | 'plate' | 'freeverb';

export interface ChorusParams {
  rate: number;
  depth: number;
  /** Number of modulated delay taps (2–4) */
  voices: number;
  feedback: number;
  stereoWidth: number;
}

export interface DelayParams {
  algorithm: DelayAlgorithm;
  timeMs: number;
  feedback: number;
  /** Lowpass cutoff (Hz) in feedback path */
  tone: number;
}

export interface ReverbParams {
  algorithm: ReverbAlgorithm;
  size: number;
  decay: number;
  damping: number;
  preDelayMs: number;
}

export interface ChorusEffect {
  id: 'chorus';
  type: 'chorus';
  enabled: boolean;
  mix: number;
  params: ChorusParams;
}

export interface DelayEffect {
  id: 'delay';
  type: 'delay';
  enabled: boolean;
  mix: number;
  params: DelayParams;
}

export interface ReverbEffect {
  id: 'reverb';
  type: 'reverb';
  enabled: boolean;
  mix: number;
  params: ReverbParams;
}

export type EffectSlot = ChorusEffect | DelayEffect | ReverbEffect;

export interface EffectsState {
  chorus: ChorusEffect;
  delay: DelayEffect;
  reverb: ReverbEffect;
}

export interface LadderState {
  enabled: boolean;
  cutoff: number;
  resonance: number;
  drive: number;
}

export interface FmState {
  enabled: boolean;
  /** Modulator / carrier frequency ratio */
  ratio: number;
  /** Modulation index */
  index: number;
}

export const DELAY_ALGORITHMS: { id: DelayAlgorithm; name: string }[] = [
  { id: 'digital', name: 'Digital' },
  { id: 'pingpong', name: 'Ping-Pong' },
  { id: 'tape', name: 'Tape' },
];

export const REVERB_ALGORITHMS: { id: ReverbAlgorithm; name: string }[] = [
  { id: 'room', name: 'Room' },
  { id: 'hall', name: 'Hall' },
  { id: 'plate', name: 'Plate' },
  { id: 'freeverb', name: 'Freeverb' },
];

export function createDefaultChorusParams(
  overrides: Partial<ChorusParams> = {},
): ChorusParams {
  return {
    rate: 0.8,
    depth: 0.35,
    voices: 3,
    feedback: 0.15,
    stereoWidth: 0.7,
    ...overrides,
  };
}

export function createDefaultDelayParams(
  overrides: Partial<DelayParams> = {},
): DelayParams {
  return {
    algorithm: 'digital',
    timeMs: 320,
    feedback: 0.35,
    tone: 4200,
    ...overrides,
  };
}

export function createDefaultReverbParams(
  overrides: Partial<ReverbParams> = {},
): ReverbParams {
  return {
    algorithm: 'hall',
    size: 0.55,
    decay: 0.5,
    damping: 0.45,
    preDelayMs: 25,
    ...overrides,
  };
}

export function createDefaultEffects(
  overrides: Partial<{
    chorus: Partial<Omit<ChorusEffect, 'id' | 'type' | 'params'>> & {
      params?: Partial<ChorusParams>;
    };
    delay: Partial<Omit<DelayEffect, 'id' | 'type' | 'params'>> & {
      params?: Partial<DelayParams>;
    };
    reverb: Partial<Omit<ReverbEffect, 'id' | 'type' | 'params'>> & {
      params?: Partial<ReverbParams>;
    };
  }> = {},
): EffectsState {
  return {
    chorus: {
      id: 'chorus',
      type: 'chorus',
      enabled: overrides.chorus?.enabled ?? false,
      mix: overrides.chorus?.mix ?? 0.35,
      params: createDefaultChorusParams(overrides.chorus?.params),
    },
    delay: {
      id: 'delay',
      type: 'delay',
      enabled: overrides.delay?.enabled ?? false,
      mix: overrides.delay?.mix ?? 0.3,
      params: createDefaultDelayParams(overrides.delay?.params),
    },
    reverb: {
      id: 'reverb',
      type: 'reverb',
      enabled: overrides.reverb?.enabled ?? false,
      mix: overrides.reverb?.mix ?? 0.28,
      params: createDefaultReverbParams(overrides.reverb?.params),
    },
  };
}

export function createDefaultLadder(
  overrides: Partial<LadderState> = {},
): LadderState {
  return {
    enabled: false,
    cutoff: 1800,
    resonance: 0.35,
    drive: 0.25,
    ...overrides,
  };
}

export function createDefaultFm(overrides: Partial<FmState> = {}): FmState {
  return {
    enabled: false,
    ratio: 2,
    index: 1.5,
    ...overrides,
  };
}

export function normalizeEffects(raw: unknown): EffectsState {
  const base = createDefaultEffects();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<EffectsState>;
  return createDefaultEffects({
    chorus: o.chorus
      ? {
          enabled: o.chorus.enabled,
          mix: o.chorus.mix,
          params: o.chorus.params,
        }
      : undefined,
    delay: o.delay
      ? {
          enabled: o.delay.enabled,
          mix: o.delay.mix,
          params: o.delay.params,
        }
      : undefined,
    reverb: o.reverb
      ? {
          enabled: o.reverb.enabled,
          mix: o.reverb.mix,
          params: o.reverb.params,
        }
      : undefined,
  });
}

export function normalizeLadder(raw: unknown): LadderState {
  if (!raw || typeof raw !== 'object') return createDefaultLadder();
  const o = raw as Partial<LadderState>;
  return createDefaultLadder({
    enabled: o.enabled,
    cutoff: o.cutoff,
    resonance: o.resonance,
    drive: o.drive,
  });
}

export function normalizeFm(raw: unknown): FmState {
  if (!raw || typeof raw !== 'object') return createDefaultFm();
  const o = raw as Partial<FmState>;
  return createDefaultFm({
    enabled: o.enabled,
    ratio: o.ratio,
    index: o.index,
  });
}

/** Effects as array for snapshot serialization convenience */
export function effectsToSlots(effects: EffectsState): EffectSlot[] {
  return [effects.chorus, effects.delay, effects.reverb];
}

export function effectsFromSlots(slots: EffectSlot[] | undefined): EffectsState {
  const base = createDefaultEffects();
  if (!Array.isArray(slots)) return base;
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object') continue;
    if (slot.type === 'chorus') {
      base.chorus = {
        ...base.chorus,
        enabled: !!slot.enabled,
        mix: typeof slot.mix === 'number' ? slot.mix : base.chorus.mix,
        params: createDefaultChorusParams(slot.params),
      };
    } else if (slot.type === 'delay') {
      base.delay = {
        ...base.delay,
        enabled: !!slot.enabled,
        mix: typeof slot.mix === 'number' ? slot.mix : base.delay.mix,
        params: createDefaultDelayParams(slot.params),
      };
    } else if (slot.type === 'reverb') {
      base.reverb = {
        ...base.reverb,
        enabled: !!slot.enabled,
        mix: typeof slot.mix === 'number' ? slot.mix : base.reverb.mix,
        params: createDefaultReverbParams(slot.params),
      };
    }
  }
  return base;
}
