import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { isGridSixteenth } from './euclid';
import {
  AMBER,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

/** Per step: list of scale degrees; empty = rest. */
export interface LinearState {
  length: number;
  steps: number[][];
  probability: number;
  division: number;
  octaveSpread: number;
  mutate: number;
}

export function defaultLinear(): LinearState {
  return {
    length: 8,
    steps: [[0], [2], [4], [2], [5, 7], [4], [2], []],
    probability: 1,
    division: 1,
    octaveSpread: 0,
    mutate: 0,
  };
}

export function normalizeLinearSteps(
  steps: number[][] | number[] | undefined,
  length: number,
): number[][] {
  const len = Math.max(1, length);
  if (!steps || !Array.isArray(steps)) {
    return Array.from({ length: len }, () => [0]);
  }
  return Array.from({ length: len }, (_, i) => {
    const cell = steps[i];
    if (Array.isArray(cell)) {
      return cell.filter((d) => typeof d === 'number' && d >= 0);
    }
    if (typeof cell === 'number') {
      return cell < 0 ? [] : [cell];
    }
    return [];
  });
}

export function normalizeLinear(raw: unknown): LinearState {
  const d = defaultLinear();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<LinearState>;
  const length = Math.max(1, o.length ?? d.length);
  return {
    length,
    steps: normalizeLinearSteps(o.steps as number[][] | number[], length),
    probability: o.probability ?? 1,
    division: Math.max(1, Math.round(o.division ?? 1)),
    octaveSpread: Math.max(0, Math.min(2, o.octaveSpread ?? 0)),
    mutate: o.mutate ?? 0,
  };
}

export function createLinearEngine(getState: () => LinearState): Engine {
  let tick = 0;
  let lastHit = -1;

  return {
    id: 'linear',
    name: 'Linear',
    reset() {
      tick = 0;
      lastHit = -1;
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const div = Math.max(1, Math.round(st.division));
      if (tick % div !== 0) {
        tick += 1;
        return [];
      }
      const len = Math.max(1, st.length);
      const steps = normalizeLinearSteps(st.steps, len);
      const idx = Math.floor(tick / div) % len;
      tick += 1;
      lastHit = idx;

      if (idx === 0 && st.mutate > 0 && Math.random() < st.mutate) {
        const cell = steps[idx]!;
        if (cell.length > 0) {
          const j = Math.floor(Math.random() * cell.length);
          cell[j] = Math.max(0, (cell[j] ?? 0) + (Math.random() < 0.5 ? -1 : 1));
        }
      }

      if (Math.random() > st.probability) return [];
      const degs = steps[idx] ?? [];
      const out: ScheduledNote[] = [];
      const spread = Math.max(0, Math.round(st.octaveSpread));
      for (const deg of degs) {
        for (let o = 0; o <= spread; o += 1) {
          out.push({
            note: degreeToMidi(
              deg + o * 7,
              shared.rootNote,
              shared.octave,
              shared.scaleId,
            ),
            velocity: shared.velocity * (1 - o * 0.12),
            durationBeats: shared.gate * 0.25 * div,
          });
        }
      }
      return out;
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const len = Math.max(1, st.length);
      const steps = normalizeLinearSteps(st.steps, len);
      for (let i = 0; i < len; i += 1) {
        const degs = steps[i] ?? [];
        const active = lastHit === i;
        const x0 = i / len + 0.01;
        const x1 = (i + 1) / len - 0.01;
        const has = degs.length > 0;
        scene.segments.push({
          x0: (x0 + x1) / 2,
          y0: 0.25,
          x1: (x0 + x1) / 2,
          y1: 0.75,
          thickness: Math.max(0.02, 0.7 / len),
          color: !has ? MUTED : active ? AMBER : TEAL,
        });
        if (degs.length > 1) {
          for (let k = 0; k < degs.length; k += 1) {
            const t = 0.35 + (k / Math.max(1, degs.length - 1)) * 0.3;
            scene.circles.push({
              x: (x0 + x1) / 2,
              y: t,
              r: 0.018,
              color: active ? AMBER : TEAL,
            });
          }
        }
      }
      return scene;
    },
  };
}
