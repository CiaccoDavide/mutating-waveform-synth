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

export interface PulsesState {
  steps: number;
  pulses: number;
  rotate: number;
  /** Fire every N 16ths (1 = every 16th) */
  division: number;
  probability: number;
  /** Degrees cycled on successive hits */
  notes: number[];
  accentEvery: number;
  rotateOnLoop: boolean;
  gateSkew: number;
}

export function defaultPulses(): PulsesState {
  return {
    steps: 16,
    pulses: 5,
    rotate: 0,
    division: 1,
    probability: 1,
    notes: [0, 2, 4, 5, 7],
    accentEvery: 0,
    rotateOnLoop: false,
    gateSkew: 0,
  };
}

export function normalizePulses(raw: unknown): PulsesState {
  const d = defaultPulses();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<PulsesState>;
  const notes = Array.isArray(o.notes) && o.notes.length ? o.notes.map(Number).filter(Number.isFinite) : d.notes;
  return {
    steps: Math.max(2, Math.min(64, Math.round(o.steps ?? d.steps))),
    pulses: Math.max(0, Math.min(64, Math.round(o.pulses ?? d.pulses))),
    rotate: Math.round(o.rotate ?? d.rotate),
    division: Math.max(1, Math.min(8, Math.round(o.division ?? d.division))),
    probability: Math.min(1, Math.max(0, o.probability ?? d.probability)),
    notes: notes.length ? notes : [0],
    accentEvery: Math.max(0, Math.min(32, Math.round(o.accentEvery ?? d.accentEvery))),
    rotateOnLoop: Boolean(o.rotateOnLoop ?? d.rotateOnLoop),
    gateSkew: Math.min(1, Math.max(0, o.gateSkew ?? d.gateSkew)),
  };
}


export function createPulsesEngine(getState: () => PulsesState): Engine {
  let tick = 0;
  let playhead = 0;
  let lastHit = -1;
  let hitCount = 0;
  let rotateExtra = 0;

  return {
    id: 'pulses',
    name: 'Pulses',
    reset() {
      tick = 0;
      playhead = 0;
      lastHit = -1;
      hitCount = 0;
      rotateExtra = 0;
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
      const n = Math.max(2, st.steps);
      const idx = Math.floor(tick / div) % n;
      if (idx === 0 && tick > 0 && st.rotateOnLoop) {
        rotateExtra = (rotateExtra + 1) % n;
      }
      playhead = idx;
      tick += 1;
      const rot = st.rotate + rotateExtra;
      const pattern = euclid(n, st.pulses, rot);
      const hi = hitIndex(pattern, idx);
      if (hi < 0) return [];
      if (Math.random() > st.probability) return [];
      lastHit = idx;
      hitCount += 1;
      const notes = st.notes.length > 0 ? st.notes : [0];
      const deg = notes[hi % notes.length]!;
      const accent =
        st.accentEvery > 0 && hitCount % st.accentEvery === 0 ? 1.25 : 1;
      const skew = st.gateSkew * (Math.random() * 2 - 1);
      const gateMul = Math.max(0.15, Math.min(1.5, 1 + skew));
      return [
        {
          note: degreeToMidi(deg, shared.rootNote, shared.octave, shared.scaleId),
          velocity: Math.min(127, shared.velocity * accent),
          durationBeats: shared.gate * 0.25 * div * gateMul,
        },
      ];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const n = Math.max(2, st.steps);
      const pattern = euclid(n, st.pulses, st.rotate + rotateExtra);
      for (let i = 0; i < n; i += 1) {
        const x0 = i / n + 0.01;
        const x1 = (i + 1) / n - 0.01;
        const on = pattern[i]!;
        const active = playhead === i;
        scene.segments.push({
          x0: (x0 + x1) / 2,
          y0: 0.28,
          x1: (x0 + x1) / 2,
          y1: 0.72,
          thickness: Math.max(0.025, 0.65 / n),
          color: active && on ? AMBER : on ? TEAL : MUTED,
        });
        if (lastHit === i) {
          scene.circles.push({
            x: (x0 + x1) / 2,
            y: 0.5,
            r: 0.04,
            color: AMBER,
          });
        }
      }
      return scene;
    },
  };
}
