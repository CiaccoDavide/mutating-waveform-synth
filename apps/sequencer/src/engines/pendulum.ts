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

export interface PendulumState {
  count: number;
  lengthSpread: number;
  damping: number;
  chordOnSync: boolean;
  gravity: number;
}

export function defaultPendulum(): PendulumState {
  return {
    count: 4,
    lengthSpread: 0.35,
    damping: 0.08,
    chordOnSync: true,
    gravity: 9.5,
  };
}

export function normalizePendulum(raw: unknown): PendulumState {
  const d = defaultPendulum();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<PendulumState>;
  return {
    count: Math.max(1, Math.min(10, Math.round(o.count ?? d.count))),
    lengthSpread: Math.min(1, Math.max(0, o.lengthSpread ?? d.lengthSpread)),
    damping: Math.min(0.5, Math.max(0, o.damping ?? d.damping)),
    chordOnSync: Boolean(o.chordOnSync ?? d.chordOnSync),
    gravity: Math.min(20, Math.max(1, o.gravity ?? d.gravity)),
  };
}

interface Pend {
  angle: number;
  vel: number;
  len: number;
  deg: number;
  wasDown: boolean;
}

export function createPendulumEngine(getState: () => PendulumState): Engine {
  let pends: Pend[] = [];
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;
  let flash = 0;

  const ensure = () => {
    const st = getState();
    if (pends.length === st.count) return;
    pends = Array.from({ length: st.count }, (_, i) => ({
      angle: (Math.PI / 3) * (i % 2 === 0 ? 1 : -1) * (0.6 + i * 0.08),
      vel: 0,
      len: 0.28 + (i / Math.max(1, st.count)) * st.lengthSpread * 0.35,
      deg: i * 2,
      wasDown: false,
    }));
  };

  return {
    id: 'pendulum',
    name: 'Pendulum',
    reset() {
      pends = [];
      pending.length = 0;
      flash = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      ensure();
      const st = getState();
      flash = Math.max(0, flash - dt * 2.2);
      const g = Math.max(1, st.gravity);
      const downs: number[] = [];

      for (let i = 0; i < pends.length; i += 1) {
        const p = pends[i]!;
        // simple pendulum: θ'' = -g/L sin θ
        const acc = (-g / Math.max(0.12, p.len * 4)) * Math.sin(p.angle);
        p.vel += acc * dt;
        p.vel *= 1 - st.damping * dt;
        p.angle += p.vel * dt;

        const down = Math.abs(p.angle) < 0.12 && Math.abs(p.vel) > 0.4;
        if (down && !p.wasDown && sharedSnap) {
          downs.push(i);
          pending.push({
            note: degreeToMidi(
              p.deg,
              sharedSnap.rootNote,
              sharedSnap.octave,
              sharedSnap.scaleId,
            ),
            velocity: sharedSnap.velocity,
            durationBeats: sharedSnap.gate * 0.2,
          });
          flash = 1;
        }
        p.wasDown = down;
      }

      if (st.chordOnSync && downs.length >= 2 && sharedSnap) {
        pending.push({
          note: degreeToMidi(
            downs.reduce((s, i) => s + (pends[i]?.deg ?? 0), 0),
            sharedSnap.rootNote,
            sharedSnap.octave,
            sharedSnap.scaleId,
          ),
          velocity: sharedSnap.velocity * 0.8,
          durationBeats: sharedSnap.gate * 0.18,
        });
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
      const n = Math.max(1, pends.length);
      for (let i = 0; i < n; i += 1) {
        const p = pends[i]!;
        const ax = 0.15 + ((i + 0.5) / n) * 0.7;
        const ay = 0.12;
        const bx = ax + Math.sin(p.angle) * p.len;
        const by = ay + Math.cos(p.angle) * p.len * 1.4;
        scene.segments.push({
          x0: ax,
          y0: ay,
          x1: bx,
          y1: by,
          thickness: 0.01,
          color: DIM,
        });
        scene.circles.push({ x: ax, y: ay, r: 0.012, color: DIM });
        scene.particles.push({
          x: bx,
          y: by,
          r: 0.032,
          color: Math.abs(p.angle) < 0.15 ? AMBER : TEAL,
          glow: 2.4,
        });
      }
      return scene;
    },
  };
}
