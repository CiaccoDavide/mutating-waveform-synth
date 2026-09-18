import {
  createDefaultEffects,
  createDefaultLadder,
  type DelayAlgorithm,
  type EffectsState,
  type LadderState,
  type ReverbAlgorithm,
} from './EffectsModel';

type ChorusNodes = {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  delays: DelayNode[];
  taps: GainNode[];
  pans: StereoPannerNode[];
  lfos: OscillatorNode[];
  lfoGains: GainNode[];
  feedback: GainNode;
};

type DelayNodes = {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  delayL: DelayNode;
  delayR: DelayNode;
  feedbackL: GainNode;
  feedbackR: GainNode;
  tone: BiquadFilterNode;
  shaper: WaveShaperNode;
  merger: ChannelMergerNode;
  splitter: ChannelSplitterNode;
  algorithm: DelayAlgorithm;
};

type ReverbNodes = {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  preDelay: DelayNode;
  worklet: AudioWorkletNode;
  algorithm: ReverbAlgorithm;
};

/** Builds and updates post-filter FX: ladder → chorus → delay → reverb */
export class FxGraph {
  private ctx: AudioContext | null = null;
  private ladder: AudioWorkletNode | null = null;
  private chorus: ChorusNodes | null = null;
  private delayFx: DelayNodes | null = null;
  private reverb: ReverbNodes | null = null;
  private entry: GainNode | null = null;
  private exit: GainNode | null = null;

  private ladderState = createDefaultLadder();
  private effects = createDefaultEffects();

  /** Connect F2 → this.entry; this.exit → master */
  get input(): AudioNode | null {
    return this.entry;
  }

  get output(): AudioNode | null {
    return this.exit;
  }

  async init(ctx: AudioContext): Promise<void> {
    this.ctx = ctx;
    const base = import.meta.env.BASE_URL;
    await Promise.all([
      ctx.audioWorklet.addModule(`${base}worklets/ladder-filter-processor.js`),
      ctx.audioWorklet.addModule(`${base}worklets/reverb-processor.js`),
    ]);

    this.entry = ctx.createGain();
    this.entry.gain.value = 1;
    this.exit = ctx.createGain();
    this.exit.gain.value = 1;

    this.ladder = new AudioWorkletNode(ctx, 'ladder-filter-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    });

    this.chorus = this.buildChorus(ctx);
    this.delayFx = this.buildDelay(ctx, 'digital');
    this.reverb = this.buildReverb(ctx, 'hall');

    // entry → ladder → chorus → delay → reverb → exit
    this.entry.connect(this.ladder);
    this.ladder.connect(this.chorus.input);
    this.chorus.output.connect(this.delayFx.input);
    this.delayFx.output.connect(this.reverb.input);
    this.reverb.output.connect(this.exit);

    this.applyLadder(this.ladderState);
    this.applyEffects(this.effects);
  }

  dispose(): void {
    this.stopChorusLfos();
    this.ladder = null;
    this.chorus = null;
    this.delayFx = null;
    this.reverb = null;
    this.entry = null;
    this.exit = null;
    this.ctx = null;
  }

  setLadder(state: LadderState) {
    this.ladderState = { ...state };
    this.applyLadder(state);
  }

  setEffects(effects: EffectsState) {
    const prevDelayAlgo = this.effects.delay.params.algorithm;
    const prevReverbAlgo = this.effects.reverb.params.algorithm;
    this.effects = {
      chorus: { ...effects.chorus, params: { ...effects.chorus.params } },
      delay: { ...effects.delay, params: { ...effects.delay.params } },
      reverb: { ...effects.reverb, params: { ...effects.reverb.params } },
    };

    if (
      this.ctx &&
      this.delayFx &&
      effects.delay.params.algorithm !== prevDelayAlgo
    ) {
      this.rebuildDelay(effects.delay.params.algorithm);
    }
    if (
      this.ctx &&
      this.reverb &&
      effects.reverb.params.algorithm !== prevReverbAlgo
    ) {
      this.reverb.worklet.port.postMessage({
        type: 'algorithm',
        algorithm: effects.reverb.params.algorithm,
      });
      this.reverb.algorithm = effects.reverb.params.algorithm;
    }

    this.applyEffects(this.effects);
  }

  private applyLadder(state: LadderState) {
    if (!this.ctx || !this.ladder) return;
    const now = this.ctx.currentTime;
    const on = state.enabled ? 1 : 0;
    this.ladder.parameters.get('enabled')?.setTargetAtTime(on, now, 0.02);
    this.ladder.parameters
      .get('cutoff')
      ?.setTargetAtTime(
        Math.min(16000, Math.max(40, state.cutoff)),
        now,
        0.03,
      );
    this.ladder.parameters
      .get('resonance')
      ?.setTargetAtTime(Math.min(1, Math.max(0, state.resonance)), now, 0.03);
    this.ladder.parameters
      .get('drive')
      ?.setTargetAtTime(Math.min(1, Math.max(0, state.drive)), now, 0.03);
  }

  private applyEffects(effects: EffectsState) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.applyChorus(effects.chorus, now);
    this.applyDelay(effects.delay, now);
    this.applyReverb(effects.reverb, now);
  }

