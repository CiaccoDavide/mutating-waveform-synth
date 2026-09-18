import { TABLE_SIZE } from './FormulaCompiler';

export interface WavePoint {
  phase: number; // [0, 2π)
  amp: number; // [-1, 1]
}

export type ConnectMode = 'linear' | 'smooth' | 'steps';

export const CONNECT_MODES: { id: ConnectMode; name: string }[] = [
  { id: 'linear', name: 'Linear' },
  { id: 'smooth', name: 'Smooth' },
  { id: 'steps', name: 'Steps' },
];

const TAU = Math.PI * 2;

export function clampAmp(amp: number): number {
  return Math.max(-1, Math.min(1, amp));
}

export function wrapPhase(phase: number): number {
  let p = phase % TAU;
  if (p < 0) p += TAU;
  return p;
}

export function normalizePoints(points: WavePoint[]): WavePoint[] {
  return points
    .map((p) => ({ phase: wrapPhase(p.phase), amp: clampAmp(p.amp) }))
    .sort((a, b) => a.phase - b.phase);
}

/** Seed control points from a baked wavetable (uniform phase samples). */
export function pointsFromSamples(
  samples: Float32Array,
  count = 8,
): WavePoint[] {
  const n = samples.length;
  if (n < 2) {
    return [
      { phase: 0, amp: 0 },
      { phase: Math.PI, amp: 0 },
    ];
  }
  const pts: WavePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor((i / count) * n) % n;
    pts.push({
      phase: (i / count) * TAU,
      amp: clampAmp(samples[idx] ?? 0),
    });
  }
  return pts;
}

export function defaultSketchPoints(): WavePoint[] {
  return [
    { phase: 0, amp: 0 },
    { phase: Math.PI * 0.5, amp: 1 },
    { phase: Math.PI, amp: 0 },
    { phase: Math.PI * 1.5, amp: -1 },
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Periodic index into sorted points. */
function at(pts: WavePoint[], i: number): WavePoint {
  const n = pts.length;
  const j = ((i % n) + n) % n;
  return pts[j]!;
}

/**
 * Find segment for phase p in sorted points [0, 2π).
 * Returns i such that p is between pts[i] and pts[i+1] (wrapping).
 */
function segmentIndex(pts: WavePoint[], p: number): number {
  const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]!.phase;
    const b = i + 1 < n ? pts[i + 1]!.phase : pts[0]!.phase + TAU;
    const pb = p < a ? p + TAU : p;
    if (pb >= a && pb < b) return i;
  }
  return n - 1;
}

function sampleLinear(pts: WavePoint[], phase: number): number {
  const n = pts.length;
  if (n === 0) return 0;
  if (n === 1) return pts[0]!.amp;
  const i = segmentIndex(pts, phase);
  const a = at(pts, i);
  const b = at(pts, i + 1);
  let aPh = a.phase;
  let bPh = b.phase;
  let p = phase;
  if (bPh <= aPh) bPh += TAU;
  if (p < aPh) p += TAU;
  const t = (p - aPh) / Math.max(1e-9, bPh - aPh);
  return lerp(a.amp, b.amp, t);
}

function sampleSteps(pts: WavePoint[], phase: number): number {
  const n = pts.length;
  if (n === 0) return 0;
  if (n === 1) return pts[0]!.amp;
  const i = segmentIndex(pts, phase);
  return at(pts, i).amp;
}

/** Catmull-Rom periodic, uniform parameterization in phase. */
function sampleSmooth(pts: WavePoint[], phase: number): number {
  const n = pts.length;
  if (n === 0) return 0;
  if (n === 1) return pts[0]!.amp;
  if (n === 2) return sampleLinear(pts, phase);

  const i = segmentIndex(pts, phase);
  const p0 = at(pts, i - 1);
  const p1 = at(pts, i);
  const p2 = at(pts, i + 1);
  const p3 = at(pts, i + 2);

  let aPh = p1.phase;
  let bPh = p2.phase;
  let p = phase;
  if (bPh <= aPh) bPh += TAU;
  if (p < aPh) p += TAU;
  const t = (p - aPh) / Math.max(1e-9, bPh - aPh);

  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1.amp +
      (-p0.amp + p2.amp) * t +
      (2 * p0.amp - 5 * p1.amp + 4 * p2.amp - p3.amp) * t2 +
      (-p0.amp + 3 * p1.amp - 3 * p2.amp + p3.amp) * t3)
  );
}

export function evalSketch(
  points: WavePoint[],
  mode: ConnectMode,
  phase: number,
): number {
  const pts = normalizePoints(points);
  if (pts.length === 0) return 0;
  const p = wrapPhase(phase);
  switch (mode) {
    case 'steps':
      return clampAmp(sampleSteps(pts, p));
    case 'smooth':
      return clampAmp(sampleSmooth(pts, p));
    case 'linear':
    default:
      return clampAmp(sampleLinear(pts, p));
  }
}

export function sampleSketch(
  points: WavePoint[],
  mode: ConnectMode,
  size = TABLE_SIZE,
): Float32Array {
  const table = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    const x = (i / size) * TAU;
    table[i] = evalSketch(points, mode, x);
  }
  return table;
}

function fmtCoef(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  if (Object.is(r, -0)) return '0';
  return String(r);
}

