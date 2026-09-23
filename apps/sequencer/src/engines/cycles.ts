import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { euclid, hitIndex, isGridSixteenth } from './euclid';
import {
  AMBER,
  DIM,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface CycleSnapshot {
  steps: number;
  pulses: number;
  rotate: number;
  degreeBase: number;
}

export interface CyclesState {
  cycles: CycleSnapshot[];
  cycleIndex: number;
  /** How much degreeBase advances when morphing (0–1 scales step) */
  morphAmount: number;
  /** Stay on each snapshot for this many full loops before advancing */
  holdCycles: number;
}

export function defaultCycle(i = 0): CycleSnapshot {
  return {
    steps: 8 + (i % 3) * 2,
    pulses: 3 + (i % 4),
    rotate: i,
    degreeBase: (i * 2) % 7,
  };
}

export function defaultCycles(): CyclesState {
  return {
    cycles: [
      defaultCycle(0),
      defaultCycle(1),
      defaultCycle(2),
      defaultCycle(3),
    ],
    cycleIndex: 0,
    morphAmount: 0.5,
    holdCycles: 1,
  };
}

export function normalizeCycles(raw: unknown): CyclesState {
  const d = defaultCycles();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<CyclesState>;
  const cycles =
    Array.isArray(o.cycles) && o.cycles.length
      ? o.cycles.map((c, i) => ({ ...defaultCycle(i), ...c }))
      : d.cycles;
  return {
    cycles,
    cycleIndex: Math.max(0, Math.round(o.cycleIndex ?? 0) % Math.max(1, cycles.length)),
    morphAmount: Math.min(1, Math.max(0, o.morphAmount ?? d.morphAmount)),
    holdCycles: Math.max(1, Math.min(16, Math.round(o.holdCycles ?? d.holdCycles))),
  };
}


export function createCyclesEngine(getState: () => CyclesState): Engine {
  let step = 0;
  let playhead = 0;
  let holdsLeft = 0;

  return {
    id: 'cycles',
    name: 'Cycles',
    reset() {
      step = 0;
      playhead = 0;
      getState().cycleIndex = 0;
      holdsLeft = Math.max(1, Math.round(getState().holdCycles));
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      if (st.cycles.length === 0) return [];
      if (holdsLeft <= 0) {
        holdsLeft = Math.max(1, Math.round(st.holdCycles));
      }
      const ci = ((st.cycleIndex % st.cycles.length) + st.cycles.length) % st.cycles.length;
      const cyc = st.cycles[ci]!;
      const n = Math.max(2, cyc.steps);
      const idx = step % n;
      playhead = idx;
      step += 1;
      if (idx === n - 1) {
        holdsLeft -= 1;
        if (holdsLeft <= 0) {
          const next = (ci + 1) % st.cycles.length;
          st.cycleIndex = next;
          // morph next snapshot's rotate/degree slightly
          const nxt = st.cycles[next]!;
          nxt.rotate =
            (nxt.rotate + Math.round(st.morphAmount * 2)) % Math.max(2, nxt.steps);
          nxt.degreeBase =
            (nxt.degreeBase + Math.round(st.morphAmount * 3)) % 12;
          holdsLeft = Math.max(1, Math.round(st.holdCycles));
        }
        step = 0;
      }
      const pattern = euclid(n, cyc.pulses, cyc.rotate);
      const hi = hitIndex(pattern, idx);
      if (hi < 0) return [];
      const deg = cyc.degreeBase + hi;
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
      const count = Math.max(1, st.cycles.length);
      const ci =
        ((st.cycleIndex % count) + count) % count;
      // cycle strip
      for (let i = 0; i < count; i += 1) {
        const x0 = i / count + 0.01;
        const x1 = (i + 1) / count - 0.01;
        scene.segments.push({
          x0: (x0 + x1) / 2,
          y0: 0.08,
          x1: (x0 + x1) / 2,
          y1: 0.22,
          thickness: Math.max(0.03, 0.7 / count),
          color: i === ci ? AMBER : DIM,
        });
      }
      const cyc = st.cycles[ci] ?? defaultCycle(0);
      const n = Math.max(2, cyc.steps);
      const pattern = euclid(n, cyc.pulses, cyc.rotate);
      for (let i = 0; i < n; i += 1) {
        const x0 = i / n + 0.01;
        const x1 = (i + 1) / n - 0.01;
        const on = pattern[i]!;
        const active = playhead === i;
        scene.segments.push({
          x0: (x0 + x1) / 2,
          y0: 0.35,
          x1: (x0 + x1) / 2,
          y1: 0.85,
          thickness: Math.max(0.02, 0.6 / n),
          color: active && on ? AMBER : on ? TEAL : MUTED,
        });
      }
      return scene;
    },
  };
}
