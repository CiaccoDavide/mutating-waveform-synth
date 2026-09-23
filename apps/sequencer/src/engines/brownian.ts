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

export interface BrownianState {
  stepSize: number;
  inertia: number;
  hold: number;
  rate: number;
  startDeg: number;
}

export function defaultBrownian(): BrownianState {
  return {
    stepSize: 2,
    inertia: 0.4,
    hold: 0.25,
    rate: 1,
    startDeg: 0,
  };
}

export function normalizeBrownian(raw: unknown): BrownianState {
  const d = defaultBrownian();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<BrownianState>;
  return {
    stepSize: Math.max(1, Math.min(6, Math.round(o.stepSize ?? d.stepSize))),
    inertia: Math.min(0.95, Math.max(0, o.inertia ?? d.inertia)),
    hold: Math.min(0.95, Math.max(0, o.hold ?? d.hold)),
    rate: Math.max(1, Math.min(8, Math.round(o.rate ?? d.rate))),
    startDeg: Math.max(0, Math.min(11, Math.round(o.startDeg ?? d.startDeg))),
  };
}


export function createBrownianEngine(getState: () => BrownianState): Engine {
  let tick = 0;
  let deg = 0;
  let vel = 0;
  const trail: number[] = [];

  return {
    id: 'brownian',
    name: 'Brownian',
    reset() {
      tick = 0;
      deg = getState().startDeg;
      vel = 0;
      trail.length = 0;
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
      if (Math.random() > st.hold) {
        const kick = (Math.random() - 0.5) * 2 * st.stepSize;
        vel = vel * st.inertia + kick * (1 - st.inertia);
        deg = Math.max(0, Math.min(14, Math.round(deg + vel)));
      }
      trail.push(deg);
      if (trail.length > 24) trail.shift();
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
      const n = Math.max(1, trail.length);
      for (let i = 0; i < n; i += 1) {
        const t = i / Math.max(1, n - 1);
        const d = trail[i]!;
        const x = 0.08 + t * 0.84;
        const y = 0.85 - (d / 14) * 0.7;
        if (i > 0) {
          const pd = trail[i - 1]!;
          const px = 0.08 + ((i - 1) / Math.max(1, n - 1)) * 0.84;
          const py = 0.85 - (pd / 14) * 0.7;
          scene.segments.push({
            x0: px,
            y0: py,
            x1: x,
            y1: y,
            thickness: 0.01,
            color: TEAL,
          });
        }
        scene.circles.push({
          x,
          y,
          r: i === n - 1 ? 0.035 : 0.016,
          color: i === n - 1 ? AMBER : MUTED,
        });
      }
      if (n === 0) {
        scene.circles.push({ x: 0.5, y: 0.5, r: 0.03, color: AMBER });
      }
      return scene;
    },
  };
}
