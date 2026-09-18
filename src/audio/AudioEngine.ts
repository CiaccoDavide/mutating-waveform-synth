import { midiToFreq, VOICE_COUNT, type VoiceState } from './HarmonyModel';
import { TABLE_SIZE } from './FormulaCompiler';
import {
  createDefaultFilterBank,
  FILTER_COUNT,
  resolveFilterParams,
  type FilterState,
} from './FilterModel';
import {
  DEFAULT_ADSR,
  silenceParam,
  triggerAttack,
  triggerRelease,
  type AdsrParams,
} from './Envelope';
import {
  createDefaultEffects,
  createDefaultFm,
  createDefaultLadder,
  type EffectsState,
  type FmState,
  type LadderState,
} from './EffectsModel';
import { FxGraph } from './FxGraph';

export type PlayMode = 'drone' | 'adsr';

export interface EngineSnapshot {
  timeDomain: Uint8Array;
  frequencyData: Uint8Array;
  bass: number;
  mid: number;
  high: number;
  rms: number;
  peak: number;
}

interface HeldNote {
  midi: number;
  voiceIndices: number[];
  order: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private fxGraph: FxGraph | null = null;
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
  private ladderState: LadderState = createDefaultLadder();
  private effectsState: EffectsState = createDefaultEffects();
  private fmState: FmState = createDefaultFm();
  private timeDomain = new Uint8Array(0);
  private frequencyData = new Uint8Array(0);
  private voiceActive = new Array<boolean>(VOICE_COUNT).fill(false);
  private peakHold = 0;

  private playMode: PlayMode = 'drone';
  private adsr: AdsrParams = { ...DEFAULT_ADSR };
  private heldNotes = new Map<number, HeldNote>();
  private voiceMidi = new Array<number>(VOICE_COUNT).fill(-1);
  private voiceBaseGain = new Array<number>(VOICE_COUNT).fill(0);
  private noteOrder = 0;
  private freeTimers = new Map<number, number>();

