import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { euclid, hitIndex, isGridSixteenth } from './euclid';
import {
  AMBER,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface PolyLane {
  steps: number;
  pulses: number;
  rotate: number;
  division: number;
  degreeBase: number;
}

export interface PolyrhythmState {
  lanes: PolyLane[];
}

export function defaultLane(i = 0): PolyLane {
  return {
    steps: [16, 12, 8][i % 3]!,
    pulses: [5, 4, 3][i % 3]!,
    rotate: i,
    division: 1,
    degreeBase: i * 2,
  };
}

export function defaultPolyrhythm(): PolyrhythmState {
  return { lanes: [defaultLane(0), defaultLane(1), defaultLane(2)] };
}

export function normalizePolyrhythm(raw: unknown): PolyrhythmState {
  const d = defaultPolyrhythm();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<PolyrhythmState>;
  if (!Array.isArray(o.lanes) || o.lanes.length === 0) return d;
  return {
    lanes: o.lanes.map((lane, i) => ({
      ...defaultLane(i),
      ...lane,
      steps: Math.max(2, Math.round(lane.steps ?? defaultLane(i).steps)),
      pulses: Math.max(0, Math.round(lane.pulses ?? defaultLane(i).pulses)),
      rotate: Math.round(lane.rotate ?? 0),
      division: Math.max(1, Math.round(lane.division ?? 1)),
      degreeBase: Math.round(lane.degreeBase ?? defaultLane(i).degreeBase),
    })),
  };
}


export function createPolyrhythmEngine(
  getState: () => PolyrhythmState,
): Engine {
  let tick = 0;
  let playheads: number[] = [];

  return {
    id: 'polyrhythm',
    name: 'Polyrhythm',
    reset() {
      tick = 0;
      playheads = [];
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const out: ScheduledNote[] = [];
      while (playheads.length < st.lanes.length) playheads.push(0);
      playheads = playheads.slice(0, st.lanes.length);

      for (let li = 0; li < st.lanes.length; li += 1) {
        const lane = st.lanes[li]!;
        const div = Math.max(1, Math.round(lane.division));
        if (tick % div !== 0) continue;
        const n = Math.max(2, lane.steps);
        const idx = Math.floor(tick / div) % n;
        playheads[li] = idx;
        const pattern = euclid(n, lane.pulses, lane.rotate);
        const hi = hitIndex(pattern, idx);
        if (hi < 0) continue;
        out.push({
          note: degreeToMidi(
            lane.degreeBase + hi,
            shared.rootNote,
            shared.octave,
            shared.scaleId,
          ),
          velocity: shared.velocity * (1 - li * 0.08),
          durationBeats: shared.gate * 0.22 * div,
        });
      }
      tick += 1;
      return out;
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const L = Math.max(1, st.lanes.length);
      for (let li = 0; li < L; li += 1) {
        const lane = st.lanes[li]!;
        const n = Math.max(2, lane.steps);
        const pattern = euclid(n, lane.pulses, lane.rotate);
        const y0 = 0.15 + (li / L) * 0.7;
        const y1 = y0 + 0.55 / L;
        const ph = playheads[li] ?? 0;
        for (let i = 0; i < n; i += 1) {
          const x = (i + 0.5) / n;
          const on = pattern[i]!;
          const active = ph === i;
          scene.segments.push({
            x0: x,
            y0,
            x1: x,
            y1,
            thickness: Math.max(0.015, 0.5 / n),
            color: active && on ? AMBER : on ? TEAL : MUTED,
          });
        }
      }
      return scene;
    },
  };
}
