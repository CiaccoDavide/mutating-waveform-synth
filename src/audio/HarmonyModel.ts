export type HarmonyPresetId =
  | 'unison'
  | 'sub'
  | 'sub2'
  | 'fifth'
  | 'octave'
  | 'minor'
  | 'major'
  | 'sus2'
  | 'custom';

export interface HarmonyPreset {
  id: HarmonyPresetId;
  name: string;
  /** Semitone offsets from root (equal temperament) */
  intervals: number[];
}

export const VOICE_COUNT = 8;

/**
 * Repeat a base interval pattern across `count` voices, raising one octave
 * each full cycle — e.g. [0, -12] → osc/sub pairs at successive registers.
 */
export function expandIntervals(base: number[], count: number): number[] {
  if (base.length === 0) return Array.from({ length: count }, () => 0);
  return Array.from({ length: count }, (_, i) => {
    return base[i % base.length]! + 12 * Math.floor(i / base.length);
  });
}

export const HARMONY_PRESETS: HarmonyPreset[] = [
  { id: 'unison', name: 'Unison', intervals: [0] },
  /** Osc + sub (−1 oct) — enable more voices to stack octave pairs */
  {
    id: 'sub',
    name: 'Osc + Sub',
    intervals: [0, -12],
  },
  /** Osc + deep sub (−2 oct) */
  {
    id: 'sub2',
    name: 'Osc + Sub (−2)',
    intervals: [0, -24],
  },
  { id: 'fifth', name: 'Fifth', intervals: [0, 7] },
  { id: 'octave', name: 'Octave', intervals: [0, 12] },
  { id: 'minor', name: 'Minor Triad', intervals: [0, 3, 7] },
  { id: 'major', name: 'Major Triad', intervals: [0, 4, 7] },
  { id: 'sus2', name: 'Sus2', intervals: [0, 2, 7] },
  { id: 'custom', name: 'Custom', intervals: [0, 5, 7, 10, 12, 17, 19, 24] },
];

/** Default custom interval set sized for VOICE_COUNT */
export const CUSTOM_INTERVALS = [0, 5, 7, 10, 12, 17, 19, 24];

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/** MIDI note number to frequency (A4 = 440) */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteOctaveToMidi(noteIndex: number, octave: number): number {
  return (octave + 1) * 12 + noteIndex;
}

export function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

export interface VoiceState {
  enabled: boolean;
  /** When true, frequency comes from freeFreqHz instead of harmony */
  freeMode: boolean;
  freeFreqHz: number;
  detuneCents: number;
  gain: number;
  pan: number;
}

export function createDefaultVoices(rootHz: number, intervals: number[]): VoiceState[] {
  return Array.from({ length: VOICE_COUNT }, (_, i) => {
    const interval = intervalForVoice(intervals, i);
    const freq = rootHz * semitoneRatio(interval);
    const isSub = interval < 0;
    return {
      enabled: i < Math.max(intervals.length, 1),
      freeMode: false,
      freeFreqHz: Math.round(freq * 100) / 100,
      detuneCents: 0,
      gain: isSub ? 0.2 : i === 0 ? 0.4 : 0.26,
      pan: isSub ? 0 : (i / Math.max(1, VOICE_COUNT - 1)) * 1.6 - 0.8,
    };
  });
}

export function resolveVoiceFrequency(
  voice: VoiceState,
  rootHz: number,
  intervalSemitones: number,
): number {
  const base = voice.freeMode
    ? voice.freeFreqHz
    : rootHz * semitoneRatio(intervalSemitones);
  return base * Math.pow(2, voice.detuneCents / 1200);
}

/** Interval for voice `index`, stacking the pattern up by octaves as needed. */
export function intervalForVoice(intervals: number[], index: number): number {
  return expandIntervals(intervals, index + 1)[index] ?? 0;
}

export function intervalsForPreset(
  presetId: HarmonyPresetId,
  customIntervals: number[],
): number[] {
  if (presetId === 'custom') return customIntervals;
  const preset = HARMONY_PRESETS.find((p) => p.id === presetId);
  return preset?.intervals ?? [0];
}
