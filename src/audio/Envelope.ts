export interface AdsrParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const DEFAULT_ADSR: AdsrParams = {
  attack: 0.05,
  decay: 0.2,
  sustain: 0.7,
  release: 0.4,
};

export function triggerAttack(
  param: AudioParam,
  ctx: AudioContext,
  adsr: AdsrParams,
  peak: number,
): void {
  const now = ctx.currentTime;
  const attack = Math.max(0.001, adsr.attack);
  const decay = Math.max(0.001, adsr.decay);
  const sustain = Math.min(1, Math.max(0, adsr.sustain)) * peak;

  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(param.value, 0.0001), now);
  param.linearRampToValueAtTime(peak, now + attack);
  param.linearRampToValueAtTime(Math.max(0.0001, sustain), now + attack + decay);
}

/** Returns audio time when release reaches silence. */
export function triggerRelease(
  param: AudioParam,
  ctx: AudioContext,
  release: number,
): number {
  const now = ctx.currentTime;
  const rel = Math.max(0.001, release);
  const current = Math.max(param.value, 0.0001);
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
  param.linearRampToValueAtTime(0.0001, now + rel);
  return now + rel;
}

export function silenceParam(param: AudioParam, ctx: AudioContext): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(0, now);
}