  private applyChorus(
    chorus: EffectsState['chorus'],
    now: number,
  ) {
    const nodes = this.chorus;
    if (!nodes) return;
    const wet = chorus.enabled ? chorus.mix : 0;
    const dry = 1 - wet * 0.85;
    nodes.wet.gain.setTargetAtTime(wet, now, 0.04);
    nodes.dry.gain.setTargetAtTime(dry, now, 0.04);

    const depth = 0.001 + chorus.params.depth * 0.004;
    const rate = Math.max(0.05, chorus.params.rate);
    const width = chorus.params.stereoWidth;
    const nVoices = Math.min(4, Math.max(2, Math.round(chorus.params.voices)));

    for (let i = 0; i < nodes.lfos.length; i += 1) {
      const lfo = nodes.lfos[i]!;
      const lfoGain = nodes.lfoGains[i]!;
      const tap = nodes.taps[i]!;
      const pan = nodes.pans[i]!;
      const active = chorus.enabled && i < nVoices;
      lfo.frequency.setTargetAtTime(rate * (0.85 + i * 0.12), now, 0.05);
      lfoGain.gain.setTargetAtTime(active ? depth : 0, now, 0.05);
      tap.gain.setTargetAtTime(active ? 1 / nVoices : 0, now, 0.05);
      pan.pan.setTargetAtTime(
        active ? ((i / Math.max(1, nVoices - 1)) * 2 - 1) * width : 0,
        now,
        0.05,
      );
    }
    nodes.feedback.gain.setTargetAtTime(
      chorus.enabled ? chorus.params.feedback * 0.45 : 0,
      now,
      0.05,
    );
  }

  private applyDelay(delay: EffectsState['delay'], now: number) {
    const nodes = this.delayFx;
    if (!nodes) return;
    const wet = delay.enabled ? delay.mix : 0;
    nodes.wet.gain.setTargetAtTime(wet, now, 0.04);
    nodes.dry.gain.setTargetAtTime(1 - wet * 0.5, now, 0.04);

    const t = Math.min(1.5, Math.max(0.01, delay.params.timeMs / 1000));
    nodes.delayL.delayTime.setTargetAtTime(t, now, 0.05);
    const tR =
      delay.params.algorithm === 'pingpong' ? t * 0.98 : t * 0.997;
    nodes.delayR.delayTime.setTargetAtTime(tR, now, 0.05);

    const fb = delay.enabled
      ? Math.min(0.92, Math.max(0, delay.params.feedback))
      : 0;
    nodes.feedbackL.gain.setTargetAtTime(fb, now, 0.05);
    nodes.feedbackR.gain.setTargetAtTime(
      delay.params.algorithm === 'pingpong' ? fb : fb * 0.95,
      now,
      0.05,
    );
    nodes.tone.frequency.setTargetAtTime(
      Math.min(12000, Math.max(200, delay.params.tone)),
      now,
      0.05,
    );
    // Tape: shaper already in path; digital/pingpong use milder curve via gain
  }

