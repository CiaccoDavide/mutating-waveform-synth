import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { isGridSixteenth } from './euclid';
import {
  AMBER,
  MUTED,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface CellularState {
  rule: number;
  width: number;
  density: number;
  rate: number;
  /** Mirror left half into right on seed */
  symmetry: boolean;
}

export function defaultCellular(): CellularState {
  return { rule: 90, width: 16, density: 0.35, rate: 1, symmetry: false };
}

export function normalizeCellular(raw: unknown): CellularState {
  const d = defaultCellular();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<CellularState>;
  return {
    rule: Math.max(0, Math.min(255, Math.round(o.rule ?? d.rule))),
    width: Math.max(4, Math.min(48, Math.round(o.width ?? d.width))),
    density: Math.min(0.95, Math.max(0.05, o.density ?? d.density)),
    rate: Math.max(1, Math.min(8, Math.round(o.rate ?? d.rate))),
    symmetry: Boolean(o.symmetry ?? d.symmetry),
  };
}

function nextRow(row: boolean[], rule: number): boolean[] {
  const n = row.length;
  const out = Array.from({ length: n }, () => false);
  for (let i = 0; i < n; i += 1) {
    const l = row[(i - 1 + n) % n] ? 1 : 0;
    const c = row[i] ? 1 : 0;
    const r = row[(i + 1) % n] ? 1 : 0;
    const idx = (l << 2) | (c << 1) | r;
    out[i] = ((rule >> idx) & 1) === 1;
  }
  return out;
}

export function createCellularEngine(getState: () => CellularState): Engine {
  let row: boolean[] = [];
  let history: boolean[][] = [];
  let tick = 0;
  let playhead = 0;

  const seed = () => {
    const st = getState();
    const w = Math.max(4, Math.min(32, Math.round(st.width)));
    row = Array.from({ length: w }, () => Math.random() < st.density);
    if (st.symmetry) {
      for (let i = 0; i < Math.floor(w / 2); i += 1) {
        row[w - 1 - i] = row[i]!;
      }
    }
    history = [row.slice()];
  };

  return {
    id: 'cellular',
    name: 'Cellular',
    reset() {
      tick = 0;
      playhead = 0;
      seed();
    },
    step() {
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const rate = Math.max(1, Math.round(st.rate));
      if (tick % rate !== 0) {
        tick += 1;
        return [];
      }
      tick += 1;
      if (row.length === 0) seed();
      const w = row.length;
      if (w !== Math.max(4, Math.min(32, Math.round(st.width)))) seed();
      const rule = Math.max(0, Math.min(255, Math.round(st.rule)));
      row = nextRow(row, rule);
      history.unshift(row.slice());
      if (history.length > 10) history.pop();
      playhead = (playhead + 1) % w;
      const out: ScheduledNote[] = [];
      for (let i = 0; i < w; i += 1) {
        if (!row[i]) continue;
        out.push({
          note: degreeToMidi(i % 12, shared.rootNote, shared.octave, shared.scaleId),
          velocity: shared.velocity * (0.7 + (i / w) * 0.3),
          durationBeats: shared.gate * 0.2 * rate,
        });
      }
      return out;
    },
    getScene(): Scene {
      const scene = emptyScene();
      if (row.length === 0) seed();
      const rows = history.length ? history : [row];
      const w = row.length;
      const h = rows.length;
      for (let r = 0; r < h; r += 1) {
        const line = rows[r]!;
        for (let c = 0; c < w; c += 1) {
          if (!line[c]) continue;
          const x = (c + 0.5) / w;
          const y = 0.12 + (r / Math.max(1, h)) * 0.75;
          scene.circles.push({
            x,
            y,
            r: r === 0 ? 0.022 : 0.014,
            color: r === 0 ? AMBER : TEAL,
          });
        }
      }
      if (w === 0) {
        scene.circles.push({ x: 0.5, y: 0.5, r: 0.03, color: MUTED });
      }
      return scene;
    },
  };
}
