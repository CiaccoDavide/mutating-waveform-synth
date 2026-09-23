import type { Patch } from '../modules/types';
import {
  blankPatch,
  bipolarFilterPatch,
  driftingDronePatch,
  dualMixPatch,
  euclidPulsePatch,
  euclidTuringPatch,
  fmGritPatch,
  noiseHoldPatch,
  pwmPadPatch,
  selfPlayPatch,
  seqGritPatch,
  starterPatch,
  turingLoopPatch,
} from '../patch/factory';
import { uid } from '../modules/types';

const KEY = 'mutating-modular-patches-v1';
const LAST_KEY = 'mutating-modular-last-v1';

export interface SavedPatch {
  id: string;
  name: string;
  patch: Patch;
  updatedAt: number;
}

export function factoryPatches(): Patch[] {
  const core = starterPatch();
  core.name = 'Core voice';

  const bright = starterPatch();
  bright.id = uid('patch');
  bright.name = 'Bright lead';
  const osc = bright.nodes.find((n) => n.type === 'osc');
  const filter = bright.nodes.find((n) => n.type === 'filter');
  const env = bright.nodes.find((n) => n.type === 'env');
  if (osc) {
    osc.params.wave = 'square';
    osc.params.freq = 220;
  }
  if (filter) {
    filter.params.cutoff = 4200;
    filter.params.q = 4;
  }
  if (env) {
    env.params.attack = 0.005;
    env.params.decay = 0.12;
    env.params.sustain = 0.4;
    env.params.release = 0.2;
  }

  return [
    core,
    bright,
    selfPlayPatch(),
    driftingDronePatch(),
    dualMixPatch(),
    noiseHoldPatch(),
    seqGritPatch(),
    turingLoopPatch(),
    euclidPulsePatch(),
    pwmPadPatch(),
    euclidTuringPatch(),
    fmGritPatch(),
    bipolarFilterPatch(),
  ];
}

export function loadUserPatches(): SavedPatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserPatches(list: SavedPatch[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveLastPatch(patch: Patch) {
  localStorage.setItem(LAST_KEY, JSON.stringify(patch));
}

export function loadLastPatch(): Patch | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Patch;
  } catch {
    return null;
  }
}

export function exportPatchJson(patch: Patch): string {
  return JSON.stringify(patch, null, 2);
}

export function parsePatchJson(raw: string): Patch | null {
  try {
    const p = JSON.parse(raw) as Patch;
    if (!p || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
    if (!p.id) p.id = uid('patch');
    if (!p.name) p.name = 'Imported';
    return p;
  } catch {
    return null;
  }
}

export { blankPatch };
