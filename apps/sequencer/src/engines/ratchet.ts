import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { euclid, hitIndex, isGridSixteenth } from './euclid';
import {
  AMBER,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface RatchetState {
  steps: number;
  pulses: number;
  rotate: number;
  /** Extra note-ons after each pulse (0 = single hit) */
  repeats: number;
  /** Velocity fade across repeats 0–1 */
  repeatRamp: number;
  /** Spacing between repeats as fraction of one 16th (ms derived in App via delayMs) */
  repeatSpacingMs: number;
  notes: number[];
  /** Tighten spacing across the burst (0–1) */
  accel: number;
  /** Extra velocity decay factor per repeat */
  velDecay: number;
}

export function defaultRatchet(): RatchetState {
  return {
    steps: 8,
    pulses: 3,
    rotate: 0,
    repeats: 3,
    repeatRamp: 0.55,
    repeatSpacingMs: 35,
    notes: [0, 3, 5],
    accel: 0.25,
    velDecay: 0.15,
  };
}

export function normalizeRatchet(raw: unknown): RatchetState {
  const d = defaultRatchet();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<RatchetState>;
  const notes = Array.isArray(o.notes) && o.notes.length ? o.notes.map(Number).filter(Number.isFinite) : d.notes;
  return {
    steps: Math.max(2, Math.min(64, Math.round(o.steps ?? d.steps))),
    pulses: Math.max(0, Math.min(64, Math.round(o.pulses ?? d.pulses))),
    rotate: Math.round(o.rotate ?? d.rotate),
    repeats: Math.max(0, Math.min(12, Math.round(o.repeats ?? d.repeats))),
    repeatRamp: Math.min(1, Math.max(0, o.repeatRamp ?? d.repeatRamp)),
    repeatSpacingMs: Math.max(5, Math.min(200, o.repeatSpacingMs ?? d.repeatSpacingMs)),
    notes: notes.length ? notes : [0],
    accel: Math.min(1, Math.max(0, o.accel ?? d.accel)),
    velDecay: Math.min(0.8, Math.max(0, o.velDecay ?? d.velDecay)),
  };
}


export function createRatchetEngine(getState: () => RatchetState): Engine {
  let step = 0;
  let playhead = 0;
  let burstAt = -1;

  return {
    id: 'ratchet',
    name: 'Ratchet',
    reset() {
      step = 0;
      playhead = 0;
      burstAt = -1;
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const n = Math.max(2, st.steps);
      const idx = step % n;
      playhead = idx;
      step += 1;
      const pattern = euclid(n, st.pulses, st.rotate);
      const hi = hitIndex(pattern, idx);
      if (hi < 0) return [];
      burstAt = idx;
      const notes = st.notes.length > 0 ? st.notes : [0];
      const deg = notes[hi % notes.length]!;
      const midi = degreeToMidi(
        deg,
        shared.rootNote,
        shared.octave,
        shared.scaleId,
      );
      const reps = Math.max(0, Math.round(st.repeats));
      const out: ScheduledNote[] = [];
      const total = reps + 1;
      let delayAcc = 0;
      for (let r = 0; r < total; r += 1) {
        const fade =
          (1 - (r / Math.max(1, total - 1)) * st.repeatRamp) *
          Math.max(0.1, 1 - r * st.velDecay);
        out.push({
          note: midi,
          velocity: shared.velocity * Math.max(0.12, fade),
          durationBeats: shared.gate * 0.12,
          delayMs: delayAcc,
        });
        const tighten = 1 - st.accel * (r / Math.max(1, total));
        delayAcc += Math.max(8, st.repeatSpacingMs * tighten);
      }
      return out;
    },
    getScene(): Scene {
      const scene = emptyScene();
      const st = getState();
      const n = Math.max(2, st.steps);
      const pattern = euclid(n, st.pulses, st.rotate);
      const reps = Math.max(0, Math.round(st.repeats));
      for (let i = 0; i < n; i += 1) {
        const x0 = i / n + 0.012;
        const x1 = (i + 1) / n - 0.012;
        const cx = (x0 + x1) / 2;
        const on = pattern[i]!;
        const active = playhead === i;
        scene.segments.push({
          x0: cx,
          y0: 0.22,
          x1: cx,
          y1: 0.55,
          thickness: Math.max(0.02, 0.55 / n),
          color: active && on ? AMBER : on ? TEAL : MUTED,
        });
        if (on && (burstAt === i || active)) {
          for (let r = 0; r <= reps; r += 1) {
            const t = r / Math.max(1, reps);
            scene.circles.push({
              x: cx + (t - 0.5) * (x1 - x0) * 0.6,
              y: 0.72 + (r % 2) * 0.06,
              r: 0.015,
              color: r === 0 ? AMBER : TEAL,
            });
          }
        }
      }
      return scene;
    },
  };
}
