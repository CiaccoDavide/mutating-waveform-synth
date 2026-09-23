import type { ModuleCategory, ModuleDef, ModuleType, PortDef } from './types';

const SEQ_DEFAULTS: Record<string, number | string> = {
  steps: '8',
  gateLen: 0.55,
};
for (let i = 0; i < 16; i++) {
  SEQ_DEFAULTS[`p${i}`] = [0, 2, 4, 5, 7, 5, 4, 2, 0, 3, 5, 7, 8, 7, 5, 3][i] ?? 0;
}

export const MODULE_CATEGORIES: {
  id: ModuleCategory;
  label: string;
}[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'effects', label: 'Effects' },
  { id: 'timing', label: 'Timing' },
];

/** Ensure every modulatable float param has a CV in port. */
export function finalizeModule(def: ModuleDef): ModuleDef {
  const ports: PortDef[] = [...def.ports];
  const existing = new Set(ports.map((p) => p.id));
  for (const p of def.params) {
    if (p.kind !== 'float') continue;
    if (p.modulate === false) continue;
    if (existing.has(p.key)) continue;
    ports.push({
      id: p.key,
      label: p.label,
      kind: 'cv',
      dir: 'in',
    });
    existing.add(p.key);
  }
  return { ...def, ports };
}

const OSC_RAW: ModuleDef = {
  type: 'osc',
  name: 'Osc',
  category: 'voice',
  ports: [
    { id: 'freq', label: 'Freq', kind: 'cv', dir: 'in' },
    { id: 'amp', label: 'Amp', kind: 'cv', dir: 'in' },
    { id: 'audio', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    {
      key: 'wave',
      label: 'Wave',
      kind: 'enum',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'sawtooth', label: 'Saw' },
        { value: 'square', label: 'Square' },
        { value: 'triangle', label: 'Tri' },
        { value: 'pulse', label: 'Pulse' },
        { value: 'fold', label: 'Fold' },
      ],
    },
    { key: 'freq', label: 'Freq Hz', kind: 'float', min: 20, max: 2000, step: 1 },
    { key: 'amp', label: 'Amp', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'pw', label: 'PW', kind: 'float', min: 0.05, max: 0.95, step: 0.01 },
    { key: 'detune', label: 'Detune', kind: 'float', min: -100, max: 100, step: 1 },
    { key: 'fm', label: 'FM', kind: 'float', min: 0, max: 1, step: 0.01 },
    {
      key: 'fmRatio',
      label: 'FM ratio',
      kind: 'float',
      min: 0.5,
      max: 8,
      step: 0.01,
      modulate: false,
    },
  ],
  defaults: {
    wave: 'sawtooth',
    freq: 110,
    amp: 0.35,
    pw: 0.5,
    detune: 0,
    fm: 0,
    fmRatio: 2,
  },
};

const ENV_RAW: ModuleDef = {
  type: 'env',
  name: 'Env',
  category: 'voice',
  ports: [
    { id: 'gate', label: 'Gate', kind: 'gate', dir: 'in' },
    { id: 'cv', label: 'CV', kind: 'cv', dir: 'out' },
  ],
  params: [
    {
      key: 'attack',
      label: 'Attack',
      kind: 'float',
      min: 0.001,
      max: 2,
      step: 0.001,
      modulate: false,
    },
    {
      key: 'decay',
      label: 'Decay',
      kind: 'float',
      min: 0.001,
      max: 2,
      step: 0.001,
      modulate: false,
    },
    {
      key: 'sustain',
      label: 'Sustain',
      kind: 'float',
      min: 0,
      max: 1,
      step: 0.01,
      modulate: false,
    },
    {
      key: 'release',
      label: 'Release',
      kind: 'float',
      min: 0.001,
      max: 4,
      step: 0.001,
      modulate: false,
    },
  ],
  defaults: { attack: 0.01, decay: 0.2, sustain: 0.65, release: 0.35 },
};

const FILTER_RAW: ModuleDef = {
  type: 'filter',
  name: 'Filter',
  category: 'voice',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'cutoff', label: 'Cutoff', kind: 'cv', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    {
      key: 'type',
      label: 'Type',
      kind: 'enum',
      options: [
        { value: 'lowpass', label: 'LP' },
        { value: 'highpass', label: 'HP' },
        { value: 'bandpass', label: 'BP' },
      ],
    },
    { key: 'cutoff', label: 'Cutoff', kind: 'float', min: 40, max: 12000, step: 1 },
    { key: 'q', label: 'Q', kind: 'float', min: 0.1, max: 18, step: 0.1 },
  ],
  defaults: { type: 'lowpass', cutoff: 1800, q: 1.2 },
};

