import { degreeToMidi } from '../scale/scales';
import { emptyScene } from '../viz/types';
import type { Scene } from '../viz/types';
import { isGridSixteenth } from './euclid';
import {
  AMBER,
  DIM,
  TEAL,
  type Engine,
  type ScheduledNote,
} from './types';

export interface TreeState {
  depth: number;
  splitChance: number;
  /** Max simultaneous active tips */
  branchCount: number;
  tempoDivision: number;
  degreeStep: number;
  pruneChance: number;
}

export function defaultTree(): TreeState {
  return {
    depth: 5,
    splitChance: 0.55,
    branchCount: 3,
    tempoDivision: 1,
    degreeStep: 1,
    pruneChance: 0.08,
  };
}

export function normalizeTree(raw: unknown): TreeState {
  const d = defaultTree();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Partial<TreeState>;
  return {
    depth: Math.max(2, Math.min(12, Math.round(o.depth ?? d.depth))),
    splitChance: Math.min(1, Math.max(0, o.splitChance ?? d.splitChance)),
    branchCount: Math.max(1, Math.min(8, Math.round(o.branchCount ?? d.branchCount))),
    tempoDivision: Math.max(1, Math.min(8, Math.round(o.tempoDivision ?? d.tempoDivision))),
    degreeStep: Math.max(1, Math.min(5, Math.round(o.degreeStep ?? d.degreeStep))),
    pruneChance: Math.min(0.8, Math.max(0, o.pruneChance ?? d.pruneChance)),
  };
}


interface Tip {
  depth: number;
  y: number;
  deg: number;
  path: { x: number; y: number }[];
}

export function createTreeEngine(getState: () => TreeState): Engine {
  let tips: Tip[] = [];
  let anim = 0;
  let tick = 0;

  const spawnRoot = (): Tip => ({
    depth: 0,
    y: 0.5,
    deg: 0,
    path: [{ x: 0.04, y: 0.5 }],
  });

  const ensure = () => {
    if (tips.length === 0) tips = [spawnRoot()];
  };

  return {
    id: 'tree',
    name: 'Tree branches',
    reset() {
      tips = [spawnRoot()];
      anim = 0;
      tick = 0;
    },
    step(dt) {
      anim += dt;
      ensure();
      return [];
    },
    onTick(beat, shared): ScheduledNote[] {
      if (!isGridSixteenth(beat)) return [];
      const st = getState();
      const div = Math.max(1, Math.round(st.tempoDivision));
      if (tick % div !== 0) {
        tick += 1;
        return [];
      }
      tick += 1;
      ensure();
      const maxDepth = Math.max(2, st.depth);
      const maxTips = Math.max(1, st.branchCount);
      const step = Math.max(1, Math.round(st.degreeStep));
      const out: ScheduledNote[] = [];
      const next: Tip[] = [];

      for (const tip of tips) {
        out.push({
          note: degreeToMidi(
            tip.deg,
            shared.rootNote,
            shared.octave,
            shared.scaleId,
          ),
          velocity: shared.velocity * (0.85 + Math.random() * 0.15),
          durationBeats: shared.gate * 0.25 * div,
        });

        if (Math.random() < st.pruneChance) {
          next.push(spawnRoot());
          continue;
        }

        if (tip.depth >= maxDepth - 1) {
          next.push(spawnRoot());
          continue;
        }

        const x = 0.04 + ((tip.depth + 1) / maxDepth) * 0.9;
        const split =
          Math.random() < st.splitChance && next.length + 1 < maxTips;

        if (split) {
          const spread = 0.12 / (tip.depth + 1);
          for (const dy of [-spread, spread]) {
            const child: Tip = {
              depth: tip.depth + 1,
              y: Math.min(0.92, Math.max(0.08, tip.y + dy)),
              deg: tip.deg + (dy < 0 ? step : step + 1),
              path: [...tip.path, { x, y: tip.y + dy }],
            };
            child.path[child.path.length - 1] = { x, y: child.y };
            next.push(child);
          }
        } else {
          const wobble = (Math.random() - 0.5) * 0.06;
          const child: Tip = {
            depth: tip.depth + 1,
            y: Math.min(0.92, Math.max(0.08, tip.y + wobble)),
            deg: tip.deg + step,
            path: [...tip.path, { x, y: tip.y }],
          };
          child.path[child.path.length - 1] = { x, y: child.y };
          next.push(child);
        }
      }

      tips = next.slice(0, maxTips);
      if (tips.length === 0) tips = [spawnRoot()];
      return out;
    },
    getScene(): Scene {
      const scene = emptyScene();
      scene.segments.push({
        x0: 0.04,
        y0: 0.1,
        x1: 0.04,
        y1: 0.9,
        thickness: 0.01,
        color: DIM,
      });
      for (const tip of tips) {
        for (let i = 1; i < tip.path.length; i += 1) {
          const a = tip.path[i - 1]!;
          const b = tip.path[i]!;
          scene.segments.push({
            x0: a.x,
            y0: a.y,
            x1: b.x,
            y1: b.y,
            thickness: 0.014,
            color: TEAL,
          });
        }
        const last = tip.path[tip.path.length - 1]!;
        scene.circles.push({
          x: last.x,
          y: last.y,
          r: 0.028,
          color: AMBER,
        });
      }
      void anim;
      return scene;
    },
  };
}
