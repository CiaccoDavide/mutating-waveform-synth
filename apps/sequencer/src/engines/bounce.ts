import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Rgba, Scene } from '../viz/types';
import {
  AMBER,
  DIM,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

export type BouncePitchAxis = 'x' | 'y' | 'both';

export interface BounceState {
  count: number;
  speed: number;
  gravity: number;
  elasticity: number;
  radius: number;
  pitchAxis: BouncePitchAxis;
  chaos: number;
  /** Raises scene fx.trail while bouncing */
  trailBoost: number;
  /** Extra degree when ≥2 balls hit same frame */
  chordOnMulti: boolean;
}

export function defaultBounce(): BounceState {
  return {
    count: 4,
    speed: 1,
    gravity: 0.35,
    elasticity: 0.92,
    radius: 0.035,
    pitchAxis: 'both',
    chaos: 0.15,
    trailBoost: 0.15,
    chordOnMulti: true,
  };
}

export function normalizeBounce(raw: unknown): BounceState {
  const d = defaultBounce();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<BounceState>;
  const axis = o.pitchAxis;
  return {
    count: Math.max(1, Math.min(16, Math.round(o.count ?? d.count))),
    speed: Math.min(3, Math.max(0.1, o.speed ?? d.speed)),
    gravity: Math.min(2, Math.max(0, o.gravity ?? d.gravity)),
    elasticity: Math.min(1.2, Math.max(0.2, o.elasticity ?? d.elasticity)),
    radius: Math.min(0.1, Math.max(0.015, o.radius ?? d.radius)),
    pitchAxis: axis === 'x' || axis === 'y' || axis === 'both' ? axis : d.pitchAxis,
    chaos: Math.min(1, Math.max(0, o.chaos ?? d.chaos)),
    trailBoost: Math.min(0.5, Math.max(0, o.trailBoost ?? d.trailBoost)),
    chordOnMulti: Boolean(o.chordOnMulti ?? d.chordOnMulti),
  };
}


interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flash: number;
}

interface Impact {
  x: number;
  y: number;
  wall: 'h' | 'v' | 'c';
  life: number;
}

function fadeAmber(t: number): Rgba {
  const a = Math.max(0, Math.min(1, t));
  return [0.91, 0.72, 0.43, a];
}

function fadeTeal(t: number): Rgba {
  const a = Math.max(0, Math.min(1, t));
  return [0.37, 0.92, 0.83, a];
}

function degFromPos(
  b: Ball,
  axis: BouncePitchAxis,
): number {
  if (axis === 'x') return Math.floor(b.x * 12);
  if (axis === 'y') return Math.floor((1 - b.y) * 12);
  return Math.floor(((b.x + (1 - b.y)) / 2) * 12);
}

