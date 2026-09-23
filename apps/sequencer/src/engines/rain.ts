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

export interface RainState {
  density: number;
  fallSpeed: number;
  lanes: number;
  wind: number;
  gravity: number;
  splashChance: number;
  chordSpread: number;
}

export function defaultRain(): RainState {
  return {
    density: 0.35,
    fallSpeed: 1,
    lanes: 8,
    wind: 0,
    gravity: 0.4,
    splashChance: 1,
    chordSpread: 0,
  };
}

export function normalizeRain(raw: unknown): RainState {
  const d = defaultRain();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<RainState>;
  return {
    density: Math.min(1, Math.max(0.02, o.density ?? d.density)),
    fallSpeed: Math.min(3, Math.max(0.2, o.fallSpeed ?? d.fallSpeed)),
    lanes: Math.max(2, Math.min(24, Math.round(o.lanes ?? d.lanes))),
    wind: Math.min(1, Math.max(-1, o.wind ?? d.wind)),
    gravity: Math.min(2, Math.max(0, o.gravity ?? d.gravity)),
    splashChance: Math.min(1, Math.max(0, o.splashChance ?? d.splashChance)),
    chordSpread: Math.max(0, Math.min(6, Math.round(o.chordSpread ?? d.chordSpread))),
  };
}


interface Drop {
  lane: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
}

interface Splash {
  lane: number;
  x: number;
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

export function createRainEngine(getState: () => RainState): Engine {
  let drops: Drop[] = [];
  let splashes: Splash[] = [];
  const pending: ScheduledNote[] = [];
  let spawnAcc = 0;
  let sharedSnap: SharedParams | null = null;
  let groundFlash = 0;

  return {
    id: 'rain',
    name: 'Rain',
    reset() {
      drops = [];
      splashes = [];
      pending.length = 0;
      spawnAcc = 0;
      groundFlash = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      const st = getState();
      groundFlash = Math.max(0, groundFlash - dt * 2.5);
      spawnAcc += dt * st.density * 4;
      const lanes = Math.max(1, st.lanes);
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const lane = Math.floor(Math.random() * lanes);
        drops.push({
          lane,
          x: (lane + 0.5) / lanes,
          y: 0,
          vy: (0.45 + Math.random() * 0.5) * st.fallSpeed,
          vx: st.wind * (0.6 + Math.random() * 0.4) * 0.15,
        });
      }
      const next: Drop[] = [];
      for (const d of drops) {
        d.vy += st.gravity * dt * st.fallSpeed;
        d.y += d.vy * dt;
        d.x += d.vx * dt;
        if (d.x < 0) d.x = 0;
        if (d.x > 1) d.x = 1;
        if (d.y >= 1) {
          if (Math.random() > st.splashChance) continue;
          splashes.push({ lane: d.lane, x: d.x, life: 1 });
          groundFlash = 1;
          if (sharedSnap) {
            const degs = [d.lane];
            const spread = Math.max(0, Math.round(st.chordSpread));
            for (let k = 1; k <= spread; k += 1) {
              degs.push(d.lane + k * 2);
            }
            for (const deg of degs) {
              pending.push({
                note: degreeToMidi(
                  deg,
                  sharedSnap.rootNote,
                  sharedSnap.octave,
                  sharedSnap.scaleId,
                ),
                velocity: sharedSnap.velocity * (0.7 + Math.random() * 0.3),
                durationBeats: sharedSnap.gate * 0.2,
              });
            }
          }
        } else {
          next.push(d);
        }
      }
      drops = next;
      splashes = splashes
        .map((s) => ({ ...s, life: s.life - dt * 2.6 }))
        .filter((s) => s.life > 0);
      if (pending.length === 0) return [];
      return pending.splice(0, pending.length);
    },
    onTick(): ScheduledNote[] {
      return [];
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const lanes = Math.max(1, st.lanes);
      for (let i = 0; i <= lanes; i += 1) {
        const x = i / lanes;
        scene.segments.push({
          x0: x,
          y0: 0,
          x1: x,
          y1: 1,
          thickness: 0.004,
          color: DIM,
        });
      }

      const g = groundFlash;
      scene.segments.push({
        x0: 0,
        y0: 0.97,
        x1: 1,
        y1: 0.97,
        thickness: 0.012 + g * 0.02,
        color: g > 0.05 ? fadeAmber(0.4 + g * 0.6) : TEAL,
      });

      for (const s of splashes) {
        const t = s.life;
        const spread = 0.02 + (1 - t) * 0.06;
        scene.particles.push({
          x: s.x,
          y: 0.95,
          r: 0.035 + (1 - t) * 0.05,
          color: fadeAmber(t * 0.9),
          glow: 2.2,
        });
        scene.particles.push({
          x: s.x,
          y: 0.95,
          r: 0.018 + (1 - t) * 0.025,
          color: fadeTeal(t),
          glow: 1.6,
        });
        scene.segments.push({
          x0: s.x - spread,
          y0: 0.95,
          x1: s.x + spread,
          y1: 0.95,
          thickness: 0.025,
          color: fadeAmber(t),
        });
        scene.segments.push({
          x0: s.x,
          y0: 0.55,
          x1: s.x,
          y1: 0.97,
          thickness: 0.015,
          color: fadeTeal(t * 0.55),
        });
      }

      for (const d of drops) {
        scene.segments.push({
          x0: d.x - d.vx * 0.02,
          y0: d.y - 0.04,
          x1: d.x,
          y1: d.y,
          thickness: 0.02,
          color: AMBER,
        });
      }
      return scene;
    },
  };
}
