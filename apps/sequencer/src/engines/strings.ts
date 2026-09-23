import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Rgba, Scene } from '../viz/types';
import {
  AMBER,
  TEAL,
  type Engine,
  type ScheduledNote,
  type SharedParams,
} from './types';

export type DetectorMode = 'line' | 'points';

export interface StringsState {
  count: number;
  roughness: number;
  drift: number;
  mode: DetectorMode;
  scanSpeed: number;
  threshold: number;
  /** Detector point count when mode === 'points' */
  pointCount: number;
  amplitude: number;
  wavelength: number;
  harmonics: number;
}

export function defaultStrings(): StringsState {
  return {
    count: 5,
    roughness: 0.45,
    drift: 0.35,
    mode: 'line',
    scanSpeed: 0.22,
    threshold: 0.04,
    pointCount: 3,
    amplitude: 1,
    wavelength: 1,
    harmonics: 0.35,
  };
}

/** Migrate legacy tension/density ribbon presets. */
export function normalizeStrings(raw: unknown): StringsState {
  const d = defaultStrings();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<StringsState> & {
    tension?: number;
    density?: number;
    speed?: number;
  };
  if (typeof o.roughness === 'number' || typeof o.mode === 'string') {
    return {
      count: o.count ?? d.count,
      roughness: o.roughness ?? d.roughness,
      drift: o.drift ?? d.drift,
      mode: o.mode === 'points' ? 'points' : 'line',
      scanSpeed: o.scanSpeed ?? o.speed ?? d.scanSpeed,
      threshold: o.threshold ?? d.threshold,
      pointCount: o.pointCount ?? d.pointCount,
      amplitude: o.amplitude ?? d.amplitude,
      wavelength: o.wavelength ?? d.wavelength,
      harmonics: o.harmonics ?? d.harmonics,
    };
  }
  // legacy ribbon → waves
  return {
    ...d,
    count: o.count ?? d.count,
    roughness: o.tension ?? d.roughness,
    drift: o.speed ?? d.drift,
    scanSpeed: o.density ?? d.scanSpeed,
  };
}

interface Wave {
  phase: number;
  freq: number;
  amp: number;
  deg: number;
  seed: number;
}

function waveY(
  w: Wave,
  x: number,
  roughness: number,
  t: number,
  amplitude: number,
  wavelength: number,
  harmonics: number,
): number {
  const base = 0.15 + ((w.deg + 0.5) / 12) * 0.7;
  const wl = Math.max(0.25, wavelength);
  const amp = w.amp * Math.max(0.15, amplitude);
  const n1 = Math.sin((x * 8 * wl + w.phase + t * w.freq) * Math.PI * 2) * amp;
  const n2 =
    Math.sin((x * 19 * wl + w.seed + t * w.freq * 1.7) * Math.PI * 2) *
    amp *
    roughness;
  const n3 =
    Math.sin((x * 31 * wl + w.phase * 2 + t * w.freq * 2.3) * Math.PI * 2) *
    amp *
    harmonics *
    0.5;
  return Math.min(0.92, Math.max(0.08, base + n1 + n2 + n3));
}

function fadeAmber(a: number): Rgba {
  return [0.91, 0.72, 0.43, Math.max(0, Math.min(1, a))];
}

