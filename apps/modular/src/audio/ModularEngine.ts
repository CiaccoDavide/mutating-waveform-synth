import { MODULE_DEFS } from '../modules/registry';
import type { Patch, PatchNode } from '../modules/types';
import { clamp } from '../modules/types';
import {
  midiToHz,
  quantizeDegree,
  type ScaleId,
} from '../music/scales';
import { euclideanPattern, rotatePattern } from '../music/euclidean';
import {
  buildChorus,
  buildMonoDelay,
  disposeChorus,
  disposeDelay,
  type ChorusNodes,
  type DelayNodes,
} from './fxBuilders';
import { createModControl, createModTarget, type ModTarget } from './modParam';
import { applyWave } from './waves';

type GateFn = (on: boolean) => void;

interface GatePort {
  subscribe: (fn: GateFn) => () => void;
  emit: (on: boolean) => void;
}

interface ValuePort {
  set: (v: number) => void;
  subscribe: (fn: (v: number) => void) => () => void;
  get: () => number;
}

interface NodeRuntime {
  type: string;
  audioIn?: AudioNode;
  /** Named audio inputs (e.g. mixer a/b/c/d) */
  audioIns?: Record<string, AudioNode>;
  audioOut?: AudioNode;
  params: Record<string, AudioParam>;
  cvIns?: Record<string, AudioNode>;
  cvOut?: AudioNode;
  valueOut?: Record<string, ValuePort>;
  valueIn?: Record<string, (v: number) => void>;
  gateOut?: Record<string, GatePort>;
  gateIn?: Record<string, GateFn>;
  osc?: OscillatorNode;
  analyser?: AnalyserNode;
  wireBaseline?: () => void;
  /** Only skip baseline when this CV port is wired */
  baselinePort?: string;
  cableGated?: boolean;
  dispose: () => void;
  update: (node: PatchNode) => void;
  gateOn?: () => void;
  gateOff?: () => void;
  startClock?: () => void;
  stopClock?: () => void;
  getStep?: () => number;
  getPulse?: () => boolean;
  getHold?: () => number;
  getBits?: () => number[];
  getPattern?: () => boolean[];
  getEnvLevel?: () => number;
  getEnvStage?: () => 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  getEnvProgress?: () => number;
}

function createGatePort(): GatePort {
  const listeners = new Set<GateFn>();
  return {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit: (on) => {
      for (const fn of listeners) fn(on);
    },
  };
}

function createValuePort(initial = 0): ValuePort {
  let value = initial;
  const listeners = new Set<(v: number) => void>();
  return {
    get: () => value,
    set: (v) => {
      value = v;
      for (const fn of listeners) fn(v);
    },
    subscribe: (fn) => {
      listeners.add(fn);
      fn(value);
      return () => listeners.delete(fn);
    },
  };
}

function modsToPorts(mods: Record<string, ModTarget>) {
  const cvIns: Record<string, AudioNode> = {};
  const params: Record<string, AudioParam> = {};
  for (const [k, m] of Object.entries(mods)) {
    cvIns[k] = m.cvIn;
    params[k] = m.param;
  }
  return { cvIns, params };
}

function disposeMods(mods: Record<string, ModTarget>) {
  for (const m of Object.values(mods)) m.dispose();
}

/**
 * Compiles a patch into a live Web Audio graph (mono voice).
 * Full rebuild on each sync — simple and reliable for small patches.
 */
export class ModularEngine {
  private ctx: AudioContext | null = null;
  private runtimes = new Map<string, NodeRuntime>();
  private master: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private unsubs: Array<() => void> = [];
  private workletReady: Promise<void> | null = null;
  gated = false;
  playing = false;