const VCA_RAW: ModuleDef = {
  type: 'vca',
  name: 'VCA',
  category: 'voice',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'cv', label: 'CV', kind: 'cv', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'level', label: 'Level', kind: 'float', min: 0, max: 1, step: 0.01 },
  ],
  defaults: { level: 0.85 },
};

const OUT_RAW: ModuleDef = {
  type: 'out',
  name: 'Out',
  category: 'voice',
  ports: [{ id: 'audio', label: 'In', kind: 'audio', dir: 'in' }],
  params: [
    { key: 'gain', label: 'Master', kind: 'float', min: 0, max: 1, step: 0.01 },
  ],
  defaults: { gain: 0.55 },
};

const CHORUS_RAW: ModuleDef = {
  type: 'chorus',
  name: 'Chorus',
  category: 'effects',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'mix', label: 'Mix', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'rate', label: 'Rate', kind: 'float', min: 0.05, max: 8, step: 0.01 },
    { key: 'depth', label: 'Depth', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'feedback', label: 'Fdbk', kind: 'float', min: 0, max: 0.9, step: 0.01 },
  ],
  defaults: { mix: 0.35, rate: 0.9, depth: 0.45, feedback: 0.15 },
};

const DELAY_RAW: ModuleDef = {
  type: 'delay',
  name: 'Delay',
  category: 'effects',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'mix', label: 'Mix', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'timeMs', label: 'Time ms', kind: 'float', min: 20, max: 1500, step: 1 },
    { key: 'feedback', label: 'Fdbk', kind: 'float', min: 0, max: 0.95, step: 0.01 },
    { key: 'tone', label: 'Tone', kind: 'float', min: 200, max: 12000, step: 1 },
  ],
  defaults: { mix: 0.3, timeMs: 320, feedback: 0.35, tone: 4200 },
};

const REVERB_RAW: ModuleDef = {
  type: 'reverb',
  name: 'Reverb',
  category: 'effects',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'mix', label: 'Mix', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'size', label: 'Size', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'decay', label: 'Decay', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'damping', label: 'Damp', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'preDelayMs', label: 'Pre ms', kind: 'float', min: 0, max: 100, step: 1 },
  ],
  defaults: { mix: 0.25, size: 0.55, decay: 0.5, damping: 0.4, preDelayMs: 25 },
};

const CLOCK_RAW: ModuleDef = {
  type: 'clock',
  name: 'Clock',
  category: 'timing',
  ports: [{ id: 'gate', label: 'Gate', kind: 'gate', dir: 'out' }],
  params: [
    { key: 'bpm', label: 'BPM', kind: 'float', min: 40, max: 240, step: 1 },
    { key: 'pulseMs', label: 'Pulse ms', kind: 'float', min: 5, max: 200, step: 1 },
    {
      key: 'div',
      label: 'Div',
      kind: 'enum',
      options: [
        { value: '1', label: '1/4' },
        { value: '1/2', label: '1/8' },
        { value: '1/4', label: '1/16' },
        { value: '1/8', label: '1/32' },
      ],
    },
  ],
  defaults: { bpm: 110, pulseMs: 40, div: '1' },
};

const SEQ_RAW: ModuleDef = {
  type: 'seq',
  name: 'Seq',
  category: 'timing',
  ports: [
    { id: 'clock', label: 'Clk', kind: 'gate', dir: 'in' },
    { id: 'gate', label: 'Gate', kind: 'gate', dir: 'out' },
    { id: 'pitch', label: 'Pitch', kind: 'cv', dir: 'out' },
  ],
  params: [
    {
      key: 'steps',
      label: 'Steps',
      kind: 'enum',
      options: [
        { value: '8', label: '8' },
        { value: '16', label: '16' },
      ],
    },
    { key: 'gateLen', label: 'Gate len', kind: 'float', min: 0.05, max: 1, step: 0.01 },
    ...Array.from({ length: 16 }, (_, i) => ({
      key: `p${i}`,
      label: `P${i + 1}`,
      kind: 'float' as const,
      min: 0,
      max: 14,
      step: 1,
      modulate: false as const,
    })),
  ],
  defaults: SEQ_DEFAULTS,
};

const QUANT_RAW: ModuleDef = {
  type: 'quant',
  name: 'Quant',
  category: 'timing',
  ports: [
    { id: 'in', label: 'In', kind: 'cv', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'cv', dir: 'out' },
  ],
  params: [
    { key: 'root', label: 'Root', kind: 'float', min: 0, max: 11, step: 1 },
    {
      key: 'scale',
      label: 'Scale',
      kind: 'enum',
      options: [
        { value: 'minor', label: 'Minor' },
        { value: 'major', label: 'Major' },
        { value: 'pentatonic', label: 'Pent' },
        { value: 'dorian', label: 'Dorian' },
        { value: 'chromatic', label: 'Chrom' },
      ],
    },
  ],
  defaults: { root: 0, scale: 'minor' },
};

