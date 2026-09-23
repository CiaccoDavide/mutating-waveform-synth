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

export type ScaleId =
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'dorian'
  | 'wholetone'
  | 'chromatic';

export const SCALES: { id: ScaleId; name: string; intervals: number[] }[] = [
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'pentatonic', name: 'Minor pent', intervals: [0, 3, 5, 7, 10] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'wholetone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export function scaleMidiNotes(
  rootNote: number,
  octave: number,
  scaleId: ScaleId,
  octaves = 2,
): number[] {
  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0]!;
  const base = (octave + 1) * 12 + rootNote;
  const notes: number[] = [];
  for (let o = 0; o < octaves; o += 1) {
    for (const iv of scale.intervals) {
      notes.push(base + o * 12 + iv);
    }
  }
  return notes;
}

export function degreeToMidi(
  degree: number,
  rootNote: number,
  octave: number,
  scaleId: ScaleId,
): number {
  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0]!;
  const len = scale.intervals.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return (octave + 1) * 12 + rootNote + oct * 12 + scale.intervals[idx]!;
}