  get isStarted() {
    return this.started;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  getPlayMode() {
    return this.playMode;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getVoiceActivity(): boolean[] {
    return this.voiceActive.slice();
  }

  async start(): Promise<void> {
    if (this.started && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;

    await ctx.audioWorklet.addModule(
      `${import.meta.env.BASE_URL}worklets/wavetable-processor.js`,
    );
    this.workletReady = true;

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

    const fx = new FxGraph();
    await fx.init(ctx);
    this.fxGraph = fx;
    fx.setLadder(this.ladderState);
    fx.setEffects(this.effectsState);

    const lastFilter = this.filterNodes[FILTER_COUNT - 1]!;
    lastFilter.connect(fx.input!);
    fx.output!.connect(master);
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
      gain.gain.value = this.playMode === 'adsr' ? 0 : 1;
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      node.connect(gain);
      gain.connect(panner);
      panner.connect(firstFilter);
      this.voices.push({ node, panner, gain });
    }
    this.pushFm();

    this.started = true;
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async stop(): Promise<void> {
    if (!this.ctx) return;
    this.clearAdsrState();
    this.fxGraph?.dispose();
    this.fxGraph = null;
    await this.ctx.close();
    this.ctx = null;
    this.masterGain = null;
    this.filterNodes = [];
    this.analyser = null;
    this.voices = [];
    this.voiceActive.fill(false);
    this.peakHold = 0;
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

  setLadder(state: LadderState) {
    this.ladderState = { ...state };
    this.fxGraph?.setLadder(state);
  }

  setEffects(effects: EffectsState) {
    this.effectsState = effects;
    this.fxGraph?.setEffects(effects);
  }

  setFm(fm: FmState) {
    this.fmState = { ...fm };
    this.pushFm();
  }

  private pushFm() {
    if (!this.workletReady) return;
    for (const voice of this.voices) {
      voice.node.port.postMessage({
        type: 'fm',
        enabled: this.fmState.enabled,
        ratio: this.fmState.ratio,
        index: this.fmState.index,
      });
    }
  }

  setAdsr(adsr: AdsrParams) {
    this.adsr = { ...adsr };
  }

  setPlayMode(mode: PlayMode) {
    if (this.playMode === mode) return;
    this.playMode = mode;
    if (!this.ctx || !this.workletReady) return;

    if (mode === 'adsr') {
      this.clearAdsrState();
      for (const voice of this.voices) {
        silenceParam(voice.gain.gain, this.ctx);
        const gainParam = voice.node.parameters.get('gain');
        gainParam?.setValueAtTime(0, this.ctx.currentTime);
        voice.node.port.postMessage({ type: 'params', active: false, gain: 0 });
      }
      this.voiceActive.fill(false);
    } else {
      this.releaseAllAdsr(true);
      for (const voice of this.voices) {
        silenceParam(voice.gain.gain, this.ctx);
        voice.gain.gain.setValueAtTime(1, this.ctx.currentTime);
      }
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
    if (!this.workletReady || this.playMode === 'adsr') return;
    for (let i = 0; i < this.voices.length; i += 1) {
      const state = voices[i];
      const voice = this.voices[i];
      if (!state || !voice) continue;

      const freq = frequencies[i] ?? 110;
      const active = state.enabled;
      const mult = gainMultipliers?.[i] ?? 1;
      const gain = active ? state.gain * mult : 0;
      const sounding = active && gain > 0.0001;
      this.voiceActive[i] = sounding;

      const freqParam = voice.node.parameters.get('frequency');
      const gainParam = voice.node.parameters.get('gain');
      if (freqParam && this.ctx) {
        freqParam.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
      }
      if (gainParam && this.ctx) {
        gainParam.setTargetAtTime(gain, this.ctx.currentTime, 0.04);
      }
      voice.gain.gain.setTargetAtTime(1, this.ctx!.currentTime, 0.02);
      voice.node.port.postMessage({
        type: 'params',
        active: sounding,
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

  /**
   * Polyphonic note-on: allocate one voice per interval (relative to midi root).
   */
  adsrNoteOn(
    midi: number,
    velocity: number,
    intervals: number[],
    voiceTemplate: Pick<VoiceState, 'gain' | 'pan'>[],
  ) {
    if (!this.workletReady || !this.ctx || this.playMode !== 'adsr') return;
    if (intervals.length === 0) return;

    // Retrigger same MIDI note
    if (this.heldNotes.has(midi)) {
      this.adsrNoteOff(midi, true);
    }

    const needed = intervals.length;
    this.ensureFreeVoices(needed);

    const free = this.listFreeVoices();
    if (free.length < needed) return;

    const voiceIndices = free.slice(0, needed);
    const vel = Math.min(1, Math.max(0, velocity));
    const peakScale = 0.35 + 0.65 * vel;

    for (let i = 0; i < needed; i += 1) {
      const vi = voiceIndices[i]!;
      const voice = this.voices[vi]!;
      const interval = intervals[i]!;
      const tmpl = voiceTemplate[i] ?? { gain: 0.3, pan: 0 };
      const freq = midiToFreq(midi + interval);
      const oscGain = tmpl.gain * peakScale;

      this.clearFreeTimer(vi);
      this.voiceMidi[vi] = midi;
      this.voiceBaseGain[vi] = oscGain;
      this.voiceActive[vi] = true;

      const freqParam = voice.node.parameters.get('frequency');
      const gainParam = voice.node.parameters.get('gain');
      const now = this.ctx.currentTime;
      freqParam?.setValueAtTime(freq, now);
      gainParam?.setValueAtTime(oscGain, now);
      voice.panner.pan.setValueAtTime(
        Math.max(-1, Math.min(1, tmpl.pan)),
        now,
      );
      voice.node.port.postMessage({
        type: 'params',
        active: true,
        frequency: freq,
        gain: oscGain,
      });
      triggerAttack(voice.gain.gain, this.ctx, this.adsr, 1);
    }

    this.heldNotes.set(midi, {
      midi,
      voiceIndices,
      order: this.noteOrder++,
    });
  }

  adsrNoteOff(midi: number, immediate = false) {
    if (!this.ctx || this.playMode !== 'adsr') return;
    const held = this.heldNotes.get(midi);
    if (!held) return;
    this.heldNotes.delete(midi);

    for (const vi of held.voiceIndices) {
      const voice = this.voices[vi];
      if (!voice) continue;
      if (immediate) {
        silenceParam(voice.gain.gain, this.ctx);
        this.freeVoice(vi);
      } else {
        const end = triggerRelease(voice.gain.gain, this.ctx, this.adsr.release);
        this.scheduleFree(vi, end);
      }
    }
  }

  releaseAllAdsr(immediate = false) {
    const notes = [...this.heldNotes.keys()];
    for (const midi of notes) {
      this.adsrNoteOff(midi, immediate);
    }
    if (immediate) {
      this.clearAdsrState();
      if (this.ctx) {
        for (const voice of this.voices) {
          silenceParam(voice.gain.gain, this.ctx);
        }
      }
    }
  }

  private ensureFreeVoices(needed: number) {
    let free = this.listFreeVoices().length;
    while (free < needed) {
      if (this.heldNotes.size > 0) {
        let oldest: HeldNote | null = null;
        for (const held of this.heldNotes.values()) {
          if (!oldest || held.order < oldest.order) oldest = held;
        }
        if (!oldest) break;
        this.adsrNoteOff(oldest.midi, true);
      } else {
        const busy = this.voiceMidi.findIndex((m) => m !== -1);
        if (busy < 0) break;
        this.freeVoice(busy);
      }
      free = this.listFreeVoices().length;
    }
  }

  private listFreeVoices(): number[] {
    const free: number[] = [];
    for (let i = 0; i < VOICE_COUNT; i += 1) {
      if (this.voiceMidi[i] === -1) free.push(i);
    }
    return free;
  }

  private freeVoice(index: number) {
    this.voiceMidi[index] = -1;
    this.voiceBaseGain[index] = 0;
    this.voiceActive[index] = false;
    this.clearFreeTimer(index);
    const voice = this.voices[index];
    if (voice && this.ctx) {
      voice.node.port.postMessage({
        type: 'params',
        active: false,
        gain: 0,
      });
      const gainParam = voice.node.parameters.get('gain');
      gainParam?.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  private scheduleFree(index: number, endTime: number) {
    this.clearFreeTimer(index);
    const delayMs = Math.max(0, (endTime - (this.ctx?.currentTime ?? 0)) * 1000 + 20);
    const timer = window.setTimeout(() => {
      this.freeTimers.delete(index);
      // Only free if not reassigned
      if (this.voiceMidi[index] !== -1) {
        // still marked — check if still in a held note
        let stillHeld = false;
        for (const held of this.heldNotes.values()) {
          if (held.voiceIndices.includes(index)) {
            stillHeld = true;
            break;
          }
        }
        if (!stillHeld) this.freeVoice(index);
      }
    }, delayMs);
    this.freeTimers.set(index, timer);
  }

  private clearFreeTimer(index: number) {
    const t = this.freeTimers.get(index);
    if (t !== undefined) {
      clearTimeout(t);
      this.freeTimers.delete(index);
    }
  }

  private clearAdsrState() {
    for (const t of this.freeTimers.values()) clearTimeout(t);
    this.freeTimers.clear();
    this.heldNotes.clear();
    this.voiceMidi.fill(-1);
    this.voiceBaseGain.fill(0);
    this.voiceActive.fill(false);
    this.noteOrder = 0;
  }

  /**
   * Apply arp gain multipliers to sounding ADSR chord voices.
   * `mults` is indexed by oscillator-panel voice index; chord slots map in enablement order.
   */
  applyAdsrArp(voices: VoiceState[], mults: number[]) {
    if (!this.workletReady || !this.ctx || this.playMode !== 'adsr') return;

    const slots: number[] = [];
    for (let i = 0; i < voices.length; i += 1) {
      if (voices[i]?.enabled) slots.push(i);
    }
    if (slots.length === 0) slots.push(0);

    const now = this.ctx.currentTime;
    for (const held of this.heldNotes.values()) {
      for (let s = 0; s < held.voiceIndices.length; s += 1) {
        const vi = held.voiceIndices[s]!;
        const voice = this.voices[vi];
        if (!voice) continue;
        const panelIdx = slots[s] ?? slots[slots.length - 1]!;
        const mult = mults[panelIdx] ?? 1;
        const gain = (this.voiceBaseGain[vi] ?? 0) * mult;
        const gainParam = voice.node.parameters.get('gain');
        gainParam?.setTargetAtTime(gain, now, 0.015);
        voice.node.port.postMessage({
          type: 'params',
          active: gain > 0.0001,
          gain,
        });
      }
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

    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < this.timeDomain.length; i += 1) {
      const sample = (this.timeDomain[i]! - 128) / 128;
      sumSq += sample * sample;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, this.timeDomain.length));
    this.peakHold = Math.max(peak, this.peakHold * 0.985);

    return {
      timeDomain: this.timeDomain,
      frequencyData: this.frequencyData,
      bass,
      mid,
      high,
      rms,
      peak: this.peakHold,
    };
  }
}

export const audioEngine = new AudioEngine();
