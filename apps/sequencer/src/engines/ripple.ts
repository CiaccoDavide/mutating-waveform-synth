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
  type SharedParams,
} from './types';

export interface RippleState {
  steps: number;
  pulses: number;
  rotate: number;
  nodeCount: number;
  speed: number;
}

export function defaultRipple(): RippleState {
  return { steps: 16, pulses: 5, rotate: 0, nodeCount: 8, speed: 0.55 };
}

export function normalizeRipple(raw: unknown): RippleState {
  const d = defaultRipple();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<RippleState>;
  return {
    steps: Math.max(2, Math.min(64, Math.round(o.steps ?? d.steps))),
    pulses: Math.max(0, Math.min(64, Math.round(o.pulses ?? d.pulses))),
    rotate: Math.round(o.rotate ?? d.rotate),
    nodeCount: Math.max(3, Math.min(24, Math.round(o.nodeCount ?? d.nodeCount))),
    speed: Math.min(2, Math.max(0.1, o.speed ?? d.speed)),
  };
}


interface Ring {
  r: number;
  hitNodes: Set<number>;
}

export function createRippleEngine(getState: () => RippleState): Engine {
  let tick = 0;
  let playhead = 0;
  let rings: Ring[] = [];
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;
  let flash = 0;

  return {
    id: 'ripple',
    name: 'Ripple',
    reset() {
      tick = 0;
      playhead = 0;
      rings = [];
      pending.length = 0;
      flash = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      const st = getState();
      flash = Math.max(0, flash - dt * 2);
      const nodes = Math.max(3, Math.round(st.nodeCount));
      const next: Ring[] = [];
      for (const ring of rings) {
        ring.r += dt * st.speed * 0.55;
        for (let i = 0; i < nodes; i += 1) {
          if (ring.hitNodes.has(i)) continue;
          const target = 0.12 + (i / nodes) * 0.38;
          if (ring.r >= target && sharedSnap) {
            ring.hitNodes.add(i);
            pending.push({
              note: degreeToMidi(
                i,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity * (1 - i / nodes * 0.3),
              durationBeats: sharedSnap.gate * 0.14,
            });
            flash = 1;
          }
        }
        if (ring.r < 0.55) next.push(ring);
      }
      rings = next;
      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      sharedSnap = shared;
      const st = getState();
      const n = Math.max(2, st.steps);
      const idx = tick % n;
      playhead = idx;
      tick += 1;
      const pattern = euclid(n, st.pulses, st.rotate);
      const hi = hitIndex(pattern, idx);
      if (hi < 0) return [];
      rings.push({ r: 0.02, hitNodes: new Set() });
      flash = 0.6;
      return [
        {
          note: degreeToMidi(
            hi,
            shared.rootNote,
            shared.octave,
            shared.scaleId,
          ),
          velocity: shared.velocity * 0.7,
          durationBeats: shared.gate * 0.1,
        },
      ];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      scene.fx.flash = flash;
      const n = Math.max(2, st.steps);
      const pattern = euclid(n, st.pulses, st.rotate);
      // mini pattern strip
      for (let i = 0; i < n; i += 1) {
        const x = (i + 0.5) / n;
        scene.segments.push({
          x0: x,
          y0: 0.04,
          x1: x,
          y1: 0.12,
          thickness: Math.max(0.012, 0.4 / n),
          color: playhead === i && pattern[i] ? AMBER : pattern[i] ? TEAL : MUTED,
        });
      }
      const nodes = Math.max(3, Math.round(st.nodeCount));
      const cx = 0.5;
      const cy = 0.55;
      for (let i = 0; i < nodes; i += 1) {
        const a = (i / nodes) * Math.PI * 2 - Math.PI / 2;
        const rad = 0.12 + (i / nodes) * 0.38;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        scene.circles.push({ x, y, r: 0.014, color: DIM });
        scene.particles.push({
          x,
          y,
          r: 0.02,
          color: TEAL,
          glow: 1.6,
        });
      }
      for (const ring of rings) {
        const segs = 40;
        for (let i = 0; i < segs; i += 1) {
          const a0 = (i / segs) * Math.PI * 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2;
          scene.segments.push({
            x0: cx + Math.cos(a0) * ring.r,
            y0: cy + Math.sin(a0) * ring.r,
            x1: cx + Math.cos(a1) * ring.r,
            y1: cy + Math.sin(a1) * ring.r,
            thickness: 0.01,
            color: AMBER,
          });
        }
        scene.particles.push({
          x: cx + ring.r,
          y: cy,
          r: 0.025,
          color: AMBER,
          glow: 2,
        });
      }
      return scene;
    },
  };
}