export function createBounceEngine(getState: () => BounceState): Engine {
  let balls: Ball[] = [];
  let impacts: Impact[] = [];
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;

  const ensure = () => {
    const st = getState();
    if (balls.length === st.count) return;
    balls = Array.from({ length: st.count }, (_, i) => {
      const ang = (i / Math.max(1, st.count)) * Math.PI * 2;
      return {
        x: 0.5 + Math.cos(ang) * 0.25,
        y: 0.5 + Math.sin(ang) * 0.2,
        vx: Math.cos(ang + 1) * 0.35,
        vy: Math.sin(ang + 1) * 0.4,
        flash: 0,
      };
    });
  };

  return {
    id: 'bounce',
    name: 'Bouncing spheres',
    reset() {
      balls = [];
      impacts = [];
      pending.length = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      ensure();
      const st = getState();
      const speed = Math.max(0.15, st.speed);
      const g = st.gravity;
      const el = Math.max(0.2, Math.min(1.2, st.elasticity));
      const margin = 0.05 + st.radius;
      let hitsThisFrame = 0;
      for (const b of balls) {
        b.flash = Math.max(0, b.flash - dt * 3.5);
        b.vy += g * dt;
        b.x += b.vx * speed * dt;
        b.y += b.vy * speed * dt;
        let hit = false;
        let wall: Impact['wall'] = 'c';
        if (b.x < margin || b.x > 1 - margin) {
          b.vx *= -el;
          b.x = Math.min(1 - margin, Math.max(margin, b.x));
          hit = true;
          wall = 'v';
        }
        if (b.y < margin || b.y > 1 - margin) {
          b.vy *= -el;
          b.y = Math.min(1 - margin, Math.max(margin, b.y));
          hit = true;
          wall = wall === 'v' ? 'c' : 'h';
        }
        if (hit && sharedSnap) {
          hitsThisFrame += 1;
          if (st.chaos > 0) {
            b.vx += (Math.random() - 0.5) * st.chaos;
            b.vy += (Math.random() - 0.5) * st.chaos;
          }
          b.flash = 1;
          impacts.push({ x: b.x, y: b.y, wall, life: 1 });
          const deg = degFromPos(b, st.pitchAxis);
          pending.push({
            note: degreeToMidi(
              deg,
              sharedSnap.rootNote,
              sharedSnap.octave,
              sharedSnap.scaleId,
            ),
            velocity: sharedSnap.velocity,
            durationBeats: sharedSnap.gate * 0.2,
          });
          if (st.chordOnMulti && hitsThisFrame >= 2) {
            pending.push({
              note: degreeToMidi(
                deg + 4,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity * 0.75,
              durationBeats: sharedSnap.gate * 0.18,
            });
          }
        }
      }
      impacts = impacts
        .map((p) => ({ ...p, life: p.life - dt * 2.8 }))
        .filter((p) => p.life > 0);
      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      scene.fx.trail = Math.min(0.95, scene.fx.trail + st.trailBoost);
      const wallFlash = Math.max(0, ...impacts.map((p) => p.life), 0);
      scene.fx.flash = wallFlash * 0.5;
      const wallCol: Rgba =
        wallFlash > 0.05 ? fadeTeal(0.35 + wallFlash * 0.65) : DIM;
      const r = st.radius;

      scene.segments.push({
        x0: 0.04,
        y0: 0.06,
        x1: 0.96,
        y1: 0.06,
        thickness: 0.008 + wallFlash * 0.01,
        color: wallCol,
      });
      scene.segments.push({
        x0: 0.04,
        y0: 0.94,
        x1: 0.96,
        y1: 0.94,
        thickness: 0.008 + wallFlash * 0.01,
        color: wallCol,
      });
      scene.segments.push({
        x0: 0.04,
        y0: 0.06,
        x1: 0.04,
        y1: 0.94,
        thickness: 0.008 + wallFlash * 0.01,
        color: wallCol,
      });
      scene.segments.push({
        x0: 0.96,
        y0: 0.06,
        x1: 0.96,
        y1: 0.94,
        thickness: 0.008 + wallFlash * 0.01,
        color: wallCol,
      });

      for (const p of impacts) {
        const t = p.life;
        scene.circles.push({
          x: p.x,
          y: p.y,
          r: r + 0.01 + (1 - t) * 0.08,
          color: fadeAmber(t * 0.85),
        });
        if (p.wall === 'h' || p.wall === 'c') {
          scene.segments.push({
            x0: Math.max(0.04, p.x - 0.08),
            y0: p.y,
            x1: Math.min(0.96, p.x + 0.08),
            y1: p.y,
            thickness: 0.02,
            color: fadeAmber(t),
          });
        }
        if (p.wall === 'v' || p.wall === 'c') {
          scene.segments.push({
            x0: p.x,
            y0: Math.max(0.06, p.y - 0.08),
            x1: p.x,
            y1: Math.min(0.94, p.y + 0.08),
            thickness: 0.02,
            color: fadeAmber(t),
          });
        }
      }

      for (const b of balls) {
        const f = b.flash;
        scene.circles.push({
          x: b.x,
          y: b.y,
          r: r + f * 0.04,
          color: f > 0.05 ? fadeAmber(0.5 + f * 0.5) : TEAL,
        });
        scene.circles.push({
          x: b.x,
          y: b.y,
          r: r * 0.35 + f * 0.015,
          color: f > 0.05 ? fadeTeal(f) : AMBER,
        });
      }
      return scene;
    },
  };
}