export function createStringsEngine(getState: () => StringsState): Engine {
  let waves: Wave[] = [];
  let scanX = 0;
  let points: { x: number; y: number; vy: number }[] = [];
  let prevAbove: boolean[] = [];
  let pointNear: boolean[] = [];
  const pending: ScheduledNote[] = [];
  let sharedSnap: SharedParams | null = null;
  let flashes: { x: number; y: number; life: number }[] = [];
  let time = 0;

  const ensure = () => {
    const st = getState();
    if (waves.length !== st.count) {
      waves = Array.from({ length: st.count }, (_, i) => ({
        phase: Math.random(),
        freq: 0.15 + (i % 4) * 0.07,
        amp: 0.04 + (i % 3) * 0.015,
        deg: i,
        seed: Math.random() * 10,
      }));
      prevAbove = waves.map(() => false);
      pointNear = waves.map(() => false);
    }
    if (points.length !== st.pointCount) {
      points = Array.from({ length: st.pointCount }, (_, i) => ({
        x: 0.15 + (i / Math.max(1, st.pointCount)) * 0.7,
        y: 0.3 + (i % 3) * 0.2,
        vy: 0.2 * (i % 2 === 0 ? 1 : -1),
      }));
    }
  };

  return {
    id: 'strings',
    name: 'Strings',
    reset() {
      waves = [];
      points = [];
      prevAbove = [];
      pointNear = [];
      pending.length = 0;
      flashes = [];
      scanX = 0;
      time = 0;
    },
    step(dt, shared) {
      sharedSnap = shared;
      ensure();
      const st = getState();
      time += dt * st.drift;
      const thr = Math.max(0.01, st.threshold);

      if (st.mode === 'line') {
        const prevX = scanX;
        scanX = (scanX + dt * st.scanSpeed) % 1;
        // detect wrap or samples along scan
        const x = scanX;
        for (let i = 0; i < waves.length; i += 1) {
          const w = waves[i]!;
          const y = waveY(
            w,
            x,
            st.roughness,
            time,
            st.amplitude,
            st.wavelength,
            st.harmonics,
          );
          // approximate derivative: did scan cross relative to midline of wave motion
          const y0 = waveY(
            w,
            prevX,
            st.roughness,
            time - dt * st.drift,
            st.amplitude,
            st.wavelength,
            st.harmonics,
          );
          const crossed =
            (y0 - 0.5) * (y - 0.5) < 0 || Math.abs(y - y0) > thr * 2;
          // rising-edge style: fire when scan enters a local peak band
          const peak = Math.abs(y - (0.15 + ((w.deg + 0.5) / 12) * 0.7)) < thr;
          const was = prevAbove[i]!;
          prevAbove[i] = peak;
          if (peak && !was && sharedSnap) {
            pending.push({
              note: degreeToMidi(
                w.deg,
                sharedSnap.rootNote,
                sharedSnap.octave,
                sharedSnap.scaleId,
              ),
              velocity: sharedSnap.velocity,
              durationBeats: sharedSnap.gate * 0.18,
            });
            flashes.push({ x, y, life: 1 });
          }
          void crossed;
        }
      } else {
        for (const p of points) {
          p.y += p.vy * st.scanSpeed * dt * 2;
          if (p.y < 0.1 || p.y > 0.9) {
            p.vy *= -1;
            p.y = Math.min(0.9, Math.max(0.1, p.y));
          }
          p.x = (p.x + dt * st.scanSpeed * 0.15) % 1;
        }
        for (let i = 0; i < waves.length; i += 1) {
          const w = waves[i]!;
          let near = false;
          for (const p of points) {
            const y = waveY(
              w,
              p.x,
              st.roughness,
              time,
              st.amplitude,
              st.wavelength,
              st.harmonics,
            );
            if (Math.abs(y - p.y) < thr) {
              near = true;
              if (!pointNear[i] && sharedSnap) {
                pending.push({
                  note: degreeToMidi(
                    w.deg,
                    sharedSnap.rootNote,
                    sharedSnap.octave,
                    sharedSnap.scaleId,
                  ),
                  velocity: sharedSnap.velocity,
                  durationBeats: sharedSnap.gate * 0.18,
                });
                flashes.push({ x: p.x, y, life: 1 });
              }
              break;
            }
          }
          pointNear[i] = near;
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
      const segs = 48;
      for (const w of waves) {
        for (let i = 0; i < segs; i += 1) {
          const x0 = i / segs;
          const x1 = (i + 1) / segs;
          scene.segments.push({
            x0,
            y0: waveY(
              w,
              x0,
              st.roughness,
              time,
              st.amplitude,
              st.wavelength,
              st.harmonics,
            ),
            x1,
            y1: waveY(
              w,
              x1,
              st.roughness,
              time,
              st.amplitude,
              st.wavelength,
              st.harmonics,
            ),
            thickness: 0.012,
            color: TEAL,
          });
        }
      }
      if (st.mode === 'line') {
        scene.segments.push({
          x0: scanX,
          y0: 0.05,
          x1: scanX,
          y1: 0.95,
          thickness: 0.014,
          color: AMBER,
        });
      } else {
        for (const p of points) {
          scene.circles.push({ x: p.x, y: p.y, r: 0.028, color: AMBER });
        }
      }
      for (const f of flashes) {
        scene.circles.push({
          x: f.x,
          y: f.y,
          r: 0.035 + (1 - f.life) * 0.04,
          color: fadeAmber(f.life),
        });
      }
      return scene;
    },
  };
}
