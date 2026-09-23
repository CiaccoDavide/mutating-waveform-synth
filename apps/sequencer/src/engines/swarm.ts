import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import {
  AMBER,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

export interface SwarmState {
  count: number;
  speed: number;
  cohesion: number;
  sense: number;
  separation: number;
}

export function defaultSwarm(): SwarmState {
  return { count: 10, speed: 0.45, cohesion: 0.35, sense: 0.08, separation: 0.4 };
}

export function normalizeSwarm(raw: unknown): SwarmState {
  const d = defaultSwarm();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<SwarmState>;
  return {
    count: Math.max(2, Math.min(32, Math.round(o.count ?? d.count))),
    speed: Math.min(1.5, Math.max(0.05, o.speed ?? d.speed)),
    cohesion: Math.min(1, Math.max(0, o.cohesion ?? d.cohesion)),
    sense: Math.min(0.3, Math.max(0.02, o.sense ?? d.sense)),
    separation: Math.min(1, Math.max(0, o.separation ?? d.separation)),
  };
}

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
}

export function createSwarmEngine(getState: () => SwarmState): Engine {
  let boids: Boid[] = [];
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;
  let flash = 0;
  let cool: Set<string> = new Set();

  const ensure = () => {
    const st = getState();
    if (boids.length === st.count) return;
    boids = Array.from({ length: st.count }, (_, i) => {
      const a = (i / Math.max(1, st.count)) * Math.PI * 2;
      return {
        x: 0.5 + Math.cos(a) * 0.25,
        y: 0.5 + Math.sin(a) * 0.25,
        vx: Math.cos(a + 1) * 0.2,
        vy: Math.sin(a + 1) * 0.2,
        deg: i % 8,
      };
    });
  };

  return {
    id: 'swarm',
    name: 'Swarm',
    reset() {
      boids = [];
      pending.length = 0;
      flash = 0;
      cool.clear();
    },
    step(dt, shared) {
      sharedSnap = shared;
      ensure();
      const st = getState();
      flash = Math.max(0, flash - dt * 2);
      cool.clear();
      const cx =
        boids.reduce((s, b) => s + b.x, 0) / Math.max(1, boids.length);
      const cy =
        boids.reduce((s, b) => s + b.y, 0) / Math.max(1, boids.length);

      for (const b of boids) {
        b.vx += (cx - b.x) * st.cohesion * dt;
        b.vy += (cy - b.y) * st.cohesion * dt;
        for (const o of boids) {
          if (o === b) continue;
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist < st.sense * 1.5) {
            b.vx += (dx / dist) * st.separation * dt * 0.8;
            b.vy += (dy / dist) * st.separation * dt * 0.8;
          }
        }
        // mild wander
        b.vx += (Math.random() - 0.5) * 0.4 * dt;
        b.vy += (Math.random() - 0.5) * 0.4 * dt;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const maxSp = 0.6 * st.speed;
        if (sp > maxSp) {
          b.vx = (b.vx / sp) * maxSp;
          b.vy = (b.vy / sp) * maxSp;
        }
        b.x += b.vx * st.speed * dt * 2;
        b.y += b.vy * st.speed * dt * 2;
        if (b.x < 0.05 || b.x > 0.95) b.vx *= -1;
        if (b.y < 0.05 || b.y > 0.95) b.vy *= -1;
        b.x = Math.min(0.95, Math.max(0.05, b.x));
        b.y = Math.min(0.95, Math.max(0.05, b.y));
      }

      const sense = Math.max(0.02, st.sense);
      for (let i = 0; i < boids.length; i += 1) {
        for (let j = i + 1; j < boids.length; j += 1) {
          const a = boids[i]!;
          const b = boids[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < sense && sharedSnap) {
            const key = `${i}-${j}`;
            if (cool.has(key)) continue;
            cool.add(key);
            pending.push({
              note: degreeToMidi(
                a.deg + b.deg,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity * (0.7 + (1 - d / sense) * 0.3),
              durationBeats: sharedSnap.gate * 0.15,
            });
            flash = 1;
          }
        }
      }

      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      ensure();
      scene.fx.flash = flash;
      for (const b of boids) {
        scene.particles.push({
          x: b.x,
          y: b.y,
          r: 0.028,
          color: TEAL,
          glow: 2.2,
        });
        scene.segments.push({
          x0: b.x,
          y0: b.y,
          x1: b.x + b.vx * 0.15,
          y1: b.y + b.vy * 0.15,
          thickness: 0.008,
          color: AMBER,
        });
      }
      return scene;
    },
  };
}
