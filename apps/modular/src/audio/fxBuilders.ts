/** Mono chorus / delay builders adapted from the main synth FxGraph. */

export type ChorusNodes = {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  delays: DelayNode[];
  taps: GainNode[];
  lfos: OscillatorNode[];
  lfoGains: GainNode[];
  feedback: GainNode;
};

export type DelayNodes = {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  tone: BiquadFilterNode;
};

export function buildChorus(ctx: AudioContext, voices = 2): ChorusNodes {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  dry.gain.value = 1;
  wet.gain.value = 0;

  input.connect(dry);
  dry.connect(output);

  const delays: DelayNode[] = [];
  const taps: GainNode[] = [];
  const lfos: OscillatorNode[] = [];
  const lfoGains: GainNode[] = [];

  for (let i = 0; i < voices; i += 1) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.012 + i * 0.004;
    const tap = ctx.createGain();
    tap.gain.value = 1 / voices;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.8 + i * 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.002;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    input.connect(delay);
    feedback.connect(delay);
    delay.connect(tap);
    tap.connect(wet);
    tap.connect(feedback);

    delays.push(delay);
    taps.push(tap);
    lfos.push(lfo);
    lfoGains.push(lfoGain);
  }

  wet.connect(output);
  return { input, dry, wet, output, delays, taps, lfos, lfoGains, feedback };
}

export function applyChorus(
  nodes: ChorusNodes,
  p: { mix: number; rate: number; depth: number; feedback: number },
  t: number,
) {
  const mix = clamp(p.mix, 0, 1);
  nodes.dry.gain.setTargetAtTime(1 - mix * 0.85, t, 0.02);
  nodes.wet.gain.setTargetAtTime(mix, t, 0.02);
  nodes.feedback.gain.setTargetAtTime(clamp(p.feedback, 0, 0.9), t, 0.02);
  for (let i = 0; i < nodes.lfos.length; i++) {
    nodes.lfos[i]!.frequency.setTargetAtTime(
      clamp(p.rate, 0.05, 8) * (1 + i * 0.12),
      t,
      0.02,
    );
    nodes.lfoGains[i]!.gain.setTargetAtTime(
      0.0005 + clamp(p.depth, 0, 1) * 0.004,
      t,
      0.02,
    );
  }
}

export function disposeChorus(nodes: ChorusNodes) {
  for (const lfo of nodes.lfos) {
    try {
      lfo.stop();
    } catch {
      /* */
    }
    lfo.disconnect();
  }
  for (const n of [
    nodes.input,
    nodes.dry,
    nodes.wet,
    nodes.output,
    nodes.feedback,
    ...nodes.delays,
    ...nodes.taps,
    ...nodes.lfoGains,
  ]) {
    try {
      n.disconnect();
    } catch {
      /* */
    }
  }
}

export function buildMonoDelay(ctx: AudioContext): DelayNodes {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0;

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 4200;
  const delay = ctx.createDelay(2);
  delay.delayTime.value = 0.32;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;

  input.connect(dry);
  dry.connect(output);
  input.connect(tone);
  tone.connect(delay);
  delay.connect(feedback);
  feedback.connect(tone);
  delay.connect(wet);
  wet.connect(output);

  return { input, dry, wet, output, delay, feedback, tone };
}

export function applyDelay(
  nodes: DelayNodes,
  p: { mix: number; timeMs: number; feedback: number; tone: number },
  t: number,
) {
  const mix = clamp(p.mix, 0, 1);
  nodes.dry.gain.setTargetAtTime(1 - mix, t, 0.02);
  nodes.wet.gain.setTargetAtTime(mix, t, 0.02);
  nodes.delay.delayTime.setTargetAtTime(
    clamp(p.timeMs, 20, 1500) / 1000,
    t,
    0.02,
  );
  nodes.feedback.gain.setTargetAtTime(clamp(p.feedback, 0, 0.95), t, 0.02);
  nodes.tone.frequency.setTargetAtTime(clamp(p.tone, 200, 12000), t, 0.02);
}

export function disposeDelay(nodes: DelayNodes) {
  for (const n of [
    nodes.input,
    nodes.dry,
    nodes.wet,
    nodes.output,
    nodes.delay,
    nodes.feedback,
    nodes.tone,
  ]) {
    try {
      n.disconnect();
    } catch {
      /* */
    }
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
