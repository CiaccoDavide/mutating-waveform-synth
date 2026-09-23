import { clamp } from '../modules/types';

export type ModTarget = {
  /** Connect CV or audio modulation here */
  cvIn: AudioNode;
  /** Destination AudioParam (knob base + mod sum into this) */
  param: AudioParam;
  setBase: (v: number) => void;
  getBase: () => number;
  /** Sample DC level including modulation (for trigger-time reads) */
  read: () => number;
  dispose: () => void;
};

/**
 * Knob base + CV/audio → AudioParam.
 * value ≈ map(base) + signal * (map(max) - map(min))
 */
export function createModTarget(
  ctx: AudioContext,
  opts: {
    min: number;
    max: number;
    initial: number;
    destination: AudioParam;
    /** Map knob units → AudioParam units (e.g. ms → sec) */
    map?: (v: number) => number;
  },
): ModTarget {
  const map = opts.map ?? ((v: number) => v);
  const minA = map(opts.min);
  const maxA = map(opts.max);
  const span = Math.max(1e-9, maxA - minA);

  const dest = opts.destination;
  dest.value = 0;

  const base = ctx.createConstantSource();
  base.offset.value = map(clamp(opts.initial, opts.min, opts.max));
  base.start();

  const scale = ctx.createGain();
  scale.gain.value = span;

  const summer = ctx.createGain();
  summer.gain.value = 1;

  base.connect(dest);
  scale.connect(dest);
  base.connect(summer);
  scale.connect(summer);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  summer.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  return {
    cvIn: scale,
    param: dest,
    setBase: (v) => {
      const mapped = map(clamp(v, opts.min, opts.max));
      base.offset.setTargetAtTime(mapped, ctx.currentTime, 0.01);
    },
    getBase: () => base.offset.value,
    read: () => {
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i]!;
      return s / buf.length;
    },
    dispose: () => {
      try {
        base.stop();
      } catch {
        /* */
      }
      base.disconnect();
      scale.disconnect();
      summer.disconnect();
      analyser.disconnect();
    },
  };
}

/** Standalone readable DC control (no external AudioParam). */
export function createModControl(
  ctx: AudioContext,
  opts: { min: number; max: number; initial: number },
): ModTarget {
  const g = ctx.createGain();
  g.gain.value = 0;
  return createModTarget(ctx, {
    ...opts,
    destination: g.gain,
  });
}
