import { compileFormula, type SampleFn } from './FormulaCompiler';
import { evalShape, LFO_SHAPES, type LfoShape } from './LfoModel';

export type FilterMode =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'notch'
  | 'peaking'
  | 'lowshelf'
  | 'highshelf';

export interface FilterModeOption {
  id: FilterMode;
  name: string;
  usesGain: boolean;
}

export const FILTER_MODES: FilterModeOption[] = [
  { id: 'lowpass', name: 'Lowpass', usesGain: false },
  { id: 'highpass', name: 'Highpass', usesGain: false },
  { id: 'bandpass', name: 'Bandpass', usesGain: false },
  { id: 'notch', name: 'Notch', usesGain: false },
  { id: 'peaking', name: 'Peak', usesGain: true },
  { id: 'lowshelf', name: 'Low Shelf', usesGain: true },
  { id: 'highshelf', name: 'High Shelf', usesGain: true },
];

export const FILTER_COUNT = 3;

/** Per-parameter LFO (no sub-LFO): modulates a base slider value */
export interface ParamLfo {
  enabled: boolean;
  shape: LfoShape;
  formula: string;
  rate: number;
  depth: number;
}

export interface FilterState {
  enabled: boolean;
  mode: FilterMode;
  /** Base cutoff / center frequency in Hz */
  cutoff: number;
  /** Base resonance / Q */
  q: number;
  /** Base gain in dB for peak / shelf modes */
  gainDb: number;
  cutoffLfo: ParamLfo;
  qLfo: ParamLfo;
  gainLfo: ParamLfo;
}

export interface ResolvedFilterParams {
  cutoff: number;
  q: number;
  gainDb: number;
}

export function createDefaultParamLfo(overrides: Partial<ParamLfo> = {}): ParamLfo {
  return {
    enabled: false,
    shape: 'sine',
    formula: 'sin(x)',
    rate: 0.1,
    depth: 0.35,
    ...overrides,
  };
}

export function createDefaultFilter(
  index: number,
  overrides: Partial<Omit<FilterState, 'cutoffLfo' | 'qLfo' | 'gainLfo'>> & {
    cutoffLfo?: Partial<ParamLfo>;
    qLfo?: Partial<ParamLfo>;
    gainLfo?: Partial<ParamLfo>;
  } = {},
): FilterState {
  const defaults: Array<Partial<FilterState>> = [
    { enabled: true, mode: 'lowpass', cutoff: 2400, q: 0.7, gainDb: 0 },
    { enabled: false, mode: 'highpass', cutoff: 180, q: 0.6, gainDb: 0 },
    { enabled: false, mode: 'peaking', cutoff: 800, q: 1.2, gainDb: 3 },
  ];
  const base = defaults[index] ?? defaults[0]!;
  const { cutoffLfo, qLfo, gainLfo, ...rest } = overrides;
  return {
    enabled: base.enabled ?? false,
    mode: (base.mode as FilterMode) ?? 'lowpass',
    cutoff: base.cutoff ?? 1000,
    q: base.q ?? 0.7,
    gainDb: base.gainDb ?? 0,
    ...rest,
    cutoffLfo: createDefaultParamLfo(cutoffLfo),
    qLfo: createDefaultParamLfo(qLfo),
    gainLfo: createDefaultParamLfo(gainLfo),
  };
}

export function createDefaultFilterBank(): FilterState[] {
  return Array.from({ length: FILTER_COUNT }, (_, i) => createDefaultFilter(i));
}

export const DEFAULT_FILTER_BANK = createDefaultFilterBank();

/** @deprecated use DEFAULT_FILTER_BANK[0] */
export const DEFAULT_FILTER = DEFAULT_FILTER_BANK[0]!;

export function filterModeUsesGain(mode: FilterMode): boolean {
  return FILTER_MODES.find((m) => m.id === mode)?.usesGain ?? false;
}

export function sliderToCutoff(t: number, min = 40, max = 16000): number {
  const clamped = Math.min(1, Math.max(0, t));
  return min * Math.pow(max / min, clamped);
}

export function cutoffToSlider(hz: number, min = 40, max = 16000): number {
  const v = Math.min(max, Math.max(min, hz));
  return Math.log(v / min) / Math.log(max / min);
}

export function formatCutoff(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${Math.round(hz)} Hz`;
}

function compileParamShape(lfo: ParamLfo): SampleFn | null {
  if (!lfo.enabled || lfo.shape !== 'custom') return null;
  const result = compileFormula(lfo.formula);
  return result.ok ? result.fn : null;
}

function sampleParamLfo(lfo: ParamLfo, t: number, customFn: SampleFn | null): number {
  if (!lfo.enabled) return 0;
  return evalShape(lfo.shape, t * lfo.rate, customFn) * lfo.depth;
}

export function resolveFilterParams(filter: FilterState, t: number): ResolvedFilterParams {
  const cutoffFn = compileParamShape(filter.cutoffLfo);
  const qFn = compileParamShape(filter.qLfo);
  const gainFn = compileParamShape(filter.gainLfo);

  const cutoffMod = sampleParamLfo(filter.cutoffLfo, t, cutoffFn);
  const qMod = sampleParamLfo(filter.qLfo, t, qFn);
  const gainMod = sampleParamLfo(filter.gainLfo, t, gainFn);

  const cutoffSlider = cutoffToSlider(filter.cutoff) + cutoffMod * 0.5;
  const cutoff = sliderToCutoff(Math.min(1, Math.max(0, cutoffSlider)));

  const q = Math.min(18, Math.max(0.1, filter.q + qMod * 8));
  const gainDb = Math.min(24, Math.max(-24, filter.gainDb + gainMod * 24));

  return { cutoff, q, gainDb };
}

export function filterBankNeedsTick(filters: FilterState[]): boolean {
  return filters.some(
    (f) =>
      f.enabled &&
      (f.cutoffLfo.enabled || f.qLfo.enabled || f.gainLfo.enabled),
  );
}

export { LFO_SHAPES };