const LFO_RAW: ModuleDef = {
  type: 'lfo',
  name: 'LFO',
  category: 'timing',
  ports: [
    { id: 'rate', label: 'Rate', kind: 'cv', dir: 'in' },
    { id: 'cv', label: 'CV', kind: 'cv', dir: 'out' },
  ],
  params: [
    {
      key: 'wave',
      label: 'Wave',
      kind: 'enum',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'triangle', label: 'Tri' },
        { value: 'sawtooth', label: 'Saw' },
        { value: 'square', label: 'Square' },
        { value: 'pulse', label: 'Pulse' },
        { value: 'random', label: 'Random' },
        { value: 'samplehold', label: 'S&H' },
      ],
    },
    {
      key: 'bipolar',
      label: 'Polarity',
      kind: 'enum',
      options: [
        { value: 'uni', label: 'Uni' },
        { value: 'bi', label: 'Bi' },
      ],
    },
    { key: 'rate', label: 'Rate Hz', kind: 'float', min: 0.01, max: 20, step: 0.01 },
    { key: 'depth', label: 'Depth', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'offset', label: 'Offset', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'pw', label: 'PW', kind: 'float', min: 0.05, max: 0.95, step: 0.01 },
  ],
  defaults: {
    wave: 'sine',
    bipolar: 'uni',
    rate: 0.4,
    depth: 0.5,
    offset: 0.5,
    pw: 0.5,
  },
};

const TURING_RAW: ModuleDef = {
  type: 'turing',
  name: 'Turing',
  category: 'timing',
  ports: [
    { id: 'clock', label: 'Clk', kind: 'gate', dir: 'in' },
    { id: 'pitch', label: 'Pitch', kind: 'cv', dir: 'out' },
    { id: 'gate', label: 'Gate', kind: 'gate', dir: 'out' },
  ],
  params: [
    {
      key: 'length',
      label: 'Length',
      kind: 'enum',
      options: [
        { value: '8', label: '8' },
        { value: '16', label: '16' },
      ],
    },
    { key: 'prob', label: 'Prob', kind: 'float', min: 0, max: 1, step: 0.01 },
    {
      key: 'locked',
      label: 'Lock',
      kind: 'enum',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ],
    },
    { key: 'gateLen', label: 'Gate len', kind: 'float', min: 0.05, max: 1, step: 0.01 },
    { key: 'root', label: 'Root', kind: 'float', min: 0, max: 11, step: 1 },
    {
      key: 'scale',
      label: 'Scale',
      kind: 'enum',
      options: [
        { value: 'minor', label: 'Minor' },
        { value: 'major', label: 'Major' },
        { value: 'pentatonic', label: 'Pent' },
        { value: 'dorian', label: 'Dorian' },
        { value: 'chromatic', label: 'Chrom' },
      ],
    },
  ],
  defaults: {
    length: '8',
    prob: 0.35,
    locked: 'off',
    gateLen: 0.55,
    root: 0,
    scale: 'minor',
  },
};

const EUCLID_RAW: ModuleDef = {
  type: 'euclid',
  name: 'Euclid',
  category: 'timing',
  ports: [
    { id: 'clock', label: 'Clk', kind: 'gate', dir: 'in' },
    { id: 'gate', label: 'Gate', kind: 'gate', dir: 'out' },
    { id: 'cv', label: 'Step', kind: 'cv', dir: 'out' },
  ],
  params: [
    {
      key: 'steps',
      label: 'Steps',
      kind: 'float',
      min: 2,
      max: 32,
      step: 1,
      modulate: false,
    },
    {
      key: 'fills',
      label: 'Fills',
      kind: 'float',
      min: 0,
      max: 32,
      step: 1,
      modulate: false,
    },
    {
      key: 'rotate',
      label: 'Rotate',
      kind: 'float',
      min: 0,
      max: 31,
      step: 1,
      modulate: false,
    },
    { key: 'gateLen', label: 'Gate len', kind: 'float', min: 0.05, max: 1, step: 0.01 },
  ],
  defaults: { steps: 16, fills: 5, rotate: 0, gateLen: 0.45 },
};

