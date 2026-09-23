import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { euclid, hitIndex } from './euclid';
import {
  AMBER,
  DIM,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

/** One concentric ring — cells stay fixed; only the playhead sweeps. */
export interface RingConfig {
  steps: number;
  hits: number;
  offset: number;
  beatsPerRev: number;
  notes: number[];
  muted: boolean;
}

export interface RadarState {
  rings: RingConfig[];
  /** When true, all rings share phase from ring 0's beatsPerRev */
  sync: boolean;
}

/** @deprecated legacy name */
export type RotatingState = RadarState;

export function defaultRing(i = 0): RingConfig {
  const steps = Math.max(4, 16 - i * 4);
  const hits = Math.max(1, 5 - i);
  return {
    steps,
    hits,
    offset: 0,
    beatsPerRev: 4,
    notes: [i * 2, i * 2 + 2, i * 2 + 4].map((d) => d % 12),
    muted: false,
  };
}

export function defaultRadar(): RadarState {
  return {
    rings: [defaultRing(0), defaultRing(1), defaultRing(2)],
    sync: false,
  };
}

export const defaultRotating = defaultRadar;

export function normalizeRadar(raw: unknown): RadarState {
  if (!raw || typeof raw !== 'object') return defaultRadar();
  const o = raw as Partial<RadarState> & {
    length?: number;
    hits?: number;
    offset?: number;
    rings?: number | RingConfig[];
    rotateEvery?: number;
  };
  if (Array.isArray(o.rings) && o.rings.length > 0) {
    return {
      sync: Boolean(o.sync),
      rings: o.rings.map((r, i) => ({
        ...defaultRing(i),
        ...r,
        steps: Math.max(2, Math.round(r.steps ?? defaultRing(i).steps)),
        hits: Math.max(0, Math.round(r.hits ?? defaultRing(i).hits)),
        offset: Math.round(r.offset ?? 0),
        beatsPerRev: Math.max(0.25, r.beatsPerRev ?? 4),
        notes:
          Array.isArray(r.notes) && r.notes.length > 0
            ? r.notes
            : defaultRing(i).notes,
        muted: Boolean(r.muted),
      })),
    };
  }
  const count =
    typeof o.rings === 'number' ? Math.max(1, Math.min(6, o.rings)) : 3;
  const length = o.length ?? 8;
  const hits = o.hits ?? 3;
  const offset = o.offset ?? 0;
  return {
    sync: Boolean(o.sync),
    rings: Array.from({ length: count }, (_, i) => ({
      steps: Math.max(2, length - i * 2),
      hits: Math.max(0, hits - i),
      offset,
      beatsPerRev: 4,
      notes: defaultRing(i).notes,
      muted: false,
    })),
  };
}

export const normalizeRotating = normalizeRadar;

export function createRadarEngine(getState: () => RadarState): Engine {
  let angles: number[] = [];
  let lastCell: number[] = [];
  const pending: ScheduledNote[] = [];
  let beat = 0;

  const syncArrays = (n: number) => {
    while (angles.length < n) {
      angles.push(-Math.PI / 2);
      lastCell.push(-1);
    }
    if (angles.length > n) {
      angles = angles.slice(0, n);
      lastCell = lastCell.slice(0, n);
    }
  };

  const advance = (shared: SharedParams, b: number) => {
    beat = b;
    const st = getState();
    const rings = st.rings;
    syncArrays(rings.length);
    const syncRev =
      st.sync && rings[0] ? Math.max(0.25, rings[0].beatsPerRev) : null;

    for (let ri = 0; ri < rings.length; ri += 1) {
      const ring = rings[ri]!;
      const n = Math.max(2, ring.steps);
      const rev = syncRev ?? Math.max(0.25, ring.beatsPerRev);
      const turns = b / rev;
      const ang = -Math.PI / 2 + turns * Math.PI * 2;
      angles[ri] = ang;

      const phase = ((turns % 1) + 1) % 1;
      const cell = Math.floor(phase * n) % n;
      if (cell === lastCell[ri]) continue;

      const pattern = euclid(n, ring.hits, ring.offset);
      const hi = hitIndex(pattern, cell);
      lastCell[ri] = cell;

      if (ring.muted || hi < 0) continue;
      const notes = ring.notes.length > 0 ? ring.notes : [0];
      const deg = notes[hi % notes.length]!;
      pending.push({
        note: degreeToMidi(deg, shared.rootNote, shared.octave, shared.scaleId),
        velocity: shared.velocity * (1 - ri * 0.08),
        durationBeats: shared.gate * 0.25,
      });
    }
  };

  return {
    id: 'radar',
    name: 'Radar',
    reset() {
      angles = [];
      lastCell = [];
      pending.length = 0;
      beat = 0;
    },
    step(_dt, shared, b = beat) {
      advance(shared, b);
      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const rings = st.rings;
      syncArrays(rings.length);
      const cx = 0.5;
      const cy = 0.5;
      const maxR = 0.42;
      const ringW = maxR / (rings.length + 0.5);

      for (let ri = 0; ri < rings.length; ri += 1) {
        const ring = rings[ri]!;
        const n = Math.max(2, ring.steps);
        const rOuter = maxR - ri * ringW;
        const rInner = rOuter - ringW * 0.75;
        const pattern = euclid(n, ring.hits, ring.offset);
        const slice = (Math.PI * 2) / n;
        const cur = lastCell[ri] ?? -1;

        for (let i = 0; i < n; i += 1) {
          const a0 = -Math.PI / 2 + i * slice + 0.015;
          const a1 = -Math.PI / 2 + (i + 1) * slice - 0.015;
          const on = pattern[i]!;
          const active = cur === i && on && !ring.muted;
          scene.arcs.push({
            cx,
            cy,
            rInner,
            rOuter,
            a0,
            a1,
            color: ring.muted
              ? MUTED
              : active
                ? AMBER
                : on
                  ? TEAL
                  : MUTED,
          });
        }

        const pa = angles[ri] ?? -Math.PI / 2;
        scene.segments.push({
          x0: cx + Math.cos(pa) * (rInner - 0.008),
          y0: cy + Math.sin(pa) * (rInner - 0.008),
          x1: cx + Math.cos(pa) * (rOuter + 0.025),
          y1: cy + Math.sin(pa) * (rOuter + 0.025),
          thickness: 0.012,
          color: ring.muted ? MUTED : AMBER,
        });
      }
      scene.circles.push({ x: cx, y: cy, r: 0.025, color: DIM });
      return scene;
    },
  };
}

export const createRotatingEngine = createRadarEngine;
