import { compileFormula, type SampleFn } from './FormulaCompiler';

export type LfoShape = 'sine' | 'triangle' | 'saw' | 'square' | 'custom';

export type LfoTarget = 'phase' | 'amp' | 'time' | 'fold';

export type SubLfoTarget = 'rate' | 'depth' | 'both';

export const LFO_SHAPES: { id: LfoShape; name: string }[] = [
  { id: 'sine', name: 'Sine' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'saw', name: 'Saw' },
  { id: 'square', name: 'Square' },
  { id: 'custom', name: 'Custom' },
];

export const LFO_TARGETS: { id: LfoTarget; name: string }[] = [
  { id: 'phase', name: 'Phase' },
  { id: 'fold', name: 'Fold' },
  { id: 'amp', name: 'Amp' },
  { id: 'time', name: 'Time' },
];

export const SUB_LFO_TARGETS: { id: SubLfoTarget; name: string }[] = [
  { id: 'rate', name: 'Rate' },
  { id: 'depth', name: 'Depth' },
  { id: 'both', name: 'Both' },
];

export const LFO_COUNT = 3;

export interface SubLfoState {
  enabled: boolean;
  shape: LfoShape;
  formula: string;
  rate: number;
  depth: number;
  target: SubLfoTarget;
}

export interface LfoState {
  enabled: boolean;
  shape: LfoShape;
  formula: string;
  rate: number;
  depth: number;
  target: LfoTarget;
  sub: SubLfoState;
}

export interface MutatorState {
  enabled: boolean;
  morphRate: number;
  lfos: LfoState[];
}

export function createDefaultSubLfo(overrides: Partial<SubLfoState> = {}): SubLfoState {
  return {
    enabled: false,
    shape: 'sine',
    formula: 'sin(x)',
    rate: 0.08,
    depth: 0.4,
    target: 'rate',
    ...overrides,
  };
}

export function createDefaultLfo(
  index: number,
  overrides: Partial<Omit<LfoState, 'sub'>> & { sub?: Partial<SubLfoState> } = {},
): LfoState {
  const { sub, ...rest } = overrides;
  const defaults: Array<Omit<LfoState, 'sub'>> = [
    {
      enabled: false,
      shape: 'sine',
      formula: 'sin(x)',
      rate: 0.12,
      depth: 0.35,
      target: 'phase',
    },
    {
      enabled: false,
      shape: 'triangle',
      formula: 'sin(x)',
      rate: 0.07,
      depth: 0.25,
      target: 'fold',
    },
    {
      enabled: false,
      shape: 'saw',
      formula: 'sin(x)',
      rate: 0.04,
      depth: 0.2,
      target: 'amp',
    },
  ];
  const base = defaults[index] ?? defaults[0]!;
  return {
    ...base,
    ...rest,
    sub: createDefaultSubLfo(sub),
  };
}

export function createDefaultMutators(
  overrides: Partial<Omit<MutatorState, 'lfos'>> & {
    lfos?: Array<Partial<Omit<LfoState, 'sub'>> & { sub?: Partial<SubLfoState> }>;
  } = {},
): MutatorState {
  const lfos = Array.from({ length: LFO_COUNT }, (_, i) =>
    createDefaultLfo(i, overrides.lfos?.[i]),
  );
  return {
    enabled: true,
    morphRate: 1,
    ...overrides,
    lfos,
  };
}

/** Evaluate a bipolar (−1…1) LFO shape; phase is 0…1 */
export function evalShape(
  shape: LfoShape,
  phase01: number,
  customFn: SampleFn | null,
): number {
  const p = phase01 - Math.floor(phase01);
  switch (shape) {
    case 'sine':
      return Math.sin(p * Math.PI * 2);
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'saw':
      return 2 * p - 1;
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'custom': {
      if (!customFn) return Math.sin(p * Math.PI * 2);
      const y = customFn(p * Math.PI * 2, 0);
      return Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
    }
  }
}

function compileShape(shape: LfoShape, formula: string): SampleFn | null {
  if (shape !== 'custom') return null;
  const result = compileFormula(formula);
  return result.ok ? result.fn : null;
}

function evalLfoValue(
  lfo: LfoState,
  t: number,
  customFn: SampleFn | null,
  subFn: SampleFn | null,
): number {
  let rate = lfo.rate;
  let depth = lfo.depth;

  if (lfo.sub.enabled) {
    const subPhase = t * lfo.sub.rate;
    const sub = evalShape(lfo.sub.shape, subPhase, subFn) * lfo.sub.depth;
    if (lfo.sub.target === 'rate' || lfo.sub.target === 'both') {
      rate = Math.max(0.001, rate * (1 + sub));
    }
    if (lfo.sub.target === 'depth' || lfo.sub.target === 'both') {
      depth = depth * (1 + sub * 0.5);
    }
  }

  const phase = t * rate;
  return evalShape(lfo.shape, phase, customFn) * depth;
}

