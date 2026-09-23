export type ScaleId =
  | 'chromatic'
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'dorian';

export const SCALES: { id: ScaleId; name: string; intervals: number[] }[] = [
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'pentatonic', name: 'Min pent', intervals: [0, 3, 5, 7, 10] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
];

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Map a free degree index onto the scale, then to MIDI (base octave 3). */
export function quantizeDegree(
  degree: number,
  root: number,
  scaleId: ScaleId,
  baseOctave = 3,
): number {
  const scale = SCALES.find((s) => s.id === scaleId) ?? SCALES[0]!;
  const len = scale.intervals.length;
  const d = Math.round(degree);
  const oct = Math.floor(d / len);
  const idx = ((d % len) + len) % len;
  return (baseOctave + 1) * 12 + clampInt(root, 0, 11) + oct * 12 + scale.intervals[idx]!;
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}
