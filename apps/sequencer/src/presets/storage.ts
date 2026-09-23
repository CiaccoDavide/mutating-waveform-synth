import type { EngineId } from '../engines/types';
import type { SharedParams } from '../engines/types';
import type { LinearState } from '../engines/linear';
import { defaultLinear, normalizeLinear } from '../engines/linear';
import type { RadarState } from '../engines/radar';
import { defaultRadar, normalizeRadar } from '../engines/radar';
import type { RainState } from '../engines/rain';
import { defaultRain, normalizeRain } from '../engines/rain';
import type { StringsState } from '../engines/strings';
import { defaultStrings, normalizeStrings } from '../engines/strings';
import type { TreeState } from '../engines/tree';
import { defaultTree, normalizeTree } from '../engines/tree';
import type { PulsesState } from '../engines/pulses';
import { defaultPulses, normalizePulses } from '../engines/pulses';
import type { RatchetState } from '../engines/ratchet';
import { defaultRatchet, normalizeRatchet } from '../engines/ratchet';
import type { CyclesState } from '../engines/cycles';
import { defaultCycles, normalizeCycles } from '../engines/cycles';
import type { PhraseState } from '../engines/phrase';
import { defaultPhrase, normalizePhrase } from '../engines/phrase';
import type { ArpState } from '../engines/arp';
import { defaultArp, normalizeArp } from '../engines/arp';
import type { BrownianState } from '../engines/brownian';
import { defaultBrownian, normalizeBrownian } from '../engines/brownian';
import type { OrbitState } from '../engines/orbit';
import { defaultOrbit, normalizeOrbit } from '../engines/orbit';
import type { CellularState } from '../engines/cellular';
import { defaultCellular, normalizeCellular } from '../engines/cellular';
import type { MarkovState } from '../engines/markov';
import { defaultMarkov, normalizeMarkov } from '../engines/markov';
import type { PolyrhythmState } from '../engines/polyrhythm';
import { defaultPolyrhythm, normalizePolyrhythm } from '../engines/polyrhythm';
import type { SwarmState } from '../engines/swarm';
import { defaultSwarm, normalizeSwarm } from '../engines/swarm';
import type { PendulumState } from '../engines/pendulum';
import { defaultPendulum, normalizePendulum } from '../engines/pendulum';
import type { LissajousState } from '../engines/lissajous';
import { defaultLissajous, normalizeLissajous } from '../engines/lissajous';
import type { RippleState } from '../engines/ripple';
import { defaultRipple, normalizeRipple } from '../engines/ripple';
import type { BounceState } from '../engines/bounce';
import { defaultBounce, normalizeBounce } from '../engines/bounce';
import type { SceneFx } from '../viz/types';
import { defaultFx } from '../viz/types';

export interface SeqPreset {
  id: string;
  name: string;
  engineId: EngineId;
  bpm: number;
  swing: number;
  humanize: number;
  midiChannel: number;
  shared: SharedParams;
  vizFx: SceneFx;
  linear: LinearState;
  radar: RadarState;
  bounce: BounceState;
  rain: RainState;
  strings: StringsState;
  tree: TreeState;
  pulses: PulsesState;
  ratchet: RatchetState;
  cycles: CyclesState;
  phrase: PhraseState;
  arp: ArpState;
  brownian: BrownianState;
  orbit: OrbitState;
  cellular: CellularState;
  markov: MarkovState;
  polyrhythm: PolyrhythmState;
  swarm: SwarmState;
  pendulum: PendulumState;
  lissajous: LissajousState;
  ripple: RippleState;
}

const KEY = 'mps-presets-v1';

export function defaultShared(): SharedParams {
  return {
    rootNote: 0,
    octave: 3,
    scaleId: 'minor',
    gate: 0.8,
    velocity: 100,
  };
}

export function blankPreset(partial?: Partial<SeqPreset>): SeqPreset {
  return {
    id: `seq-${Date.now().toString(36)}`,
    name: 'Untitled',
    engineId: 'linear',
    bpm: 120,
    swing: 0,
    humanize: 0,
    midiChannel: 1,
    shared: defaultShared(),
    vizFx: defaultFx(),
    linear: defaultLinear(),
    radar: defaultRadar(),
    bounce: defaultBounce(),
    rain: defaultRain(),
    strings: defaultStrings(),
    tree: defaultTree(),
    pulses: defaultPulses(),
    ratchet: defaultRatchet(),
    cycles: defaultCycles(),
    phrase: defaultPhrase(),
    arp: defaultArp(),
    brownian: defaultBrownian(),
    orbit: defaultOrbit(),
    cellular: defaultCellular(),
    markov: defaultMarkov(),
    polyrhythm: defaultPolyrhythm(),
    swarm: defaultSwarm(),
    pendulum: defaultPendulum(),
    lissajous: defaultLissajous(),
    ripple: defaultRipple(),
    ...partial,
  };
}