export function applyMutators(base: SampleFn, mutators: MutatorState): SampleFn {
  if (!mutators.enabled) return base;

  const compiled = mutators.lfos.map((lfo) => ({
    custom: compileShape(lfo.shape, lfo.formula),
    sub: compileShape(lfo.sub.shape, lfo.sub.formula),
  }));

  return (x, t) => {
    let phase = x;
    let amp = 1;
    let morphT = t * mutators.morphRate;

    for (let i = 0; i < mutators.lfos.length; i += 1) {
      const lfo = mutators.lfos[i]!;
      if (!lfo.enabled) continue;
      const v = evalLfoValue(lfo, t, compiled[i]!.custom, compiled[i]!.sub);
      switch (lfo.target) {
        case 'phase':
          phase += v;
          break;
        case 'fold':
          phase += v * Math.sin(phase * 2);
          break;
        case 'amp':
          amp *= 1 + v * 0.85;
          break;
        case 'time':
          morphT += v * 2;
          break;
      }
    }

    return base(phase, morphT) * amp;
  };
}

export function mutatorsNeedBake(mutators: MutatorState): boolean {
  if (!mutators.enabled) return false;
  if (Math.abs(mutators.morphRate - 1) > 1e-6) return true;
  return mutators.lfos.some((l) => l.enabled);
}

/** Load LFO bank matching a preset's pedagogical tier */
export function mutatorsForTier(
  tier: 'static' | 'simple-lfo' | 'multi-lfo' | 'sub-lfo' | 'complex',
): MutatorState {
  switch (tier) {
    case 'static':
      return createDefaultMutators({
        enabled: true,
        morphRate: 1,
        lfos: [
          { enabled: false },
          { enabled: false },
          { enabled: false },
        ],
      });
    case 'simple-lfo':
      return createDefaultMutators({
        enabled: true,
        morphRate: 1,
        lfos: [
          {
            enabled: true,
            shape: 'sine',
            rate: 0.15,
            depth: 0.32,
            target: 'phase',
            sub: { enabled: false },
          },
          { enabled: false },
          { enabled: false },
        ],
      });
    case 'multi-lfo':
      return createDefaultMutators({
        enabled: true,
        morphRate: 0.85,
        lfos: [
          {
            enabled: true,
            shape: 'sine',
            rate: 0.12,
            depth: 0.3,
            target: 'phase',
            sub: { enabled: false },
          },
          {
            enabled: true,
            shape: 'triangle',
            rate: 0.08,
            depth: 0.22,
            target: 'fold',
            sub: { enabled: false },
          },
          {
            enabled: true,
            shape: 'saw',
            rate: 0.05,
            depth: 0.15,
            target: 'amp',
            sub: { enabled: false },
          },
        ],
      });
    case 'sub-lfo':
      return createDefaultMutators({
        enabled: true,
        morphRate: 0.9,
        lfos: [
          {
            enabled: true,
            shape: 'sine',
            rate: 0.18,
            depth: 0.4,
            target: 'fold',
            sub: {
              enabled: true,
              shape: 'sine',
              rate: 0.06,
              depth: 0.55,
              target: 'rate',
            },
          },
          { enabled: false },
          { enabled: false },
        ],
      });
    case 'complex':
      return createDefaultMutators({
        enabled: true,
        morphRate: 0.7,
        lfos: [
          {
            enabled: true,
            shape: 'custom',
            formula: 'sin(x)+0.35*sin(3*x)',
            rate: 0.14,
            depth: 0.38,
            target: 'phase',
            sub: {
              enabled: true,
              shape: 'triangle',
              rate: 0.05,
              depth: 0.5,
              target: 'both',
            },
          },
          {
            enabled: true,
            shape: 'saw',
            rate: 0.09,
            depth: 0.28,
            target: 'fold',
            sub: {
              enabled: true,
              shape: 'sine',
              rate: 0.03,
              depth: 0.45,
              target: 'depth',
            },
          },
          {
            enabled: true,
            shape: 'square',
            rate: 0.04,
            depth: 0.18,
            target: 'amp',
            sub: {
              enabled: true,
              shape: 'custom',
              formula: 'tanh(2*sin(x))',
              rate: 0.025,
              depth: 0.4,
              target: 'rate',
            },
          },
        ],
      });
  }
}
