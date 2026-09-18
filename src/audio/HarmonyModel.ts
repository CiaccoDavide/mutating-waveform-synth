export type HarmonyPresetId =
  | 'unison'
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

export const HARMONY_PRESETS: HarmonyPreset[] = [
  { id: 'unison', name: 'Unison', intervals: [0] },
  { id: 'fifth', name: 'Fifth', intervals: [0, 7] },
  { id: 'octave', name: 'Octave', intervals: [0, 12] },
  { id: 'minor', name: 'Minor Triad', intervals: [0, 3, 7] },
  { id: 'major', name: 'Major Triad', intervals: [0, 4, 7] },
  { id: 'sus2', name: 'Sus2', intervals: [0, 2, 7] },
  { id: 'custom', name: 'Custom', intervals: [0, 5, 7, 10, 12, 17, 19, 24] },
];

export const VOICE_COUNT = 8;

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
    const interval = intervals[i % intervals.length] ?? 0;
    const freq = rootHz * semitoneRatio(interval);
    return {
      enabled: i < intervals.length,
      freeMode: false,
      freeFreqHz: Math.round(freq * 100) / 100,
      detuneCents: 0,
      gain: i === 0 ? 0.4 : 0.22,
      pan: (i / (VOICE_COUNT - 1)) * 1.6 - 0.8,
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

export function intervalsForPreset(
  presetId: HarmonyPresetId,
  customIntervals: number[],
): number[] {
  if (presetId === 'custom') return customIntervals;
  const preset = HARMONY_PRESETS.find((p) => p.id === presetId);
  return preset?.intervals ?? [0];
}
