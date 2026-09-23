import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { euclid, isGridSixteenth } from './euclid';
import {
  AMBER,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export type PhraseShape = 'saw' | 'tri' | 'sine' | 'random';

export interface PhraseState {
  steps: number;
  pulses: number;
  rotate: number;
  degMin: number;
  degMax: number;
  /** Beats for one full phrase LFO cycle */
  phraseLength: number;
  shape: PhraseShape;
}

export function defaultPhrase(): PhraseState {
  return {
    steps: 16,
    pulses: 7,
    rotate: 0,
    degMin: 0,
    degMax: 7,
    phraseLength: 8,
    shape: 'saw',
  };
}

export function normalizePhrase(raw: unknown): PhraseState {
  const d = defaultPhrase();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<PhraseState>;
  const shapes = ['saw', 'tri', 'sine', 'random'] as const;
  const shape = shapes.includes(o.shape as typeof shapes[number]) ? (o.shape as PhraseState['shape']) : d.shape;
  return {
    steps: Math.max(2, Math.min(64, Math.round(o.steps ?? d.steps))),
    pulses: Math.max(0, Math.min(64, Math.round(o.pulses ?? d.pulses))),
    rotate: Math.round(o.rotate ?? d.rotate),
    degMin: Math.round(o.degMin ?? d.degMin),
    degMax: Math.round(o.degMax ?? d.degMax),
    phraseLength: Math.max(1, Math.min(64, o.phraseLength ?? d.phraseLength)),
    shape,
  };
}


function phrasePhase(shape: PhraseShape, t: number): number {
  const u = ((t % 1) + 1) % 1;
  switch (shape) {
    case 'tri':
      return u < 0.5 ? u * 2 : 2 - u * 2;
    case 'sine':
      return 0.5 + 0.5 * Math.sin(u * Math.PI * 2);
    case 'random':
      // stable-ish hash of phase bucket
      return ((Math.sin(Math.floor(u * 32) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    case 'saw':
    default:
      return u;
  }
}

export function createPhraseEngine(getState: () => PhraseState): Engine {
  let step = 0;
  let playhead = 0;
  let phraseT = 0;
  let lastDeg = 0;

  return {
    id: 'phrase',
    name: 'Phrase',
    reset() {
      step = 0;
      playhead = 0;
      phraseT = 0;
      lastDeg = 0;
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const n = Math.max(2, st.steps);
      const idx = step % n;
      playhead = idx;
      step += 1;
      phraseT = beat / Math.max(0.25, st.phraseLength);
      const pattern = euclid(n, st.pulses, st.rotate);
      if (!pattern[idx]) return [];
      const lo = Math.min(st.degMin, st.degMax);
      const hi = Math.max(st.degMin, st.degMax);
      const span = Math.max(0, hi - lo);
      const ph = phrasePhase(st.shape, phraseT);
      const deg = Math.round(lo + ph * span);
      lastDeg = deg;
      return [
        {
          note: degreeToMidi(deg, shared.rootNote, shared.octave, shared.scaleId),
          velocity: shared.velocity,
          durationBeats: shared.gate * 0.25,
        },
      ];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const n = Math.max(2, st.steps);
      const pattern = euclid(n, st.pulses, st.rotate);
      const lo = Math.min(st.degMin, st.degMax);
      const hi = Math.max(st.degMin, st.degMax);
      const span = Math.max(1, hi - lo);

      // pitch ribbon
      for (let i = 0; i < 32; i += 1) {
        const t = i / 31;
        const ph = phrasePhase(st.shape, phraseT - (1 - t) * 0.15);
        const y = 0.75 - (ph * 0.45);
        const x = 0.05 + t * 0.9;
        if (i > 0) {
          const prevT = (i - 1) / 31;
          const prevPh = phrasePhase(st.shape, phraseT - (1 - prevT) * 0.15);
          const py = 0.75 - prevPh * 0.45;
          const px = 0.05 + prevT * 0.9;
          scene.segments.push({
            x0: px,
            y0: py,
            x1: x,
            y1: y,
            thickness: 0.01,
            color: TEAL,
          });
        }
      }
      const curY = 0.75 - ((lastDeg - lo) / span) * 0.45;
      scene.circles.push({ x: 0.95, y: curY, r: 0.03, color: AMBER });

      for (let i = 0; i < n; i += 1) {
        const x = (i + 0.5) / n;
        scene.circles.push({
          x,
          y: 0.18,
          r: playhead === i ? 0.028 : 0.016,
          color: pattern[i]
            ? playhead === i
              ? AMBER
              : TEAL
            : MUTED,
        });
      }
      return scene;
    },
  };
}
