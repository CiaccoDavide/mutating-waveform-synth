import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { isGridSixteenth } from './euclid';
import {
  AMBER,
  DIM,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface MarkovState {
  stay: number;
  jump: number;
  rate: number;
  startDeg: number;
  /** Max scale-degree span for walks */
  range: number;
}

export function defaultMarkov(): MarkovState {
  return { stay: 0.25, jump: 0.2, rate: 1, startDeg: 0, range: 11 };
}

export function normalizeMarkov(raw: unknown): MarkovState {
  const d = defaultMarkov();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<MarkovState>;
  return {
    stay: Math.min(0.9, Math.max(0, o.stay ?? d.stay)),
    jump: Math.min(0.9, Math.max(0, o.jump ?? d.jump)),
    rate: Math.max(1, Math.round(o.rate ?? d.rate)),
    startDeg: Math.max(0, Math.min(11, Math.round(o.startDeg ?? d.startDeg))),
    range: Math.max(1, Math.min(11, Math.round(o.range ?? d.range))),
  };
}

export function createMarkovEngine(getState: () => MarkovState): Engine {
  let tick = 0;
  let deg = 0;
  let prev = 0;

  return {
    id: 'markov',
    name: 'Markov',
    reset() {
      tick = 0;
      deg = getState().startDeg;
      prev = deg;
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const rate = Math.max(1, Math.round(st.rate));
      if (tick % rate !== 0) {
        tick += 1;
        return [];
      }
      tick += 1;
      prev = deg;
      const r = Math.random();
      if (r < st.stay) {
        // stay
      } else if (r < st.stay + st.jump) {
        const span = Math.max(1, st.range);
        deg = Math.max(0, Math.min(span, Math.round(Math.random() * span)));
      } else {
        const step = Math.random() < 0.5 ? -1 : 1;
        const wide = Math.random() < 0.35 ? 2 : 1;
        const span = Math.max(1, st.range);
        deg = Math.max(0, Math.min(span, deg + step * wide));
      }
      return [
        {
          note: degreeToMidi(deg, shared.rootNote, shared.octave, shared.scaleId),
          velocity: shared.velocity,
          durationBeats: shared.gate * 0.22 * rate,
        },
      ];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const n = 12;
      const cx = 0.5;
      const cy = 0.5;
      const rad = 0.32;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        scene.segments.push({
          x0: x,
          y0: y,
          x1: cx + Math.cos(a2) * rad,
          y1: cy + Math.sin(a2) * rad,
          thickness: 0.006,
          color: DIM,
        });
        scene.circles.push({
          x,
          y,
          r: i === deg ? 0.04 : 0.02,
          color: i === deg ? AMBER : TEAL,
        });
      }
      // edge prev -> deg
      const ap = (prev / n) * Math.PI * 2 - Math.PI / 2;
      const ad = (deg / n) * Math.PI * 2 - Math.PI / 2;
      scene.segments.push({
        x0: cx + Math.cos(ap) * rad,
        y0: cy + Math.sin(ap) * rad,
        x1: cx + Math.cos(ad) * rad,
        y1: cy + Math.sin(ad) * rad,
        thickness: 0.014,
        color: AMBER,
      });
      return scene;
    },
  };
}