export const FACTORY_PRESETS: SeqPreset[] = [
  blankPreset({
    id: 'factory-linear-climb',
    name: 'Linear climb',
    engineId: 'linear',
    bpm: 110,
    linear: normalizeLinear({
      length: 8,
      steps: [[0], [2], [4], [0, 4], [5], [4, 7], [2], []],
      probability: 1,
      division: 1,
      octaveSpread: 0,
      mutate: 0,
    }),
  }),
  blankPreset({
    id: 'factory-radar-euclid',
    name: 'Radar donuts',
    engineId: 'radar',
    bpm: 128,
    radar: normalizeRadar({
      rings: [
        { steps: 16, hits: 5, offset: 0, beatsPerRev: 4, notes: [0, 2, 4, 5, 7] },
        { steps: 12, hits: 4, offset: 0, beatsPerRev: 4, notes: [2, 4, 5, 7] },
        { steps: 8, hits: 3, offset: 0, beatsPerRev: 2, notes: [4, 7, 9] },
      ],
    }),
  }),
  blankPreset({
    id: 'factory-bounce',
    name: 'Box bounce',
    engineId: 'bounce',
    bpm: 100,
    bounce: { ...defaultBounce(), count: 5, speed: 1.2, gravity: 0.4 },
  }),
  blankPreset({
    id: 'factory-rain',
    name: 'Pitch rain',
    engineId: 'rain',
    bpm: 90,
    rain: {
      ...defaultRain(),
      density: 0.55,
      fallSpeed: 1.1,
      lanes: 7,
      wind: 0.25,
      chordSpread: 1,
    },
  }),
  blankPreset({
    id: 'factory-strings',
    name: 'Wave scan',
    engineId: 'strings',
    bpm: 118,
    strings: {
      ...defaultStrings(),
      count: 6,
      roughness: 0.5,
      drift: 0.4,
      mode: 'line',
      scanSpeed: 0.28,
      threshold: 0.035,
      pointCount: 3,
    },
  }),
  blankPreset({
    id: 'factory-tree',
    name: 'Branch walk',
    engineId: 'tree',
    bpm: 105,
    tree: {
      ...defaultTree(),
      depth: 5,
      splitChance: 0.65,
      branchCount: 3,
    },
  }),
  blankPreset({
    id: 'factory-pulses',
    name: 'Euclid pulses',
    engineId: 'pulses',
    bpm: 124,
    pulses: { ...defaultPulses(), accentEvery: 4, rotateOnLoop: true },
  }),
  blankPreset({
    id: 'factory-ratchet',
    name: 'Pulse ratchet',
    engineId: 'ratchet',
    bpm: 112,
  }),
  blankPreset({
    id: 'factory-cycles',
    name: 'Cycle morph',
    engineId: 'cycles',
    bpm: 118,
  }),
  blankPreset({
    id: 'factory-phrase',
    name: 'Phrase sweep',
    engineId: 'phrase',
    bpm: 100,
  }),
  blankPreset({
    id: 'factory-arp',
    name: 'Chord arp',
    engineId: 'arp',
    bpm: 130,
    arp: { degrees: [0, 2, 4, 7], pattern: 'updown', rate: 1, octaves: 1 },
  }),
  blankPreset({
    id: 'factory-brownian',
    name: 'Brownian walk',
    engineId: 'brownian',
    bpm: 108,
    brownian: { stepSize: 2, inertia: 0.45, hold: 0.2, rate: 1, startDeg: 0 },
  }),
  blankPreset({
    id: 'factory-orbit',
    name: 'Spoke orbit',
    engineId: 'orbit',
    bpm: 100,
    orbit: { ...defaultOrbit(), count: 5, baseSpeed: 0.4, spokeCount: 8, alignChance: 0.4 },
  }),
  blankPreset({
    id: 'factory-cellular',
    name: 'Rule 90',
    engineId: 'cellular',
    bpm: 116,
    cellular: { ...defaultCellular(), rule: 90, width: 18, density: 0.4, rate: 1 },
  }),
  blankPreset({
    id: 'factory-markov',
    name: 'Markov drift',
    engineId: 'markov',
    bpm: 108,
    markov: { ...defaultMarkov(), stay: 0.2, jump: 0.15, rate: 1, startDeg: 0 },
    humanize: 0.25,
  }),
  blankPreset({
    id: 'factory-polyrhythm',
    name: 'Poly lanes',
    engineId: 'polyrhythm',
    bpm: 122,
    polyrhythm: defaultPolyrhythm(),
  }),
  blankPreset({
    id: 'factory-swarm',
    name: 'Soft swarm',
    engineId: 'swarm',
    bpm: 96,
    swarm: { ...defaultSwarm(), count: 12, speed: 0.5, cohesion: 0.4, sense: 0.09 },
    vizFx: defaultFx({ trail: 0.85, bloom: 0.5 }),
  }),
  blankPreset({
    id: 'factory-pendulum',
    name: 'Pendulum choir',
    engineId: 'pendulum',
    bpm: 88,
    pendulum: {
      ...defaultPendulum(),
      count: 5,
      lengthSpread: 0.5,
      damping: 0.06,
      chordOnSync: true,
    },
  }),
  blankPreset({
    id: 'factory-lissajous',
    name: 'Lissajous 3:2',
    engineId: 'lissajous',
    bpm: 110,
    lissajous: {
      ratioA: 3,
      ratioB: 2,
      phase: 0.25,
      speed: 0.4,
      lattice: 5,
    },
    vizFx: defaultFx({ trail: 0.9, bloom: 0.45 }),
  }),
  blankPreset({
    id: 'factory-ripple',
    name: 'Ripple nodes',
    engineId: 'ripple',
    bpm: 118,
    ripple: { steps: 16, pulses: 5, rotate: 0, nodeCount: 8, speed: 0.6 },
  }),
];