const MIXER_RAW: ModuleDef = {
  type: 'mixer',
  name: 'Mixer',
  category: 'voice',
  ports: [
    { id: 'a', label: 'A', kind: 'audio', dir: 'in' },
    { id: 'b', label: 'B', kind: 'audio', dir: 'in' },
    { id: 'c', label: 'C', kind: 'audio', dir: 'in' },
    { id: 'd', label: 'D', kind: 'audio', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'levelA', label: 'Lvl A', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'levelB', label: 'Lvl B', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'levelC', label: 'Lvl C', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'levelD', label: 'Lvl D', kind: 'float', min: 0, max: 1, step: 0.01 },
    { key: 'master', label: 'Master', kind: 'float', min: 0, max: 1, step: 0.01 },
  ],
  defaults: { levelA: 0.7, levelB: 0.7, levelC: 0.7, levelD: 0.7, master: 0.8 },
};

const NOISE_RAW: ModuleDef = {
  type: 'noise',
  name: 'Noise',
  category: 'voice',
  ports: [{ id: 'audio', label: 'Out', kind: 'audio', dir: 'out' }],
  params: [
    {
      key: 'type',
      label: 'Type',
      kind: 'enum',
      options: [
        { value: 'white', label: 'White' },
        { value: 'pink', label: 'Pink' },
      ],
    },
    { key: 'level', label: 'Level', kind: 'float', min: 0, max: 1, step: 0.01 },
  ],
  defaults: { type: 'white', level: 0.25 },
};

const SH_RAW: ModuleDef = {
  type: 'sh',
  name: 'S&H',
  category: 'timing',
  ports: [
    { id: 'in', label: 'In', kind: 'cv', dir: 'in' },
    { id: 'gate', label: 'Gate', kind: 'gate', dir: 'in' },
    { id: 'cv', label: 'CV', kind: 'cv', dir: 'out' },
  ],
  params: [],
  defaults: {},
};

const ATT_RAW: ModuleDef = {
  type: 'att',
  name: 'Att',
  category: 'timing',
  ports: [
    { id: 'in', label: 'In', kind: 'cv', dir: 'in' },
    { id: 'cv', label: 'CV', kind: 'cv', dir: 'out' },
    { id: 'audio', label: 'Audio', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'gain', label: 'Gain', kind: 'float', min: -1, max: 1, step: 0.01 },
    { key: 'offset', label: 'Offset', kind: 'float', min: -1, max: 1, step: 0.01 },
  ],
  defaults: { gain: 1, offset: 0 },
};

const DIST_RAW: ModuleDef = {
  type: 'dist',
  name: 'Dist',
  category: 'effects',
  ports: [
    { id: 'audio', label: 'In', kind: 'audio', dir: 'in' },
    { id: 'out', label: 'Out', kind: 'audio', dir: 'out' },
  ],
  params: [
    { key: 'drive', label: 'Drive', kind: 'float', min: 1, max: 20, step: 0.1 },
    { key: 'mix', label: 'Mix', kind: 'float', min: 0, max: 1, step: 0.01 },
  ],
  defaults: { drive: 4, mix: 0.5 },
};

export const OSC = finalizeModule(OSC_RAW);
export const ENV = finalizeModule(ENV_RAW);
export const FILTER = finalizeModule(FILTER_RAW);
export const VCA = finalizeModule(VCA_RAW);
export const OUT = finalizeModule(OUT_RAW);
export const CHORUS = finalizeModule(CHORUS_RAW);
export const DELAY = finalizeModule(DELAY_RAW);
export const REVERB = finalizeModule(REVERB_RAW);
export const CLOCK = finalizeModule(CLOCK_RAW);
export const SEQ = finalizeModule(SEQ_RAW);
export const QUANT = finalizeModule(QUANT_RAW);
export const LFO = finalizeModule(LFO_RAW);
export const TURING = finalizeModule(TURING_RAW);
export const EUCLID = finalizeModule(EUCLID_RAW);
export const MIXER = finalizeModule(MIXER_RAW);
export const NOISE = finalizeModule(NOISE_RAW);
export const SH = finalizeModule(SH_RAW);
export const ATT = finalizeModule(ATT_RAW);
export const DIST = finalizeModule(DIST_RAW);

export const MODULE_DEFS: Record<ModuleType, ModuleDef> = {
  osc: OSC,
  env: ENV,
  filter: FILTER,
  vca: VCA,
  out: OUT,
  chorus: CHORUS,
  delay: DELAY,
  reverb: REVERB,
  clock: CLOCK,
  seq: SEQ,
  quant: QUANT,
  lfo: LFO,
  turing: TURING,
  euclid: EUCLID,
  mixer: MIXER,
  noise: NOISE,
  sh: SH,
  att: ATT,
  dist: DIST,
};

export const MODULE_LIST = Object.values(MODULE_DEFS);

export function modulesByCategory(category: ModuleCategory): ModuleDef[] {
  return MODULE_LIST.filter((m) => m.category === category);
}
