/** Wave shapes beyond native OscillatorType, built as PeriodicWave. */
export type WaveId =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'pulse'
  | 'fold'
  | 'random'
  | 'samplehold';

const NATIVE: ReadonlySet<string> = new Set([
  'sine',
  'square',
  'sawtooth',
  'triangle',
]);

const SIZE = 2048;

function realImagFromSamples(samples: Float32Array): {
  real: Float32Array;
  imag: Float32Array;
} {
  // DFT for PeriodicWave (cosine/sine coeffs). Skip DC imag; real[0]=0 for zero-mean.
  const n = samples.length;
  const harm = Math.min(256, Math.floor(n / 2));
  const real = new Float32Array(harm);
  const imag = new Float32Array(harm);
  for (let k = 1; k < harm; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * k * i) / n;
      re += samples[i]! * Math.cos(ang);
      im += samples[i]! * Math.sin(ang);
    }
    real[k] = (2 * re) / n;
    imag[k] = (-2 * im) / n;
  }
  return { real, imag };
}

function pulseSamples(pw: number): Float32Array {
  const duty = Math.min(0.95, Math.max(0.05, pw));
  const out = new Float32Array(SIZE);
  const edge = Math.floor(duty * SIZE);
  for (let i = 0; i < SIZE; i++) {
    out[i] = i < edge ? 1 : -1;
  }
  return out;
}

function foldSamples(): Float32Array {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    const t = (i / SIZE) * Math.PI * 2;
    let s = Math.sin(t) * 2.4;
    // Simple wavefolder
    while (s > 1 || s < -1) {
      if (s > 1) s = 2 - s;
      if (s < -1) s = -2 - s;
    }
    out[i] = s;
  }
  return out;
}

function randomSamples(seed = 1): Float32Array {
  const out = new Float32Array(SIZE);
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  // Smooth-ish by interpolating sparse breakpoints
  const pts = 32;
  const knots = new Float32Array(pts + 1);
  for (let i = 0; i <= pts; i++) knots[i] = rand() * 2 - 1;
  for (let i = 0; i < SIZE; i++) {
    const x = (i / SIZE) * pts;
    const j = Math.floor(x);
    const f = x - j;
    const a = knots[j]!;
    const b = knots[Math.min(pts, j + 1)]!;
    // smoothstep
    const u = f * f * (3 - 2 * f);
    out[i] = a + (b - a) * u;
  }
  return out;
}

function sampleHoldSamples(seed = 2): Float32Array {
  const out = new Float32Array(SIZE);
  let s = seed >>> 0 || 2;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
  const steps = 16;
  const stepLen = SIZE / steps;
  for (let i = 0; i < steps; i++) {
    const v = rand();
    const start = Math.floor(i * stepLen);
    const end = Math.floor((i + 1) * stepLen);
    for (let j = start; j < end; j++) out[j] = v;
  }
  return out;
}

const waveCache = new Map<string, PeriodicWave>();

function cacheKey(id: WaveId, pw: number): string {
  if (id === 'pulse') return `pulse:${pw.toFixed(3)}`;
  return id;
}

export function makePeriodicWave(
  ctx: BaseAudioContext,
  id: WaveId,
  pulseWidth = 0.5,
): PeriodicWave {
  const key = cacheKey(id, pulseWidth);
  const cached = waveCache.get(key);
  if (cached) return cached;

  let samples: Float32Array;
  switch (id) {
    case 'pulse':
      samples = pulseSamples(pulseWidth);
      break;
    case 'fold':
      samples = foldSamples();
      break;
    case 'random':
      samples = randomSamples(7);
      break;
    case 'samplehold':
      samples = sampleHoldSamples(11);
      break;
    default:
      samples = pulseSamples(0.5);
  }
  const { real, imag } = realImagFromSamples(samples);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(key, wave);
  return wave;
}

/** Apply native type or PeriodicWave. Returns true if custom wave used. */
export function applyWave(
  osc: OscillatorNode,
  ctx: BaseAudioContext,
  waveId: string,
  pulseWidth = 0.5,
): void {
  const id = waveId as WaveId;
  if (NATIVE.has(id)) {
    osc.type = id as OscillatorType;
    return;
  }
  if (
    id === 'pulse' ||
    id === 'fold' ||
    id === 'random' ||
    id === 'samplehold'
  ) {
    osc.setPeriodicWave(makePeriodicWave(ctx, id, pulseWidth));
    return;
  }
  osc.type = 'sine';
}

export function isNativeWave(waveId: string): boolean {
  return NATIVE.has(waveId);
}