  async ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.workletReady = this.ctx.audioWorklet
        .addModule(
          `${import.meta.env.BASE_URL}worklets/reverb-processor.js`,
        )
        .catch((err) => {
          console.warn('Reverb worklet failed to load', err);
        });
    }
    if (this.workletReady) await this.workletReady;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  get context() {
    return this.ctx;
  }

  getAnalyser(nodeId: string): AnalyserNode | null {
    if (nodeId === '__master__') return this.masterAnalyser;
    return this.runtimes.get(nodeId)?.analyser ?? null;
  }

  getStep(nodeId: string): number {
    return this.runtimes.get(nodeId)?.getStep?.() ?? 0;
  }

  getPulse(nodeId: string): boolean {
    return this.runtimes.get(nodeId)?.getPulse?.() ?? false;
  }

  getHold(nodeId: string): number {
    return this.runtimes.get(nodeId)?.getHold?.() ?? 0;
  }

  getEnvLevel(nodeId: string): number {
    return this.runtimes.get(nodeId)?.getEnvLevel?.() ?? 0;
  }

  getEnvStage(
    nodeId: string,
  ): 'idle' | 'attack' | 'decay' | 'sustain' | 'release' {
    return this.runtimes.get(nodeId)?.getEnvStage?.() ?? 'idle';
  }

  getEnvProgress(nodeId: string): number {
    return this.runtimes.get(nodeId)?.getEnvProgress?.() ?? 0;
  }

  getBits(nodeId: string): number[] {
    return this.runtimes.get(nodeId)?.getBits?.() ?? [];
  }

  getPattern(nodeId: string): boolean[] {
    return this.runtimes.get(nodeId)?.getPattern?.() ?? [];
  }

  async sync(patch: Patch) {
    const ctx = await this.ensure();
    this.teardown();

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.master.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);

    for (const node of patch.nodes) {
      const rt = this.buildNode(ctx, node);
      this.runtimes.set(node.id, rt);
      if (rt.osc) {
        try {
          rt.osc.start();
        } catch {
          /* already started */
        }
      }
    }

    const cvWired = new Set<string>();

    for (const edge of patch.edges) {
      const from = this.runtimes.get(edge.from.node);
      const to = this.runtimes.get(edge.to.node);
      if (!from || !to) continue;
      const fromNode = patch.nodes.find((n) => n.id === edge.from.node);
      const toNode = patch.nodes.find((n) => n.id === edge.to.node);
      if (!fromNode || !toNode) continue;
      const fromPort = MODULE_DEFS[fromNode.type].ports.find(
        (p) => p.id === edge.from.port,
      );
      const toPort = MODULE_DEFS[toNode.type].ports.find(
        (p) => p.id === edge.to.port,
      );
      if (!fromPort || !toPort) continue;

      if (fromPort.kind === 'audio' && toPort.kind === 'audio') {
        const src = from.audioOut;
        const dst = to.audioIns?.[toPort.id] ?? to.audioIn;
        if (src && dst) src.connect(dst);
      } else if (
        toPort.kind === 'cv' &&
        (fromPort.kind === 'cv' || fromPort.kind === 'audio')
      ) {
        const valueSrc = from.valueOut?.[fromPort.id];
        const valueDst = to.valueIn?.[toPort.id];
        if (valueSrc && valueDst) {
          this.unsubs.push(valueSrc.subscribe(valueDst));
          cvWired.add(`${edge.to.node}:${edge.to.port}`);
        } else {
          const src =
            fromPort.kind === 'cv'
              ? (from.cvOut ?? from.audioOut)
              : (from.audioOut ?? from.cvOut);
          if (src) {
            const cvIn = to.cvIns?.[toPort.id];
            if (cvIn) {
              try {
                src.connect(cvIn);
                cvWired.add(`${edge.to.node}:${edge.to.port}`);
              } catch {
                /* invalid */
              }
            } else {
              const param = to.params[toPort.id];
              if (param) {
                try {
                  src.connect(param);
                  cvWired.add(`${edge.to.node}:${edge.to.port}`);
                } catch {
                  /* invalid */
                }
              }
            }
          }
        }
      } else if (fromPort.kind === 'gate' && toPort.kind === 'gate') {
        const gout = from.gateOut?.[fromPort.id];
        if (gout && (to.gateIn?.[toPort.id] || to.gateOn)) {
          const handler: GateFn = (on) => {
            if (on) {
              if (to.gateIn?.[toPort.id]) to.gateIn[toPort.id]!(true);
              else to.gateOn?.();
            } else {
              if (to.gateIn?.[toPort.id]) to.gateIn[toPort.id]!(false);
              else to.gateOff?.();
            }
          };
          this.unsubs.push(gout.subscribe(handler));
          to.cableGated = true;
        }
      }
    }

    for (const node of patch.nodes) {
      const rt = this.runtimes.get(node.id);
      if (!rt?.wireBaseline) continue;
      const port = rt.baselinePort;
      if (port) {
        if (!cvWired.has(`${node.id}:${port}`)) rt.wireBaseline();
      }
    }

    for (const node of patch.nodes) {
      if (node.type !== 'out') continue;
      const rt = this.runtimes.get(node.id);
      if (rt?.audioOut && this.master) {
        rt.audioOut.connect(this.master);
      }
    }

    if (this.gated) this.gate(true);
    if (this.playing) this.setPlaying(true);
  }

  updateParams(patch: Patch) {
    for (const node of patch.nodes) {
      const rt = this.runtimes.get(node.id);
      rt?.update(node);
    }
  }

  gate(on: boolean) {
    this.gated = on;
    for (const rt of this.runtimes.values()) {
      if (rt.cableGated) continue;
      if (on) rt.gateOn?.();
      else rt.gateOff?.();
    }
  }

  setPlaying(on: boolean) {
    this.playing = on;
    for (const rt of this.runtimes.values()) {
      if (on) rt.startClock?.();
      else rt.stopClock?.();
    }
  }

  private teardown() {
    for (const u of this.unsubs) {
      try {
        u();
      } catch {
        /* */
      }
    }
    this.unsubs = [];
    for (const rt of this.runtimes.values()) {
      try {
        rt.dispose();
      } catch {
        /* */
      }
    }
    this.runtimes.clear();
    try {
      this.master?.disconnect();
      this.masterAnalyser?.disconnect();
    } catch {
      /* */
    }
    this.master = null;
    this.masterAnalyser = null;
  }

  private buildNode(ctx: AudioContext, node: PatchNode): NodeRuntime {
    switch (node.type) {
      case 'osc':
        return this.buildOsc(ctx, node);
      case 'env':
        return this.buildEnv(ctx, node);
      case 'filter':
        return this.buildFilter(ctx, node);
      case 'vca':
        return this.buildVca(ctx, node);
      case 'out':
        return this.buildOut(ctx, node);
      case 'chorus':
        return this.buildChorusModule(ctx, node);
      case 'delay':
        return this.buildDelayModule(ctx, node);
      case 'reverb':
        return this.buildReverbModule(ctx, node);
      case 'clock':
        return this.buildClock(ctx, node);
      case 'seq':
        return this.buildSeq(ctx, node);
      case 'quant':
        return this.buildQuant(ctx, node);
      case 'lfo':
        return this.buildLfo(ctx, node);
      case 'turing':
        return this.buildTuring(ctx, node);
      case 'euclid':
        return this.buildEuclid(ctx, node);
      case 'mixer':
        return this.buildMixer(ctx, node);
      case 'noise':
        return this.buildNoise(ctx, node);
      case 'sh':
        return this.buildSH(ctx, node);
      case 'att':
        return this.buildAtt(ctx, node);
      case 'dist':
        return this.buildDist(ctx, node);
      default:
        throw new Error(`Unknown module ${(node as PatchNode).type}`);
    }
  }

  private buildOsc(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const fmGain = ctx.createGain();
    fmGain.gain.value = 0;
    const amp = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    modulator.type = 'sine';
    modulator.connect(fmGain);
    fmGain.connect(carrier.frequency);
    carrier.connect(amp);
    amp.connect(analyser);
    modulator.start();
    carrier.start();

    const freq = createModTarget(ctx, {
      min: 20,
      max: 2000,
      initial: Number(node.params.freq ?? 110),
      destination: carrier.frequency,
    });
    const ampMod = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.amp ?? 0.35),
      destination: amp.gain,
    });
    const detune = createModTarget(ctx, {
      min: -100,
      max: 100,
      initial: Number(node.params.detune ?? 0),
      destination: carrier.detune,
    });
    const fm = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.fm ?? 0),
      destination: fmGain.gain,
      map: (v) => v * 900,
    });
    const pwCtrl = createModControl(ctx, {
      min: 0.05,
      max: 0.95,
      initial: Number(node.params.pw ?? 0.5),
    });
    const mods = { freq, amp: ampMod, detune, fm, pw: pwCtrl };
    const { cvIns, params } = modsToPorts(mods);

    let lastWave = '';
    let lastPw = -1;
    let fmRatio = Number(node.params.fmRatio ?? 2);

    const syncModFreq = () => {
      const f = Math.max(20, freq.getBase());
      modulator.frequency.setTargetAtTime(
        f * clamp(fmRatio, 0.5, 8),
        ctx.currentTime,
        0.01,
      );
    };

    const apply = (n: PatchNode) => {
      const wave = String(n.params.wave ?? 'sawtooth');
      const pwNow = clamp(Number(n.params.pw ?? 0.5), 0.05, 0.95);
      pwCtrl.setBase(pwNow);
      if (
        wave !== lastWave ||
        (wave === 'pulse' && Math.abs(pwNow - lastPw) > 0.001)
      ) {
        applyWave(carrier, ctx, wave, pwNow);
        lastWave = wave;
        lastPw = pwNow;
      }
      freq.setBase(Number(n.params.freq ?? 110));
      ampMod.setBase(Number(n.params.amp ?? 0.35));
      detune.setBase(Number(n.params.detune ?? 0));
      fm.setBase(Number(n.params.fm ?? 0));
      fmRatio = Number(n.params.fmRatio ?? 2);
      syncModFreq();
    };
    apply(node);

    return {
      type: 'osc',
      audioOut: analyser,
      osc: carrier,
      analyser,
      params,
      cvIns,
      valueIn: {
        freq: (hz) => {
          freq.setBase(clamp(hz, 20, 2000));
          syncModFreq();
        },
      },
      update: apply,
      dispose: () => {
        disposeMods(mods);
        try {
          carrier.stop();
        } catch {
          /* */
        }
        try {
          modulator.stop();
        } catch {
          /* */
        }
        carrier.disconnect();
        modulator.disconnect();
        fmGain.disconnect();
        amp.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildEnv(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const src = ctx.createConstantSource();
    const envGain = ctx.createGain();
    envGain.gain.value = 0;
    src.offset.value = 1;
    src.connect(envGain);
    src.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    envGain.connect(analyser);

    // Plain numbers — createModControl/getBase was unreliable for times, and
    // analyser-based retrigger often started near 1 (instant "attack").
    let attackT = Math.max(0.001, Number(node.params.attack ?? 0.01));
    let decayT = Math.max(0.001, Number(node.params.decay ?? 0.2));
    let sustainL = clamp(Number(node.params.sustain ?? 0.65), 0, 1);
    let releaseT = Math.max(0.001, Number(node.params.release ?? 0.35));

    type EnvStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
    let stage: EnvStage = 'idle';
    let stageAt = 0;
    let segA = attackT;
    let segD = decayT;
    let segS = sustainL;
    let segR = releaseT;
    let releaseFrom = 0;
    let gated = false;

    const levelAt = (t: number): number => {
      if (stage === 'idle') return 0;
      const e = t - stageAt;
      if (stage === 'attack') {
        const p = clamp(e / segA, 0, 1);
        return releaseFrom + (1 - releaseFrom) * p;
      }
      if (stage === 'decay') {
        const p = clamp(e / segD, 0, 1);
        return 1 + (segS - 1) * p;
      }
      if (stage === 'sustain') return segS;
      if (stage === 'release') {
        const p = clamp(e / segR, 0, 1);
        return releaseFrom * (1 - p);
      }
      return 0;
    };

    const resolveStage = (): EnvStage => {
      if (stage === 'idle') return 'idle';
      const t = ctx.currentTime;
      if (stage === 'attack') {
        if (t >= stageAt + segA) {
          stage = 'decay';
          stageAt = stageAt + segA;
          releaseFrom = 1;
        } else return 'attack';
      }
      if (stage === 'decay') {
        if (t >= stageAt + segD) {
          if (gated) {
            stage = 'sustain';
            stageAt = stageAt + segD;
            releaseFrom = segS;
          } else {
            releaseFrom = levelAt(t);
            stage = 'release';
            stageAt = t;
            segR = releaseT;
          }
        } else return 'decay';
      }
      if (stage === 'sustain') {
        if (!gated) {
          releaseFrom = segS;
          stage = 'release';
          stageAt = t;
          segR = releaseT;
        } else return 'sustain';
      }
      if (stage === 'release') {
        if (t >= stageAt + segR) {
          stage = 'idle';
          releaseFrom = 0;
          return 'idle';
        }
        return 'release';
      }
      return stage;
    };

    const gateOn = () => {
      const t = ctx.currentTime;
      resolveStage();
      const cur = levelAt(t);
      const a = Math.max(0.001, attackT);
      const d = Math.max(0.001, decayT);
      const s = clamp(sustainL, 0, 1);
      segA = a;
      segD = d;
      segS = s;
      releaseFrom = cur;
      gated = true;
      stage = 'attack';
      stageAt = t;

      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(cur, t);
      envGain.gain.linearRampToValueAtTime(1, t + a);
      envGain.gain.linearRampToValueAtTime(s, t + a + d);
    };

    const gateOff = () => {
      const t = ctx.currentTime;
      resolveStage();
      const cur = levelAt(t);
      const r = Math.max(0.001, releaseT);
      segR = r;
      releaseFrom = cur;
      gated = false;
      stage = 'release';
      stageAt = t;

      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(cur, t);
      envGain.gain.linearRampToValueAtTime(0, t + r);
    };

    return {
      type: 'env',
      cvOut: envGain,
      analyser,
      params: {},
      gateOn,
      gateOff,
      gateIn: { gate: (on) => (on ? gateOn() : gateOff()) },
      getEnvLevel: () => {
        resolveStage();
        return levelAt(ctx.currentTime);
      },
      getEnvStage: () => resolveStage(),
      getEnvProgress: () => {
        const st = resolveStage();
        if (st === 'idle') return 0;
        const t = ctx.currentTime;
        if (st === 'attack') return clamp((t - stageAt) / segA, 0, 1);
        if (st === 'decay') return clamp((t - stageAt) / segD, 0, 1);
        if (st === 'sustain') return 1;
        if (st === 'release') return clamp((t - stageAt) / segR, 0, 1);
        return 0;
      },
      update: (n) => {
        attackT = Math.max(0.001, Number(n.params.attack ?? 0.01));
        decayT = Math.max(0.001, Number(n.params.decay ?? 0.2));
        sustainL = clamp(Number(n.params.sustain ?? 0.65), 0, 1);
        releaseT = Math.max(0.001, Number(n.params.release ?? 0.35));
      },
      dispose: () => {
        try {
          src.stop();
        } catch {
          /* */
        }
        src.disconnect();
        envGain.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildFilter(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const filter = ctx.createBiquadFilter();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    filter.connect(analyser);

    const cutoff = createModTarget(ctx, {
      min: 40,
      max: 12000,
      initial: Number(node.params.cutoff ?? 1800),
      destination: filter.frequency,
    });
    const q = createModTarget(ctx, {
      min: 0.1,
      max: 18,
      initial: Number(node.params.q ?? 1.2),
      destination: filter.Q,
    });
    const mods = { cutoff, q };
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      const type = String(n.params.type ?? 'lowpass');
      if (type === 'lowpass' || type === 'highpass' || type === 'bandpass') {
        filter.type = type;
      }
      cutoff.setBase(Number(n.params.cutoff ?? 1800));
      q.setBase(Number(n.params.q ?? 1.2));
    };
    apply(node);

    return {
      type: 'filter',
      audioIn: filter,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        filter.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildVca(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    gain.gain.value = 0;

    const envScale = ctx.createGain();
    envScale.connect(gain.gain);

    const level = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.level ?? 0.85),
      destination: envScale.gain,
    });

    const baseline = ctx.createConstantSource();
    baseline.offset.value = 1;
    baseline.start();
    let baselineWired = false;

    const mods = { level };
    const { cvIns, params } = modsToPorts(mods);
    cvIns.cv = envScale;

    return {
      type: 'vca',
      audioIn: gain,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      baselinePort: 'cv',
      wireBaseline: () => {
        if (baselineWired) return;
        baseline.connect(envScale);
        baselineWired = true;
      },
      update: (n) => level.setBase(Number(n.params.level ?? 0.85)),
      dispose: () => {
        disposeMods(mods);
        try {
          baseline.stop();
        } catch {
          /* */
        }
        baseline.disconnect();
        envScale.disconnect();
        gain.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildOut(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);

    const gainMod = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.gain ?? 0.55),
      destination: gain.gain,
    });
    const mods = { gain: gainMod };
    const { cvIns, params } = modsToPorts(mods);

    return {
      type: 'out',
      audioIn: gain,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: (n) => gainMod.setBase(Number(n.params.gain ?? 0.55)),
      dispose: () => {
        disposeMods(mods);
        gain.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildChorusModule(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const nodes: ChorusNodes = buildChorus(ctx, 2);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    nodes.output.connect(analyser);

    const mix = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.mix ?? 0.35),
      destination: nodes.wet.gain,
    });
    const feedback = createModTarget(ctx, {
      min: 0,
      max: 0.9,
      initial: Number(node.params.feedback ?? 0.15),
      destination: nodes.feedback.gain,
    });
    const rate = createModTarget(ctx, {
      min: 0.05,
      max: 8,
      initial: Number(node.params.rate ?? 0.9),
      destination: nodes.lfos[0]!.frequency,
    });
    // Fan rate mod into other LFOs
    for (let i = 1; i < nodes.lfos.length; i++) {
      try {
        rate.cvIn.connect(nodes.lfos[i]!.frequency);
      } catch {
        /* */
      }
    }
    const depth = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.depth ?? 0.45),
      destination: nodes.lfoGains[0]!.gain,
      map: (d) => 0.0005 + clamp(d, 0, 1) * 0.004,
    });
    for (let i = 1; i < nodes.lfoGains.length; i++) {
      try {
        depth.cvIn.connect(nodes.lfoGains[i]!.gain);
      } catch {
        /* */
      }
    }

    const mods = { mix, rate, depth, feedback };
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      const m = clamp(Number(n.params.mix ?? 0.35), 0, 1);
      mix.setBase(m);
      nodes.dry.gain.setTargetAtTime(1 - m * 0.85, ctx.currentTime, 0.02);
      feedback.setBase(Number(n.params.feedback ?? 0.15));
      rate.setBase(Number(n.params.rate ?? 0.9));
      depth.setBase(Number(n.params.depth ?? 0.45));
      for (let i = 1; i < nodes.lfos.length; i++) {
        nodes.lfos[i]!.frequency.setTargetAtTime(
          clamp(Number(n.params.rate ?? 0.9), 0.05, 8) * (1 + i * 0.12),
          ctx.currentTime,
          0.02,
        );
      }
    };
    apply(node);

    return {
      type: 'chorus',
      audioIn: nodes.input,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        disposeChorus(nodes);
        analyser.disconnect();
      },
    };
  }

  private buildDelayModule(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const nodes: DelayNodes = buildMonoDelay(ctx);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    nodes.output.connect(analyser);

    const mix = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.mix ?? 0.3),
      destination: nodes.wet.gain,
    });
    const timeMs = createModTarget(ctx, {
      min: 20,
      max: 1500,
      initial: Number(node.params.timeMs ?? 320),
      destination: nodes.delay.delayTime,
      map: (ms) => ms / 1000,
    });
    const feedback = createModTarget(ctx, {
      min: 0,
      max: 0.95,
      initial: Number(node.params.feedback ?? 0.35),
      destination: nodes.feedback.gain,
    });
    const tone = createModTarget(ctx, {
      min: 200,
      max: 12000,
      initial: Number(node.params.tone ?? 4200),
      destination: nodes.tone.frequency,
    });
    const mods = { mix, timeMs, feedback, tone };
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      const m = clamp(Number(n.params.mix ?? 0.3), 0, 1);
      mix.setBase(m);
      nodes.dry.gain.setTargetAtTime(1 - m, ctx.currentTime, 0.02);
      timeMs.setBase(Number(n.params.timeMs ?? 320));
      feedback.setBase(Number(n.params.feedback ?? 0.35));
      tone.setBase(Number(n.params.tone ?? 4200));
    };
    apply(node);

    return {
      type: 'delay',
      audioIn: nodes.input,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        disposeDelay(nodes);
        analyser.disconnect();
      },
    };
  }

  private buildReverbModule(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const output = ctx.createGain();
    const preDelay = ctx.createDelay(0.25);
    preDelay.delayTime.value = 0.025;

    let worklet: AudioWorkletNode | null = null;
    try {
      worklet = new AudioWorkletNode(ctx, 'reverb-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
      });
      worklet.port.postMessage({ type: 'algorithm', algorithm: 'freeverb' });
      worklet.parameters.get('enabled')?.setValueAtTime(1, ctx.currentTime);
    } catch (err) {
      console.warn('Reverb worklet unavailable', err);
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    input.connect(dry);
    dry.connect(output);
    if (worklet) {
      input.connect(preDelay);
      preDelay.connect(worklet);
      worklet.connect(wet);
    }
    wet.connect(output);
    output.connect(analyser);

    const mix = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.mix ?? 0.25),
      destination: wet.gain,
    });
    const preDelayMs = createModTarget(ctx, {
      min: 0,
      max: 100,
      initial: Number(node.params.preDelayMs ?? 25),
      destination: preDelay.delayTime,
      map: (ms) => ms / 1000,
    });

    const mods: Record<string, ModTarget> = { mix, preDelayMs };
    if (worklet) {
      const sizeP = worklet.parameters.get('size');
      const decayP = worklet.parameters.get('decay');
      const dampP = worklet.parameters.get('damping');
      if (sizeP) {
        mods.size = createModTarget(ctx, {
          min: 0,
          max: 1,
          initial: Number(node.params.size ?? 0.55),
          destination: sizeP,
        });
      }
      if (decayP) {
        mods.decay = createModTarget(ctx, {
          min: 0,
          max: 1,
          initial: Number(node.params.decay ?? 0.5),
          destination: decayP,
        });
      }
      if (dampP) {
        mods.damping = createModTarget(ctx, {
          min: 0,
          max: 1,
          initial: Number(node.params.damping ?? 0.4),
          destination: dampP,
        });
      }
    }
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      const m = clamp(Number(n.params.mix ?? 0.25), 0, 1);
      mix.setBase(m);
      dry.gain.setTargetAtTime(1 - m, ctx.currentTime, 0.02);
      preDelayMs.setBase(Number(n.params.preDelayMs ?? 25));
      mods.size?.setBase(Number(n.params.size ?? 0.55));
      mods.decay?.setBase(Number(n.params.decay ?? 0.5));
      mods.damping?.setBase(Number(n.params.damping ?? 0.4));
    };
    apply(node);

    return {
      type: 'reverb',
      audioIn: input,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        try {
          worklet?.disconnect();
        } catch {
          /* */
        }
        input.disconnect();
        dry.disconnect();
        wet.disconnect();
        output.disconnect();
        preDelay.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildClock(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gate = createGatePort();
    let divParam = String(node.params.div ?? '1');
    let timer: ReturnType<typeof setTimeout> | null = null;
    let nextBeat = 0;
    let running = false;
    let pulse = false;

    const bpm = createModControl(ctx, {
      min: 40,
      max: 240,
      initial: Number(node.params.bpm ?? 110),
    });
    const pulseMs = createModControl(ctx, {
      min: 5,
      max: 200,
      initial: Number(node.params.pulseMs ?? 40),
    });
    const mods = { bpm, pulseMs };
    const { cvIns, params } = modsToPorts(mods);

    const divFactor = () => {
      if (divParam === '1/2') return 0.5;
      if (divParam === '1/4') return 0.25;
      if (divParam === '1/8') return 0.125;
      return 1;
    };

    const period = () => {
      const b = clamp(bpm.read(), 40, 240);
      return (60 / b) * divFactor();
    };

    const pulseSec = () =>
      Math.min(period() * 0.9, clamp(pulseMs.read(), 5, 200) / 1000);

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      if (!running || !this.ctx) return;
      const now = this.ctx.currentTime;
      const look = 0.12;
      while (nextBeat < now + look) {
        const onAt = nextBeat;
        const offAt = nextBeat + pulseSec();
        const delayOn = Math.max(0, (onAt - now) * 1000);
        const delayOff = Math.max(0, (offAt - now) * 1000);
        setTimeout(() => {
          if (!running) return;
          pulse = true;
          gate.emit(true);
        }, delayOn);
        setTimeout(() => {
          if (!running) return;
          pulse = false;
          gate.emit(false);
        }, delayOff);
        nextBeat += period();
      }
      timer = setTimeout(schedule, 25);
    };

    const startClock = () => {
      if (running) return;
      running = true;
      nextBeat = (this.ctx?.currentTime ?? 0) + 0.05;
      schedule();
    };
    const stopClock = () => {
      running = false;
      clear();
      if (pulse) {
        pulse = false;
        gate.emit(false);
      }
    };

    return {
      type: 'clock',
      params,
      cvIns,
      gateOut: { gate },
      startClock,
      stopClock,
      getPulse: () => pulse,
      update: (n) => {
        divParam = String(n.params.div ?? '1');
        bpm.setBase(Number(n.params.bpm ?? 110));
        pulseMs.setBase(Number(n.params.pulseMs ?? 40));
        if (running && this.ctx) {
          const now = this.ctx.currentTime;
          if (nextBeat > now + period() * 1.5) {
            nextBeat = now + 0.02;
          }
        }
      },
      dispose: () => {
        stopClock();
        disposeMods(mods);
      },
    };
  }

  private buildSeq(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gate = createGatePort();
    const pitch = createValuePort(0);
    const pitchAudio = ctx.createConstantSource();
    pitchAudio.offset.value = 0;
    pitchAudio.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    pitchAudio.connect(analyser);

    let params = { ...node.params };
    let step = 0;
    let gateTimer: ReturnType<typeof setTimeout> | null = null;

    const gateLen = createModControl(ctx, {
      min: 0.05,
      max: 1,
      initial: Number(node.params.gateLen ?? 0.55),
    });
    const mods = { gateLen };
    const { cvIns, params: audioParams } = modsToPorts(mods);

    const stepsN = () => (Number(params.steps ?? 8) === 16 ? 16 : 8);

    const onClock = (on: boolean) => {
      if (!on) return;
      const n = stepsN();
      const deg = Number(params[`p${step}`] ?? 0);
      pitch.set(deg);
      pitchAudio.offset.setTargetAtTime(deg, ctx.currentTime, 0.005);
      gate.emit(true);
      if (gateTimer) clearTimeout(gateTimer);
      const ms = clamp(gateLen.read(), 0.05, 1) * 180;
      gateTimer = setTimeout(() => gate.emit(false), Math.max(20, ms));
      step = (step + 1) % n;
    };

    return {
      type: 'seq',
      cvOut: pitchAudio,
      analyser,
      params: audioParams,
      cvIns,
      valueOut: { pitch },
      gateOut: { gate },
      gateIn: { clock: onClock },
      getStep: () => step,
      update: (n) => {
        params = { ...n.params };
        gateLen.setBase(Number(n.params.gateLen ?? 0.55));
      },
      dispose: () => {
        if (gateTimer) clearTimeout(gateTimer);
        disposeMods(mods);
        try {
          pitchAudio.stop();
        } catch {
          /* */
        }
        pitchAudio.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildQuant(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const out = createValuePort(midiToHz(48));
    const outAudio = ctx.createConstantSource();
    outAudio.offset.value = midiToHz(48);
    outAudio.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    outAudio.connect(analyser);

    let scaleId = String(node.params.scale ?? 'minor') as ScaleId;
    let lastDegree = 0;

    const root = createModControl(ctx, {
      min: 0,
      max: 11,
      initial: Number(node.params.root ?? 0),
    });
    const mods = { root };
    const { cvIns, params } = modsToPorts(mods);

    const applyDegree = (degree: number) => {
      lastDegree = degree;
      const r = Math.round(clamp(root.read(), 0, 11));
      const midi = quantizeDegree(degree, r, scaleId);
      const hz = midiToHz(midi);
      out.set(hz);
      outAudio.offset.setTargetAtTime(hz, ctx.currentTime, 0.005);
    };

    return {
      type: 'quant',
      cvOut: outAudio,
      analyser,
      params,
      cvIns,
      valueOut: { out },
      valueIn: { in: applyDegree },
      update: (n) => {
        scaleId = String(n.params.scale ?? 'minor') as ScaleId;
        root.setBase(Number(n.params.root ?? 0));
        applyDegree(lastDegree);
      },
      dispose: () => {
        disposeMods(mods);
        try {
          outAudio.stop();
        } catch {
          /* */
        }
        outAudio.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildLfo(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const osc = ctx.createOscillator();
    const depthGain = ctx.createGain();
    const offsetSrc = ctx.createConstantSource();
    const sum = ctx.createGain();
    sum.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    osc.connect(depthGain);
    depthGain.connect(sum);
    offsetSrc.connect(sum);
    sum.connect(analyser);
    osc.start();
    offsetSrc.start();

    const rate = createModTarget(ctx, {
      min: 0.01,
      max: 20,
      initial: Number(node.params.rate ?? 0.4),
      destination: osc.frequency,
    });
    const depth = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.depth ?? 0.5),
      destination: depthGain.gain,
    });
    // Offset AudioParam driven manually for uni/bi mapping
    const offsetKnob = createModControl(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.offset ?? 0.5),
    });
    const pwCtrl = createModControl(ctx, {
      min: 0.05,
      max: 0.95,
      initial: Number(node.params.pw ?? 0.5),
    });
    const mods = { rate, depth, offset: offsetKnob, pw: pwCtrl };
    const { cvIns, params } = modsToPorts(mods);

    let bipolar = String(node.params.bipolar ?? 'uni') === 'bi';
    let lastWave = '';
    let lastPw = -1;

    const applyOffset = () => {
      const o = clamp(offsetKnob.getBase(), 0, 1);
      const mapped = bipolar ? o - 0.5 : o;
      offsetSrc.offset.setTargetAtTime(mapped, ctx.currentTime, 0.01);
    };

    const apply = (n: PatchNode) => {
      const wave = String(n.params.wave ?? 'sine');
      const pwNow = clamp(Number(n.params.pw ?? 0.5), 0.05, 0.95);
      pwCtrl.setBase(pwNow);
      if (wave !== lastWave || (wave === 'pulse' && Math.abs(pwNow - lastPw) > 0.001)) {
        applyWave(osc, ctx, wave, pwNow);
        lastWave = wave;
        lastPw = pwNow;
      }
      bipolar = String(n.params.bipolar ?? 'uni') === 'bi';
      rate.setBase(Number(n.params.rate ?? 0.4));
      depth.setBase(Number(n.params.depth ?? 0.5));
      offsetKnob.setBase(Number(n.params.offset ?? 0.5));
      applyOffset();
    };
    apply(node);

    return {
      type: 'lfo',
      cvOut: sum,
      analyser,
      osc,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        try {
          osc.stop();
        } catch {
          /* */
        }
        try {
          offsetSrc.stop();
        } catch {
          /* */
        }
        osc.disconnect();
        depthGain.disconnect();
        offsetSrc.disconnect();
        sum.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildTuring(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gate = createGatePort();
    const pitch = createValuePort(midiToHz(48));
    const pitchAudio = ctx.createConstantSource();
    pitchAudio.offset.value = midiToHz(48);
    pitchAudio.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    pitchAudio.connect(analyser);

    let params = { ...node.params };
    let length = Number(params.length ?? 8) === 16 ? 16 : 8;
    let bits: number[] = Array.from({ length }, () => (Math.random() > 0.5 ? 1 : 0));
    let head = 0;
    let gateTimer: ReturnType<typeof setTimeout> | null = null;

    const prob = createModControl(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.prob ?? 0.35),
    });
    const gateLen = createModControl(ctx, {
      min: 0.05,
      max: 1,
      initial: Number(node.params.gateLen ?? 0.55),
    });
    const root = createModControl(ctx, {
      min: 0,
      max: 11,
      initial: Number(node.params.root ?? 0),
    });
    const mods = { prob, gateLen, root };
    const { cvIns, params: audioParams } = modsToPorts(mods);

    const ensureLength = (n: number) => {
      if (bits.length === n) return;
      if (bits.length < n) {
        while (bits.length < n) bits.push(Math.random() > 0.5 ? 1 : 0);
      } else {
        bits = bits.slice(0, n);
      }
      head = head % n;
    };

    const bitsToDegree = () => {
      let v = 0;
      for (let i = 0; i < bits.length; i++) {
        v = (v << 1) | bits[i]!;
      }
      return v % 15;
    };

    const emitPitch = () => {
      const degree = bitsToDegree();
      const scaleId = String(params.scale ?? 'minor') as ScaleId;
      const r = Math.round(clamp(root.read(), 0, 11));
      const midi = quantizeDegree(degree, r, scaleId);
      const hz = midiToHz(midi);
      pitch.set(hz);
      pitchAudio.offset.setTargetAtTime(hz, ctx.currentTime, 0.005);
    };

    const onClock = (on: boolean) => {
      if (!on) return;
      length = Number(params.length ?? 8) === 16 ? 16 : 8;
      ensureLength(length);

      const locked = String(params.locked ?? 'off') === 'on';
      const p = locked ? 0 : clamp(prob.read(), 0, 1);

      // Rotate left; probabilistic write of new MSB (Music Thing–style)
      const outBit = bits[0]!;
      for (let i = 0; i < bits.length - 1; i++) bits[i] = bits[i + 1]!;
      bits[bits.length - 1] = Math.random() < p ? 1 - outBit : outBit;
      head = (head + 1) % bits.length;

      emitPitch();
      gate.emit(true);
      if (gateTimer) clearTimeout(gateTimer);
      const ms = clamp(gateLen.read(), 0.05, 1) * 180;
      gateTimer = setTimeout(() => gate.emit(false), Math.max(20, ms));
    };

    emitPitch();

    return {
      type: 'turing',
      cvOut: pitchAudio,
      analyser,
      params: audioParams,
      cvIns,
      valueOut: { pitch },
      gateOut: { gate },
      gateIn: { clock: onClock },
      getStep: () => head,
      getBits: () => bits.slice(),
      update: (n) => {
        params = { ...n.params };
        length = Number(params.length ?? 8) === 16 ? 16 : 8;
        ensureLength(length);
        prob.setBase(Number(n.params.prob ?? 0.35));
        gateLen.setBase(Number(n.params.gateLen ?? 0.55));
        root.setBase(Number(n.params.root ?? 0));
        emitPitch();
      },
      dispose: () => {
        if (gateTimer) clearTimeout(gateTimer);
        disposeMods(mods);
        try {
          pitchAudio.stop();
        } catch {
          /* */
        }
        pitchAudio.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildEuclid(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const gate = createGatePort();
    const stepVal = createValuePort(0);
    const stepAudio = ctx.createConstantSource();
    stepAudio.offset.value = 0;
    stepAudio.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    stepAudio.connect(analyser);

    let params = { ...node.params };
    let step = 0;
    let pattern: boolean[] = [];
    let gateTimer: ReturnType<typeof setTimeout> | null = null;

    const gateLen = createModControl(ctx, {
      min: 0.05,
      max: 1,
      initial: Number(node.params.gateLen ?? 0.45),
    });
    const mods = { gateLen };
    const { cvIns, params: audioParams } = modsToPorts(mods);

    const rebuild = () => {
      const steps = clamp(Math.round(Number(params.steps ?? 16)), 2, 32);
      const fills = clamp(Math.round(Number(params.fills ?? 5)), 0, steps);
      const rot = clamp(Math.round(Number(params.rotate ?? 0)), 0, 31);
      pattern = rotatePattern(euclideanPattern(steps, fills), rot);
      if (step >= pattern.length) step = 0;
    };
    rebuild();

    const onClock = (on: boolean) => {
      if (!on) return;
      rebuild();
      const n = pattern.length;
      if (n === 0) return;
      const idx = step % n;
      stepVal.set(idx);
      stepAudio.offset.setTargetAtTime(idx, ctx.currentTime, 0.005);
      if (pattern[idx]) {
        gate.emit(true);
        if (gateTimer) clearTimeout(gateTimer);
        const ms = clamp(gateLen.read(), 0.05, 1) * 180;
        gateTimer = setTimeout(() => gate.emit(false), Math.max(20, ms));
      }
      step = (step + 1) % n;
    };

    return {
      type: 'euclid',
      cvOut: stepAudio,
      analyser,
      params: audioParams,
      cvIns,
      valueOut: { cv: stepVal },
      gateOut: { gate },
      gateIn: { clock: onClock },
      getStep: () => step,
      getPattern: () => pattern.slice(),
      update: (n) => {
        params = { ...n.params };
        gateLen.setBase(Number(n.params.gateLen ?? 0.45));
        rebuild();
      },
      dispose: () => {
        if (gateTimer) clearTimeout(gateTimer);
        disposeMods(mods);
        try {
          stepAudio.stop();
        } catch {
          /* */
        }
        stepAudio.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildMixer(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const chans = ['A', 'B', 'C', 'D'] as const;
    const keys = ['a', 'b', 'c', 'd'] as const;
    const gains = keys.map(() => ctx.createGain());
    const sum = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    for (const g of gains) g.connect(sum);
    sum.connect(analyser);

    const mods: Record<string, ModTarget> = {};
    const audioIns: Record<string, AudioNode> = {};
    keys.forEach((k, i) => {
      const levelKey = `level${chans[i]}`;
      mods[levelKey] = createModTarget(ctx, {
        min: 0,
        max: 1,
        initial: Number(node.params[levelKey] ?? 0.7),
        destination: gains[i]!.gain,
      });
      audioIns[k] = gains[i]!;
    });
    mods.master = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.master ?? 0.8),
      destination: sum.gain,
    });
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      keys.forEach((_, i) => {
        const levelKey = `level${chans[i]}`;
        mods[levelKey]!.setBase(Number(n.params[levelKey] ?? 0.7));
      });
      mods.master!.setBase(Number(n.params.master ?? 0.8));
    };
    apply(node);

    return {
      type: 'mixer',
      audioIns,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        disposeMods(mods);
        for (const g of gains) g.disconnect();
        sum.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildNoise(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const levelGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    levelGain.connect(analyser);

    let src: AudioBufferSourceNode | null = null;
    let noiseType = String(node.params.type ?? 'white');

    const startNoise = (type: string) => {
      if (src) {
        try {
          src.stop();
        } catch {
          /* */
        }
        try {
          src.disconnect();
        } catch {
          /* */
        }
      }
      const buf = makeNoiseBuffer(ctx, type === 'pink' ? 'pink' : 'white');
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(levelGain);
      src.start();
    };
    startNoise(noiseType);

    const level = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.level ?? 0.25),
      destination: levelGain.gain,
    });
    const mods = { level };
    const { cvIns, params } = modsToPorts(mods);

    return {
      type: 'noise',
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: (n) => {
        level.setBase(Number(n.params.level ?? 0.25));
        const t = String(n.params.type ?? 'white');
        if (t !== noiseType) {
          noiseType = t;
          startNoise(t);
        }
      },
      dispose: () => {
        disposeMods(mods);
        try {
          src?.stop();
        } catch {
          /* */
        }
        src?.disconnect();
        levelGain.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildSH(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const input = ctx.createGain();
    input.gain.value = 1;
    const tap = ctx.createAnalyser();
    tap.fftSize = 64;
    input.connect(tap);
    const buf = new Float32Array(tap.fftSize);

    const held = ctx.createConstantSource();
    held.offset.value = 0;
    held.start();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    held.connect(analyser);

    let holdVal = 0;
    void node;

    const sample = () => {
      tap.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i]!;
      holdVal = s / buf.length;
      held.offset.setValueAtTime(holdVal, ctx.currentTime);
    };

    return {
      type: 'sh',
      params: {},
      cvIns: { in: input },
      cvOut: held,
      analyser,
      gateIn: {
        gate: (on) => {
          if (on) sample();
        },
      },
      getHold: () => holdVal,
      update: () => {},
      dispose: () => {
        try {
          held.stop();
        } catch {
          /* */
        }
        input.disconnect();
        tap.disconnect();
        held.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildAtt(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const input = ctx.createGain();
    input.gain.value = 1;
    const scale = ctx.createGain();
    const offsetSrc = ctx.createConstantSource();
    const sum = ctx.createGain();
    sum.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    input.connect(scale);
    scale.connect(sum);
    offsetSrc.connect(sum);
    sum.connect(analyser);
    offsetSrc.start();

    const gain = createModTarget(ctx, {
      min: -1,
      max: 1,
      initial: Number(node.params.gain ?? 1),
      destination: scale.gain,
    });
    const offset = createModTarget(ctx, {
      min: -1,
      max: 1,
      initial: Number(node.params.offset ?? 0),
      destination: offsetSrc.offset,
    });
    const mods = { gain, offset };
    const { cvIns, params } = modsToPorts(mods);
    cvIns.in = input;

    return {
      type: 'att',
      audioOut: analyser,
      cvOut: analyser,
      analyser,
      params,
      cvIns,
      update: (n) => {
        gain.setBase(Number(n.params.gain ?? 1));
        offset.setBase(Number(n.params.offset ?? 0));
      },
      dispose: () => {
        disposeMods(mods);
        try {
          offsetSrc.stop();
        } catch {
          /* */
        }
        input.disconnect();
        scale.disconnect();
        offsetSrc.disconnect();
        sum.disconnect();
        analyser.disconnect();
      },
    };
  }

  private buildDist(ctx: AudioContext, node: PatchNode): NodeRuntime {
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const output = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    input.connect(dry);
    dry.connect(output);
    input.connect(shaper);
    shaper.connect(wet);
    wet.connect(output);
    output.connect(analyser);

    let lastDrive = Number(node.params.drive ?? 4);
    shaper.curve = makeDriveCurve(lastDrive);

    // Mix: wet gain modulated; dry = 1 - mix base
    const mix = createModTarget(ctx, {
      min: 0,
      max: 1,
      initial: Number(node.params.mix ?? 0.5),
      destination: wet.gain,
    });
    const driveCtrl = createModControl(ctx, {
      min: 1,
      max: 20,
      initial: lastDrive,
    });
    const mods = { mix, drive: driveCtrl };
    const { cvIns, params } = modsToPorts(mods);

    const apply = (n: PatchNode) => {
      const m = clamp(Number(n.params.mix ?? 0.5), 0, 1);
      mix.setBase(m);
      dry.gain.setTargetAtTime(1 - m, ctx.currentTime, 0.02);
      driveCtrl.setBase(Number(n.params.drive ?? 4));
      const d = clamp(driveCtrl.read(), 1, 20);
      if (Math.abs(d - lastDrive) > 0.05) {
        lastDrive = d;
        shaper.curve = makeDriveCurve(d);
      }
    };
    apply(node);

    // Periodically refresh curve from modulated drive
    let raf = 0;
    const tick = () => {
      const d = clamp(driveCtrl.read(), 1, 20);
      if (Math.abs(d - lastDrive) > 0.15) {
        lastDrive = d;
        shaper.curve = makeDriveCurve(d);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return {
      type: 'dist',
      audioIn: input,
      audioOut: analyser,
      analyser,
      params,
      cvIns,
      update: apply,
      dispose: () => {
        cancelAnimationFrame(raf);
        disposeMods(mods);
        input.disconnect();
        dry.disconnect();
        wet.disconnect();
        shaper.disconnect();
        output.disconnect();
        analyser.disconnect();
      },
    };
  }

  dispose() {
    this.setPlaying(false);
    this.teardown();
    void this.ctx?.close();
    this.ctx = null;
  }
}

function makeNoiseBuffer(
  ctx: AudioContext,
  type: 'white' | 'pink',
): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  return buf;
}

function makeDriveCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const curve = new Float32Array(n);
  const k = Math.max(1, drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return curve;
}