  private applyReverb(reverb: EffectsState['reverb'], now: number) {
    const nodes = this.reverb;
    if (!nodes) return;
    const wet = reverb.enabled ? reverb.mix : 0;
    nodes.wet.gain.setTargetAtTime(wet, now, 0.05);
    nodes.dry.gain.setTargetAtTime(1 - wet * 0.7, now, 0.05);
    nodes.preDelay.delayTime.setTargetAtTime(
      Math.min(0.2, Math.max(0, reverb.params.preDelayMs / 1000)),
      now,
      0.05,
    );
    const en = reverb.enabled ? 1 : 0;
    nodes.worklet.parameters.get('enabled')?.setTargetAtTime(en, now, 0.03);
    nodes.worklet.parameters
      .get('size')
      ?.setTargetAtTime(reverb.params.size, now, 0.05);
    nodes.worklet.parameters
      .get('decay')
      ?.setTargetAtTime(reverb.params.decay, now, 0.05);
    nodes.worklet.parameters
      .get('damping')
      ?.setTargetAtTime(reverb.params.damping, now, 0.05);
  }

  private buildChorus(ctx: AudioContext): ChorusNodes {
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
    const pans: StereoPannerNode[] = [];
    const lfos: OscillatorNode[] = [];
    const lfoGains: GainNode[] = [];

    for (let i = 0; i < 4; i += 1) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.012 + i * 0.003;
      const tap = ctx.createGain();
      tap.gain.value = 0;
      const pan = ctx.createStereoPanner();
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      feedback.connect(delay);
      delay.connect(tap);
      tap.connect(pan);
      pan.connect(wet);
      pan.connect(feedback);

      delays.push(delay);
      taps.push(tap);
      pans.push(pan);
      lfos.push(lfo);
      lfoGains.push(lfoGain);
    }

    wet.connect(output);
    return {
      input,
      dry,
      wet,
      output,
      delays,
      taps,
      pans,
      lfos,
      lfoGains,
      feedback,
    };
  }

  private buildDelay(ctx: AudioContext, algorithm: DelayAlgorithm): DelayNodes {
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const output = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const delayL = ctx.createDelay(2);
    const delayR = ctx.createDelay(2);
    delayL.delayTime.value = 0.32;
    delayR.delayTime.value = 0.32;
    const feedbackL = ctx.createGain();
    const feedbackR = ctx.createGain();
    feedbackL.gain.value = 0;
    feedbackR.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.makeTapeCurve(algorithm === 'tape' ? 2.5 : 1.1);

    input.connect(dry);
    dry.connect(output);

    input.connect(tone);
    tone.connect(shaper);
    shaper.connect(splitter);
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(feedbackL);
    delayR.connect(feedbackR);

    if (algorithm === 'pingpong') {
      feedbackL.connect(delayR);
      feedbackR.connect(delayL);
    } else {
      feedbackL.connect(delayL);
      feedbackR.connect(delayR);
    }

    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);
    merger.connect(wet);
    wet.connect(output);

    return {
      input,
      dry,
      wet,
      output,
      delayL,
      delayR,
      feedbackL,
      feedbackR,
      tone,
      shaper,
      merger,
      splitter,
      algorithm,
    };
  }

  private rebuildDelay(algorithm: DelayAlgorithm) {
    if (!this.ctx || !this.chorus || !this.reverb || !this.delayFx) return;
    const ctx = this.ctx;
    // Disconnect old delay
    try {
      this.chorus.output.disconnect();
      this.delayFx.output.disconnect();
    } catch {
      /* ignore */
    }
    this.delayFx = this.buildDelay(ctx, algorithm);
    this.chorus.output.connect(this.delayFx.input);
    this.delayFx.output.connect(this.reverb.input);
  }

  private buildReverb(
    ctx: AudioContext,
    algorithm: ReverbAlgorithm,
  ): ReverbNodes {
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const output = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;
    const preDelay = ctx.createDelay(0.25);
    preDelay.delayTime.value = 0.025;

    const worklet = new AudioWorkletNode(ctx, 'reverb-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    });
    worklet.port.postMessage({ type: 'algorithm', algorithm });

    input.connect(dry);
    dry.connect(output);
    input.connect(preDelay);
    preDelay.connect(worklet);
    worklet.connect(wet);
    wet.connect(output);

    return {
      input,
      dry,
      wet,
      output,
      preDelay,
      worklet,
      algorithm,
    };
  }

  private makeTapeCurve(amount: number): Float32Array {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  private stopChorusLfos() {
    if (!this.chorus) return;
    for (const lfo of this.chorus.lfos) {
      try {
        lfo.stop();
        lfo.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}