function fmtPhase(p: number): string {
  // Prefer symbolic constants so edges land exactly on bakeWavetable phases
  if (Math.abs(p) < 1e-10) return '0';
  if (Math.abs(p - Math.PI) < 1e-6) return 'pi';
  if (Math.abs(p - Math.PI * 2) < 1e-6) return 'tau';
  if (Math.abs(p - Math.PI / 2) < 1e-6) return 'pi/2';
  if (Math.abs(p - (Math.PI * 3) / 2) < 1e-6) return '3*pi/2';
  const r = Math.round(p * 1e6) / 1e6;
  return String(r);
}

/** Mask that is 1 on half-open circular interval [a, b) in [0, 2π). */
function segmentMask(a: number, b: number): string {
  const A = fmtPhase(a);
  const B = fmtPhase(b);
  if (b > a + 1e-12) {
    return `(step(${A},x)-step(${B},x))`;
  }
  // Wrap across 0: [a, τ) ∪ [0, b)
  return `(step(${A},x)+(1-step(${B},x)))`;
}

function stepsExpression(pts: WavePoint[]): string {
  if (pts.length === 0) return '0';
  if (pts.length === 1) return fmtCoef(pts[0]!.amp);

  const parts: string[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const cur = pts[i]!;
    const end = i + 1 < pts.length ? pts[i + 1]!.phase : pts[0]!.phase;
    if (Math.abs(cur.amp) < 1e-9) continue;
    parts.push(`${fmtCoef(cur.amp)}*${segmentMask(cur.phase, end)}`);
  }
  if (parts.length === 0) return '0';
  return parts.join('+');
}

function linearExpression(pts: WavePoint[]): string {
  if (pts.length === 0) return '0';
  if (pts.length === 1) return fmtCoef(pts[0]!.amp);

  const parts: string[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const cur = pts[i]!;
    const next = pts[(i + 1) % pts.length]!;
    const a = cur.phase;
    const end = i + 1 < pts.length ? next.phase : pts[0]!.phase;
    const wrap = i + 1 >= pts.length;
    const span = wrap ? TAU - a + end : end - a;
    if (span < 1e-9) continue;

    const mask = segmentMask(a, end);
    const ya = fmtCoef(cur.amp);
    const yb = fmtCoef(next.amp);
    const A = fmtPhase(a);
    const Span = fmtPhase(span);

    const tExpr = wrap
      ? `clamp(mod(x-${A}+${fmtPhase(TAU)},${fmtPhase(TAU)})/${Span},0,1)`
      : `clamp((x-${A})/${Span},0,1)`;

    parts.push(`lerp(${ya},${yb},${tExpr})*${mask}`);
  }
  if (parts.length === 0) return '0';
  return parts.join('+');
}

/**
 * Real DFT → truncated Fourier series expression in `x` (phase 0…2π).
 * Used for Smooth mode (no compact closed form for Catmull-Rom).
 */
export function fourierExpression(
  samples: Float32Array,
  harmonics = 24,
): string {
  const N = samples.length;
  if (N < 2) return '0';

  const maxH = Math.min(harmonics, Math.floor(N / 2) - 1);
  const terms: string[] = [];

  let a0 = 0;
  for (let i = 0; i < N; i += 1) a0 += samples[i]!;
  a0 /= N;
  if (Math.abs(a0) >= 0.001) {
    terms.push(fmtCoef(a0));
  }

  for (let k = 1; k <= maxH; k += 1) {
    let cosSum = 0;
    let sinSum = 0;
    for (let i = 0; i < N; i += 1) {
      const x = (i / N) * TAU;
      const y = samples[i]!;
      cosSum += y * Math.cos(k * x);
      sinSum += y * Math.sin(k * x);
    }
    const ak = (2 / N) * cosSum;
    const bk = (2 / N) * sinSum;

    if (Math.abs(ak) >= 0.001) {
      const c = fmtCoef(ak);
      const mag = Math.abs(ak);
      const body = k === 1 ? 'cos(x)' : `cos(${k}*x)`;
      if (terms.length === 0) {
        terms.push(ak < 0 ? `-${fmtCoef(mag)}*${body}` : `${c}*${body}`);
      } else {
        terms.push(ak < 0 ? `- ${fmtCoef(mag)}*${body}` : `+ ${c}*${body}`);
      }
    }
    if (Math.abs(bk) >= 0.001) {
      const mag = Math.abs(bk);
      const body = k === 1 ? 'sin(x)' : `sin(${k}*x)`;
      if (terms.length === 0) {
        terms.push(bk < 0 ? `-${fmtCoef(mag)}*${body}` : `${fmtCoef(bk)}*${body}`);
      } else {
        terms.push(bk < 0 ? `- ${fmtCoef(mag)}*${body}` : `+ ${fmtCoef(bk)}*${body}`);
      }
    }
  }

  if (terms.length === 0) return '0';
  return terms.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Sketch → formula.
 * - approximate: always Fourier series
 * - exact: Steps/Linear piecewise; Smooth still Fourier (no closed form)
 */
export function sketchToExpression(
  points: WavePoint[],
  mode: ConnectMode,
  options: { approximate?: boolean; harmonics?: number; size?: number } = {},
): string {
  const {
    approximate = false,
    harmonics = 24,
    size = TABLE_SIZE,
  } = options;

  const pts = normalizePoints(points);
  if (pts.length === 0) return '0';

  if (!approximate) {
    if (mode === 'steps') return stepsExpression(pts);
    if (mode === 'linear') return linearExpression(pts);
  }

  const samples = sampleSketch(pts, mode, size);
  return fourierExpression(samples, harmonics);
}