export function loadUserPresets(): SeqPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => migratePreset(p))
      .filter((p): p is SeqPreset => p !== null);
  } catch {
    return [];
  }
}

function migratePreset(raw: unknown): SeqPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<SeqPreset> & {
    chain?: unknown;
    rotating?: unknown;
    engineId?: string;
  };
  let engineId = p.engineId as EngineId | string | undefined;
  if (engineId === 'chain') engineId = 'strings';
  if (engineId === 'rotating') engineId = 'radar';

  const radar = normalizeRadar(p.radar ?? p.rotating);

  return blankPreset({
    ...p,
    id: p.id ?? `seq-${Date.now().toString(36)}`,
    name: p.name ?? 'Untitled',
    engineId: (engineId as EngineId) ?? 'linear',
    humanize: p.humanize ?? 0,
    linear: normalizeLinear(p.linear),
    radar,
    bounce: normalizeBounce(p.bounce),
    rain: normalizeRain(p.rain),
    strings: normalizeStrings(p.strings),
    tree: normalizeTree(p.tree),
    pulses: normalizePulses(p.pulses),
    ratchet: normalizeRatchet(p.ratchet),
    cycles: normalizeCycles(p.cycles),
    phrase: normalizePhrase(p.phrase),
    arp: normalizeArp(p.arp),
    brownian: normalizeBrownian(p.brownian),
    orbit: normalizeOrbit(p.orbit),
    cellular: normalizeCellular(p.cellular),
    markov: normalizeMarkov(p.markov),
    polyrhythm: normalizePolyrhythm(p.polyrhythm),
    swarm: normalizeSwarm(p.swarm),
    pendulum: normalizePendulum(p.pendulum),
    lissajous: normalizeLissajous(p.lissajous),
    ripple: normalizeRipple(p.ripple),
    vizFx: { ...defaultFx(), ...(p.vizFx ?? {}) },
  });
}

export function saveUserPresets(presets: SeqPreset[]) {
  localStorage.setItem(KEY, JSON.stringify(presets));
}

export function exportPresetJson(preset: SeqPreset): string {
  return JSON.stringify(preset, null, 2);
}

export function parsePresetJson(raw: string): SeqPreset | null {
  try {
    return migratePreset(JSON.parse(raw));
  } catch {
    return null;
  }
}
