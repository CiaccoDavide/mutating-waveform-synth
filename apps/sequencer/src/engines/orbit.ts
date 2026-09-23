import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Rgba, Scene } from '../viz/types';
import {
  AMBER,
  DIM,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

export interface OrbitState {
  count: number;
  baseSpeed: number;
  spokeCount: number;
  alignChance: number;
  radiusSpread: number;
}

export function defaultOrbit(): OrbitState {
  return {
    count: 4,
    baseSpeed: 0.35,
    spokeCount: 6,
    alignChance: 0.35,
    radiusSpread: 0.32,
  };
}

export function normalizeOrbit(raw: unknown): OrbitState {
  const d = defaultOrbit();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<OrbitState>;
  return {
    count: Math.max(1, Math.min(12, Math.round(o.count ?? d.count))),
    baseSpeed: Math.min(2, Math.max(0.05, o.baseSpeed ?? d.baseSpeed)),
    spokeCount: Math.max(2, Math.min(24, Math.round(o.spokeCount ?? d.spokeCount))),
    alignChance: Math.min(1, Math.max(0, o.alignChance ?? d.alignChance)),
    radiusSpread: Math.min(0.45, Math.max(0.08, o.radiusSpread ?? d.radiusSpread)),
  };
}

interface Body {
  angle: number;
  radius: number;
  speed: number;
  deg: number;
  lastSpoke: number;
}

function fadeAmber(a: number): Rgba {
  return [0.91, 0.72, 0.43, Math.max(0, Math.min(1, a))];
}

export function createOrbitEngine(getState: () => OrbitState): Engine {
  let bodies: Body[] = [];
  const pending: ScheduledNote[] = [];
  let flashes: { x: number; y: number; life: number }[] = [];
  let sharedSnap: SharedParams | null = null;

  const ensure = () => {
    const st = getState();
    if (bodies.length === st.count) return;
    bodies = Array.from({ length: st.count }, (_, i) => ({
      angle: (i / Math.max(1, st.count)) * Math.PI * 2,
      radius: 0.12 + (i / Math.max(1, st.count)) * st.radiusSpread,
      speed: 0.4 + (i % 3) * 0.25,
      deg: i % 8,
      lastSpoke: -1,
    }));
  };

  return {
    id: 'orbit',
    name: 'Orbit',
    reset() {
      bodies = [];
      pending.length = 0;
      flashes = [];
    },
    step(dt, shared) {
      sharedSnap = shared;
      ensure();
      const st = getState();
      const spokes = Math.max(1, Math.round(st.spokeCount));
      const spokeStep = (Math.PI * 2) / spokes;
      for (const b of bodies) {
        b.angle += b.speed * st.baseSpeed * dt * Math.PI * 2;
        const norm = ((b.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const spoke = Math.floor(norm / spokeStep);
        if (spoke !== b.lastSpoke) {
          b.lastSpoke = spoke;
          if (sharedSnap) {
            const x = 0.5 + Math.cos(b.angle) * b.radius;
            const y = 0.5 + Math.sin(b.angle) * b.radius;
            pending.push({
              note: degreeToMidi(
                b.deg + spoke,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity,
              durationBeats: sharedSnap.gate * 0.18,
            });
            flashes.push({ x, y, life: 1 });
          }
        }
      }
      // conjunctions
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i]!;
          const b = bodies[j]!;
          let d = Math.abs(a.angle - b.angle) % (Math.PI * 2);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < 0.08 && Math.random() < st.alignChance * dt * 8 && sharedSnap) {
            pending.push({
              note: degreeToMidi(
                a.deg + b.deg,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity * 0.85,
              durationBeats: sharedSnap.gate * 0.15,
            });
            flashes.push({
              x: 0.5 + Math.cos(a.angle) * ((a.radius + b.radius) / 2),
              y: 0.5 + Math.sin(a.angle) * ((a.radius + b.radius) / 2),
              life: 1,
            });
          }
        }
      }
      flashes = flashes
        .map((f) => ({ ...f, life: f.life - dt * 2.5 }))
        .filter((f) => f.life > 0);
      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      ensure();
      const spokes = Math.max(1, Math.round(st.spokeCount));
      for (let i = 0; i < spokes; i += 1) {
        const a = (i / spokes) * Math.PI * 2;
        scene.segments.push({
          x0: 0.5,
          y0: 0.5,
          x1: 0.5 + Math.cos(a) * 0.45,
          y1: 0.5 + Math.sin(a) * 0.45,
          thickness: 0.005,
          color: DIM,
          dashed: true,
          dashLen: 0.02,
          gapLen: 0.015,
        });
      }
      for (const b of bodies) {
        // orbit ring (approx with segments)
        const segs = 32;
        for (let i = 0; i < segs; i += 1) {
          const a0 = (i / segs) * Math.PI * 2;
          const a1 = ((i + 1) / segs) * Math.PI * 2;
          scene.segments.push({
            x0: 0.5 + Math.cos(a0) * b.radius,
            y0: 0.5 + Math.sin(a0) * b.radius,
            x1: 0.5 + Math.cos(a1) * b.radius,
            y1: 0.5 + Math.sin(a1) * b.radius,
            thickness: 0.005,
            color: MUTED,
          });
        }
        scene.circles.push({
          x: 0.5 + Math.cos(b.angle) * b.radius,
          y: 0.5 + Math.sin(b.angle) * b.radius,
          r: 0.03,
          color: TEAL,
        });
      }
      scene.circles.push({ x: 0.5, y: 0.5, r: 0.02, color: AMBER });
      for (const f of flashes) {
        scene.particles.push({
          x: f.x,
          y: f.y,
          r: 0.035 + (1 - f.life) * 0.04,
          color: fadeAmber(f.life),
          glow: 2.4,
        });
      }
      return scene;
    },
  };
}
