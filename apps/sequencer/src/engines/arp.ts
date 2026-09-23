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

export type ArpPattern = 'up' | 'down' | 'updown' | 'random';

export interface ArpState {
  degrees: number[];
  pattern: ArpPattern;
  rate: number;
  octaves: number;
}

export function defaultArp(): ArpState {
  return {
    degrees: [0, 2, 4, 7],
    pattern: 'up',
    rate: 1,
    octaves: 1,
  };
}

export function normalizeArp(raw: unknown): ArpState {
  const d = defaultArp();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<ArpState>;
  const pats = ['up', 'down', 'updown', 'random'] as const;
  const pattern = pats.includes(o.pattern as typeof pats[number]) ? (o.pattern as ArpState['pattern']) : d.pattern;
  const degrees = Array.isArray(o.degrees) && o.degrees.length ? o.degrees.map(Number).filter(Number.isFinite) : d.degrees;
  return {
    degrees: degrees.length ? degrees : [0],
    pattern,
    rate: Math.max(1, Math.min(8, Math.round(o.rate ?? d.rate))),
    octaves: Math.max(0, Math.min(3, Math.round(o.octaves ?? d.octaves))),
  };
}


function buildOrder(st: ArpState): number[] {
  const base = st.degrees.length ? st.degrees : [0];
  const notes: number[] = [];
  for (let o = 0; o <= st.octaves; o += 1) {
    for (const d of base) notes.push(d + o * 7);
  }
  if (st.pattern === 'down') return [...notes].reverse();
  if (st.pattern === 'updown') {
    if (notes.length < 2) return notes;
    return [...notes, ...notes.slice(1, -1).reverse()];
  }
  return notes;
}

export function createArpEngine(getState: () => ArpState): Engine {
  let tick = 0;
  let idx = 0;
  let last = 0;

  return {
    id: 'arp',
    name: 'Arp',
    reset() {
      tick = 0;
      idx = 0;
      last = 0;
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
      const order = buildOrder(st);
      if (order.length === 0) return [];
      let deg: number;
      if (st.pattern === 'random') {
        deg = order[Math.floor(Math.random() * order.length)]!;
      } else {
        deg = order[idx % order.length]!;
        idx += 1;
      }
      last = deg;
      return [
        {
          note: degreeToMidi(deg, shared.rootNote, shared.octave, shared.scaleId),
          velocity: shared.velocity,
          durationBeats: shared.gate * 0.2 * rate,
        },
      ];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const order = buildOrder(st);
      const n = Math.max(1, order.length);
      for (let i = 0; i < n; i += 1) {
        const x = (i + 0.5) / n;
        const deg = order[i]!;
        const active = deg === last;
        scene.circles.push({
          x,
          y: 0.55 - (deg % 12) * 0.03,
          r: active ? 0.04 : 0.025,
          color: active ? AMBER : TEAL,
        });
      }
      scene.segments.push({
        x0: 0.05,
        y0: 0.85,
        x1: 0.95,
        y1: 0.85,
        thickness: 0.008,
        color: MUTED,
      });
      return scene;
    },
  };
}
