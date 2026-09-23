import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import {
  AMBER,
  DIM,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

export interface LissajousState {
  ratioA: number;
  ratioB: number;
  phase: number;
  speed: number;
  lattice: number;
}

export function defaultLissajous(): LissajousState {
  return { ratioA: 3, ratioB: 2, phase: 0.25, speed: 0.35, lattice: 4 };
}

export function normalizeLissajous(raw: unknown): LissajousState {
  const d = defaultLissajous();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<LissajousState>;
  return {
    ratioA: Math.max(1, Math.min(12, Math.round(o.ratioA ?? d.ratioA))),
    ratioB: Math.max(1, Math.min(12, Math.round(o.ratioB ?? d.ratioB))),
    phase: Math.min(1, Math.max(0, o.phase ?? d.phase)),
    speed: Math.min(2, Math.max(0.05, o.speed ?? d.speed)),
    lattice: Math.max(2, Math.min(12, Math.round(o.lattice ?? d.lattice))),
  };
}


export function createLissajousEngine(
  getState: () => LissajousState,
): Engine {
  let t = 0;
  let px = 0.5;
  let py = 0.5;
  let lastQuad = -1;
  let lastCell = -1;
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;
  let flash = 0;
  const trail: { x: number; y: number }[] = [];

  return {
    id: 'lissajous',
    name: 'Lissajous',
    reset() {
      t = 0;
      px = 0.5;
      py = 0.5;
      lastQuad = -1;
      lastCell = -1;
      pending.length = 0;
      flash = 0;
      trail.length = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      const st = getState();
      flash = Math.max(0, flash - dt * 2);
      t += dt * st.speed * Math.PI * 2;
      const a = Math.max(1, st.ratioA);
      const b = Math.max(1, st.ratioB);
      px = 0.5 + Math.sin(a * t) * 0.38;
      py = 0.5 + Math.sin(b * t + st.phase * Math.PI) * 0.38;
      trail.push({ x: px, y: py });
      if (trail.length > 48) trail.shift();

      // axis crossings → quadrant change
      const qx = px > 0.5 ? 1 : 0;
      const qy = py > 0.5 ? 1 : 0;
      const quad = qx + qy * 2;
      if (quad !== lastQuad && sharedSnap && lastQuad >= 0) {
        pending.push({
          note: degreeToMidi(
            quad * 2,
            sharedSnap.rootNote,
            sharedSnap.octave,
            sharedSnap.scaleId,
          ),
          velocity: sharedSnap.velocity,
          durationBeats: sharedSnap.gate * 0.16,
        });
        flash = 0.8;
      }
      lastQuad = quad;

      const lat = Math.max(2, Math.round(st.lattice));
      const cx = Math.min(lat - 1, Math.floor(px * lat));
      const cy = Math.min(lat - 1, Math.floor(py * lat));
      const cell = cx + cy * lat;
      if (cell !== lastCell && sharedSnap && lastCell >= 0) {
        pending.push({
          note: degreeToMidi(
            (cx + cy) % 12,
            sharedSnap.rootNote,
            sharedSnap.octave,
            sharedSnap.scaleId,
          ),
          velocity: sharedSnap.velocity * 0.75,
          durationBeats: sharedSnap.gate * 0.12,
        });
        flash = Math.max(flash, 0.5);
      }
      lastCell = cell;

      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      scene.fx.flash = flash;
      scene.fx.trail = Math.max(scene.fx.trail, 0.85);
      const lat = Math.max(2, Math.round(st.lattice));
      for (let i = 0; i <= lat; i += 1) {
        const u = i / lat;
        scene.segments.push({
          x0: u,
          y0: 0.08,
          x1: u,
          y1: 0.92,
          thickness: 0.003,
          color: DIM,
          dashed: true,
          dashLen: 0.018,
          gapLen: 0.014,
        });
        scene.segments.push({
          x0: 0.08,
          y0: u,
          x1: 0.92,
          y1: u,
          thickness: 0.003,
          color: DIM,
          dashed: true,
          dashLen: 0.018,
          gapLen: 0.014,
        });
      }
      for (let i = 1; i < trail.length; i += 1) {
        const a = trail[i - 1]!;
        const b = trail[i]!;
        scene.segments.push({
          x0: a.x,
          y0: a.y,
          x1: b.x,
          y1: b.y,
          thickness: 0.008,
          color: TEAL,
        });
      }
      scene.particles.push({
        x: px,
        y: py,
        r: 0.04,
        color: AMBER,
        glow: 2.8,
      });
      return scene;
    },
  };
}
