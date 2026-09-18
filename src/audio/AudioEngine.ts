import { VOICE_COUNT, type VoiceState } from './HarmonyModel';
import { TABLE_SIZE } from './FormulaCompiler';
import {
  createDefaultFilterBank,
  FILTER_COUNT,
  resolveFilterParams,
  type FilterState,
} from './FilterModel';

export interface EngineSnapshot {
  timeDomain: Uint8Array;
  frequencyData: Uint8Array;
  bass: number;
  mid: number;
  high: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private analyser: AnalyserNode | null = null;
  private voices: {
    node: AudioWorkletNode;
    panner: StereoPannerNode;
    gain: GainNode;
  }[] = [];
  private workletReady = false;
  private started = false;
  private masterVolume = 0.55;
  private filterStates: FilterState[] = createDefaultFilterBank();
  private timeDomain = new Uint8Array(0);
  private frequencyData = new Uint8Array(0);

  get isStarted() {
    return this.started;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async start(): Promise<void> {
    if (this.started && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;

    await ctx.audioWorklet.addModule('/worklets/wavetable-processor.js');
    this.workletReady = true;

    // Series filter chain: voices → F0 → F1 → F2 → master → analyser
    this.filterNodes = [];
    for (let i = 0; i < FILTER_COUNT; i += 1) {
      this.filterNodes.push(ctx.createBiquadFilter());
    }
    for (let i = 0; i < FILTER_COUNT - 1; i += 1) {
      this.filterNodes[i]!.connect(this.filterNodes[i + 1]!);
    }
    this.applyFiltersAtTime(0);

    const master = ctx.createGain();
    master.gain.value = this.masterVolume;
    this.masterGain = master;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    this.analyser = analyser;
    this.timeDomain = new Uint8Array(analyser.fftSize);
    this.frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const lastFilter = this.filterNodes[FILTER_COUNT - 1]!;
    lastFilter.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    this.voices = [];
    const firstFilter = this.filterNodes[0]!;
    for (let i = 0; i < VOICE_COUNT; i += 1) {
      const node = new AudioWorkletNode(ctx, 'wavetable-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        parameterData: { frequency: 110, gain: 0 },
      });
      const gain = ctx.createGain();
      gain.gain.value = 1;
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      node.connect(gain);
      gain.connect(panner);
      panner.connect(firstFilter);
      this.voices.push({ node, panner, gain });
    }

    this.started = true;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async stop(): Promise<void> {
    if (!this.ctx) return;
    await this.ctx.close();
    this.ctx = null;
    this.masterGain = null;
    this.filterNodes = [];
    this.analyser = null;
    this.voices = [];
    this.started = false;
    this.workletReady = false;
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.masterVolume,
        this.ctx!.currentTime,
        0.03,
      );
    }
  }

  setFilters(states: FilterState[], timeSec = 0) {
    this.filterStates = states.map((s) => ({
      ...s,
      cutoffLfo: { ...s.cutoffLfo },
      qLfo: { ...s.qLfo },
      gainLfo: { ...s.gainLfo },
    }));
    this.applyFiltersAtTime(timeSec);
  }

  /** Push modulated filter params for the current time (seconds). */
  tickFilters(timeSec: number) {
    this.applyFiltersAtTime(timeSec);
  }

  private applyFiltersAtTime(timeSec: number) {
    const ctx = this.ctx;
    if (!ctx || this.filterNodes.length === 0) return;
    const now = ctx.currentTime;

    for (let i = 0; i < FILTER_COUNT; i += 1) {
      const node = this.filterNodes[i];
      const state = this.filterStates[i];
      if (!node || !state) continue;

      if (!state.enabled) {
        node.type = 'allpass';
        node.frequency.setTargetAtTime(1000, now, 0.02);
        node.Q.setTargetAtTime(0.0001, now, 0.02);
        node.gain.setTargetAtTime(0, now, 0.02);
        continue;
      }

      const resolved = resolveFilterParams(state, timeSec);
      node.type = state.mode;
      node.frequency.setTargetAtTime(
        Math.min(16000, Math.max(40, resolved.cutoff)),
        now,
        0.03,
      );
      node.Q.setTargetAtTime(
        Math.min(18, Math.max(0.0001, resolved.q)),
        now,
        0.03,
      );
      node.gain.setTargetAtTime(
        Math.min(24, Math.max(-24, resolved.gainDb)),
        now,
        0.03,
      );
    }
  }

  pushWavetable(samples: Float32Array) {
    if (!this.workletReady) return;
    const copy = samples.length === TABLE_SIZE ? samples : samples.slice(0, TABLE_SIZE);
    for (const voice of this.voices) {
      voice.node.port.postMessage({ type: 'table', samples: copy });
    }
  }

  updateVoices(
    voices: VoiceState[],
    frequencies: number[],
    gainMultipliers?: number[],
  ) {
    if (!this.workletReady) return;
    for (let i = 0; i < this.voices.length; i += 1) {
      const state = voices[i];
      const voice = this.voices[i];
      if (!state || !voice) continue;

      const freq = frequencies[i] ?? 110;
      const active = state.enabled;
      const mult = gainMultipliers?.[i] ?? 1;
      const gain = active ? state.gain * mult : 0;

      const freqParam = voice.node.parameters.get('frequency');
      const gainParam = voice.node.parameters.get('gain');
      if (freqParam && this.ctx) {
        freqParam.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
      }
      if (gainParam && this.ctx) {
        gainParam.setTargetAtTime(gain, this.ctx.currentTime, 0.04);
      }
      voice.node.port.postMessage({
        type: 'params',
        active: active && gain > 0.0001,
        frequency: freq,
        gain,
      });
      voice.panner.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, state.pan)),
        this.ctx!.currentTime,
        0.04,
      );
    }
  }

  getSnapshot(): EngineSnapshot | null {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.timeDomain);
    this.analyser.getByteFrequencyData(this.frequencyData);

    const bins = this.frequencyData;
    const n = bins.length;
    const third = Math.floor(n / 3);
    let bass = 0;
    let mid = 0;
    let high = 0;
    for (let i = 0; i < third; i += 1) bass += bins[i];
    for (let i = third; i < third * 2; i += 1) mid += bins[i];
    for (let i = third * 2; i < n; i += 1) high += bins[i];
    bass /= third * 255;
    mid /= third * 255;
    high /= (n - third * 2) * 255;

    return {
      timeDomain: this.timeDomain,
      frequencyData: this.frequencyData,
      bass,
      mid,
      high,
    };
  }
}

export const audioEngine = new AudioEngine();
