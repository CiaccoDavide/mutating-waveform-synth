import { MODULE_DEFS } from '../modules/registry';
import type { ModuleType, Patch, PatchEdge, PatchNode } from '../modules/types';
import { uid } from '../modules/types';

/** Expanded-friendly column / row pitch (~180–220px nodes). */
const COL = 300;
const ROW = 260;
const OX = 60;
const OY = 40;

export function createNode(
  type: ModuleType,
  x: number,
  y: number,
): PatchNode {
  const def = MODULE_DEFS[type];
  return {
    id: uid(type),
    type,
    x,
    y,
    params: { ...def.defaults },
  };
}

function edge(
  from: PatchNode,
  fromPort: string,
  to: PatchNode,
  toPort: string,
): PatchEdge {
  return {
    id: uid('e'),
    from: { node: from.id, port: fromPort },
    to: { node: to.id, port: toPort },
  };
}

function at(col: number, row: number) {
  return { x: OX + col * COL, y: OY + row * ROW };
}

/** Default audible mono voice: osc → filter → vca → out, env → vca.cv */
export function starterPatch(): Patch {
  const osc = createNode('osc', at(0, 0).x, at(0, 0).y);
  const env = createNode('env', at(0, 1).x, at(0, 1).y);
  const filter = createNode('filter', at(1, 0).x, at(1, 0).y);
  const vca = createNode('vca', at(2, 0).x, at(2, 0).y + 40);
  const out = createNode('out', at(3, 0).x, at(3, 0).y + 40);

  return {
    id: uid('patch'),
    name: 'Core voice',
    nodes: [osc, env, filter, vca, out],
    edges: [
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(vca, 'out', out, 'audio'),
      edge(env, 'cv', vca, 'cv'),
    ],
  };
}

/** Self-playing: clock → seq → env + quant → osc → … → FX → out */
export function selfPlayPatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const seq = createNode('seq', at(0, 1).x, at(0, 1).y);
  const quant = createNode('quant', at(0, 2).x, at(0, 2).y);
  const osc = createNode('osc', at(1, 0).x, at(1, 0).y + 80);
  const env = createNode('env', at(1, 1).x, at(1, 1).y + 40);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 80);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 80);
  const chorus = createNode('chorus', at(4, 0).x, at(4, 0).y);
  const delay = createNode('delay', at(5, 0).x, at(5, 0).y);
  const reverb = createNode('reverb', at(6, 0).x, at(6, 0).y);
  const out = createNode('out', at(7, 0).x, at(7, 0).y);

  clock.params.bpm = 100;
  seq.params.steps = '8';
  osc.params.wave = 'sawtooth';
  osc.params.amp = 0.3;
  env.params.attack = 0.005;
  env.params.decay = 0.15;
  env.params.sustain = 0.5;
  env.params.release = 0.18;
  filter.params.cutoff = 2400;
  chorus.params.mix = 0.3;
  delay.params.mix = 0.22;
  reverb.params.mix = 0.28;

  return {
    id: uid('patch'),
    name: 'Self-play',
    nodes: [
      clock,
      seq,
      quant,
      osc,
      env,
      filter,
      vca,
      chorus,
      delay,
      reverb,
      out,
    ],
    edges: [
      edge(clock, 'gate', seq, 'clock'),
      edge(seq, 'gate', env, 'gate'),
      edge(seq, 'pitch', quant, 'in'),
      edge(quant, 'out', osc, 'freq'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', chorus, 'audio'),
      edge(chorus, 'out', delay, 'audio'),
      edge(delay, 'out', reverb, 'audio'),
      edge(reverb, 'out', out, 'audio'),
    ],
  };
}

/** Slow LFO sweeps filter; Gate for soft swells. */
export function driftingDronePatch(): Patch {
  const lfo = createNode('lfo', at(0, 0).x, at(0, 0).y);
  const osc = createNode('osc', at(0, 1).x, at(0, 1).y);
  const env = createNode('env', at(0, 2).x, at(0, 2).y);
  const filter = createNode('filter', at(1, 0).x, at(1, 0).y + 80);
  const vca = createNode('vca', at(2, 0).x, at(2, 0).y + 80);
  const reverb = createNode('reverb', at(3, 0).x, at(3, 0).y + 80);
  const out = createNode('out', at(4, 0).x, at(4, 0).y + 80);

  lfo.params.rate = 0.08;
  lfo.params.depth = 0.7;
  lfo.params.offset = 0.45;
  lfo.params.wave = 'sine';
  osc.params.wave = 'sawtooth';
  osc.params.freq = 55;
  osc.params.amp = 0.4;
  filter.params.cutoff = 800;
  filter.params.q = 2.5;
  env.params.attack = 0.4;
  env.params.decay = 0.8;
  env.params.sustain = 0.85;
  env.params.release = 1.5;
  reverb.params.mix = 0.45;
  reverb.params.size = 0.7;
  reverb.params.decay = 0.65;

  return {
    id: uid('patch'),
    name: 'Drifting drone',
    nodes: [lfo, osc, env, filter, vca, reverb, out],
    edges: [
      edge(lfo, 'cv', filter, 'cutoff'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', reverb, 'audio'),
      edge(reverb, 'out', out, 'audio'),
    ],
  };
}

/** Detuned dual osc through mixer; LFO beats osc2 via att. */
export function dualMixPatch(): Patch {
  const osc1 = createNode('osc', at(0, 0).x, at(0, 0).y);
  const osc2 = createNode('osc', at(0, 1).x, at(0, 1).y);
  const lfo = createNode('lfo', at(0, 2).x, at(0, 2).y);
  const att = createNode('att', at(1, 2).x, at(1, 2).y);
  const mixer = createNode('mixer', at(1, 0).x, at(1, 0).y + 60);
  const env = createNode('env', at(1, 1).x, at(1, 1).y + 40);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 60);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 60);
  const out = createNode('out', at(4, 0).x, at(4, 0).y + 60);

  osc1.params.wave = 'sawtooth';
  osc1.params.freq = 110;
  osc1.params.amp = 0.32;
  osc2.params.wave = 'triangle';
  osc2.params.freq = 111.5;
  osc2.params.amp = 0.28;
  lfo.params.rate = 0.15;
  lfo.params.depth = 0.6;
  lfo.params.offset = 0.5;
  att.params.gain = 0.35;
  att.params.offset = 0;
  mixer.params.levelA = 0.75;
  mixer.params.levelB = 0.7;
  mixer.params.master = 0.75;
  filter.params.cutoff = 2200;
  filter.params.q = 1.8;
  env.params.attack = 0.08;
  env.params.decay = 0.3;
  env.params.sustain = 0.7;
  env.params.release = 0.5;

  return {
    id: uid('patch'),
    name: 'Dual mix',
    nodes: [osc1, osc2, lfo, att, mixer, env, filter, vca, out],
    edges: [
      edge(osc1, 'audio', mixer, 'a'),
      edge(osc2, 'audio', mixer, 'b'),
      edge(lfo, 'cv', att, 'in'),
      edge(att, 'cv', osc2, 'freq'),
      edge(mixer, 'out', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', out, 'audio'),
    ],
  };
}

/** Clocked S&H on noise into filter; Play for self-running texture. */
export function noiseHoldPatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const noise = createNode('noise', at(0, 1).x, at(0, 1).y);
  const sh = createNode('sh', at(1, 0).x, at(1, 0).y);
  const env = createNode('env', at(1, 1).x, at(1, 1).y);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 40);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 40);
  const dist = createNode('dist', at(4, 0).x, at(4, 0).y + 40);
  const out = createNode('out', at(5, 0).x, at(5, 0).y + 40);

  clock.params.bpm = 90;
  clock.params.div = '1/2';
  noise.params.type = 'pink';
  noise.params.level = 0.45;
  filter.params.type = 'bandpass';
  filter.params.cutoff = 1200;
  filter.params.q = 6;
  env.params.attack = 0.002;
  env.params.decay = 0.08;
  env.params.sustain = 0.15;
  env.params.release = 0.12;
  dist.params.drive = 8;
  dist.params.mix = 0.55;

  return {
    id: uid('patch'),
    name: 'Noise & hold',
    nodes: [clock, noise, sh, env, filter, vca, dist, out],
    edges: [
      edge(clock, 'gate', sh, 'gate'),
      edge(clock, 'gate', env, 'gate'),
      edge(noise, 'audio', sh, 'in'),
      edge(noise, 'audio', filter, 'audio'),
      edge(sh, 'cv', filter, 'cutoff'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', dist, 'audio'),
      edge(dist, 'out', out, 'audio'),
    ],
  };
}

/** Punchy sequenced grit: seq → voice → dist → delay. */
export function seqGritPatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const seq = createNode('seq', at(0, 1).x, at(0, 1).y);
  const quant = createNode('quant', at(0, 2).x, at(0, 2).y);
  const osc = createNode('osc', at(1, 0).x, at(1, 0).y + 80);
  const env = createNode('env', at(1, 1).x, at(1, 1).y + 40);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 80);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 80);
  const dist = createNode('dist', at(4, 0).x, at(4, 0).y + 80);
  const delay = createNode('delay', at(5, 0).x, at(5, 0).y + 80);
  const out = createNode('out', at(6, 0).x, at(6, 0).y + 80);

  clock.params.bpm = 128;
  clock.params.div = '1/2';
  seq.params.steps = '8';
  seq.params.gateLen = 0.35;
  seq.params.p0 = 0;
  seq.params.p1 = 3;
  seq.params.p2 = 5;
  seq.params.p3 = 7;
  seq.params.p4 = 3;
  seq.params.p5 = 10;
  seq.params.p6 = 7;
  seq.params.p7 = 12;
  quant.params.scale = 'minor';
  osc.params.wave = 'square';
  osc.params.amp = 0.35;
  env.params.attack = 0.002;
  env.params.decay = 0.1;
  env.params.sustain = 0.25;
  env.params.release = 0.08;
  filter.params.cutoff = 1800;
  filter.params.q = 4;
  dist.params.drive = 10;
  dist.params.mix = 0.65;
  delay.params.mix = 0.28;
  delay.params.timeMs = 180;
  delay.params.feedback = 0.45;

  return {
    id: uid('patch'),
    name: 'Seq grit',
    nodes: [clock, seq, quant, osc, env, filter, vca, dist, delay, out],
    edges: [
      edge(clock, 'gate', seq, 'clock'),
      edge(seq, 'gate', env, 'gate'),
      edge(seq, 'pitch', quant, 'in'),
      edge(quant, 'out', osc, 'freq'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', dist, 'audio'),
      edge(dist, 'out', delay, 'audio'),
      edge(delay, 'out', out, 'audio'),
    ],
  };
}

/** Probabilistic Turing Machine → voice → delay. */
export function turingLoopPatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const turing = createNode('turing', at(0, 1).x, at(0, 1).y);
  const osc = createNode('osc', at(1, 0).x, at(1, 0).y + 40);
  const env = createNode('env', at(1, 1).x, at(1, 1).y);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 40);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 40);
  const delay = createNode('delay', at(4, 0).x, at(4, 0).y + 40);
  const out = createNode('out', at(5, 0).x, at(5, 0).y + 40);

  clock.params.bpm = 108;
  clock.params.div = '1/2';
  turing.params.prob = 0.4;
  turing.params.length = '8';
  turing.params.scale = 'pentatonic';
  osc.params.wave = 'pulse';
  osc.params.pw = 0.35;
  osc.params.amp = 0.32;
  osc.params.fm = 0.12;
  osc.params.fmRatio = 2;
  env.params.attack = 0.005;
  env.params.decay = 0.14;
  env.params.sustain = 0.35;
  env.params.release = 0.12;
  filter.params.cutoff = 2800;
  filter.params.q = 2.5;
  delay.params.mix = 0.25;
  delay.params.timeMs = 280;

  return {
    id: uid('patch'),
    name: 'Turing loop',
    nodes: [clock, turing, osc, env, filter, vca, delay, out],
    edges: [
      edge(clock, 'gate', turing, 'clock'),
      edge(turing, 'gate', env, 'gate'),
      edge(turing, 'pitch', osc, 'freq'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', delay, 'audio'),
      edge(delay, 'out', out, 'audio'),
    ],
  };
}

/** Euclidean gates into a punchy voice. */
export function euclidPulsePatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const euclid = createNode('euclid', at(0, 1).x, at(0, 1).y);
  const osc = createNode('osc', at(1, 0).x, at(1, 0).y + 40);
  const env = createNode('env', at(1, 1).x, at(1, 1).y);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 40);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 40);
  const out = createNode('out', at(4, 0).x, at(4, 0).y + 40);

  clock.params.bpm = 120;
  clock.params.div = '1/4';
  euclid.params.steps = 16;
  euclid.params.fills = 5;
  euclid.params.rotate = 3;
  osc.params.wave = 'triangle';
  osc.params.freq = 80;
  osc.params.amp = 0.4;
  env.params.attack = 0.002;
  env.params.decay = 0.18;
  env.params.sustain = 0.1;
  env.params.release = 0.08;
  filter.params.cutoff = 1600;
  filter.params.q = 3;

  return {
    id: uid('patch'),
    name: 'Euclid pulse',
    nodes: [clock, euclid, osc, env, filter, vca, out],
    edges: [
      edge(clock, 'gate', euclid, 'clock'),
      edge(euclid, 'gate', env, 'gate'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', out, 'audio'),
    ],
  };
}

/** Pulse osc with LFO on PW and soft reverb pad. */
export function pwmPadPatch(): Patch {
  const lfo = createNode('lfo', at(0, 0).x, at(0, 0).y);
  const osc = createNode('osc', at(0, 1).x, at(0, 1).y);
  const env = createNode('env', at(0, 2).x, at(0, 2).y);
  const filter = createNode('filter', at(1, 0).x, at(1, 0).y + 80);
  const vca = createNode('vca', at(2, 0).x, at(2, 0).y + 80);
  const reverb = createNode('reverb', at(3, 0).x, at(3, 0).y + 80);
  const out = createNode('out', at(4, 0).x, at(4, 0).y + 80);

  lfo.params.rate = 0.18;
  lfo.params.depth = 0.45;
  lfo.params.offset = 0.5;
  osc.params.wave = 'pulse';
  osc.params.pw = 0.4;
  osc.params.freq = 110;
  osc.params.amp = 0.32;
  env.params.attack = 0.35;
  env.params.decay = 0.5;
  env.params.sustain = 0.75;
  env.params.release = 1.2;
  filter.params.cutoff = 2400;
  reverb.params.mix = 0.4;
  reverb.params.size = 0.65;

  return {
    id: uid('patch'),
    name: 'PWM pad',
    nodes: [lfo, osc, env, filter, vca, reverb, out],
    edges: [
      edge(lfo, 'cv', osc, 'pw'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', reverb, 'audio'),
      edge(reverb, 'out', out, 'audio'),
    ],
  };
}

/** Euclid gates + Turing pitch into one voice. */
export function euclidTuringPatch(): Patch {
  const clock = createNode('clock', at(0, 0).x, at(0, 0).y);
  const euclid = createNode('euclid', at(0, 1).x, at(0, 1).y);
  const turing = createNode('turing', at(0, 2).x, at(0, 2).y);
  const osc = createNode('osc', at(1, 0).x, at(1, 0).y + 80);
  const env = createNode('env', at(1, 1).x, at(1, 1).y + 40);
  const filter = createNode('filter', at(2, 0).x, at(2, 0).y + 80);
  const vca = createNode('vca', at(3, 0).x, at(3, 0).y + 80);
  const delay = createNode('delay', at(4, 0).x, at(4, 0).y + 80);
  const out = createNode('out', at(5, 0).x, at(5, 0).y + 80);

  clock.params.bpm = 112;
  clock.params.div = '1/2';
  euclid.params.steps = 16;
  euclid.params.fills = 7;
  euclid.params.rotate = 2;
  turing.params.prob = 0.25;
  turing.params.scale = 'dorian';
  turing.params.locked = 'off';
  osc.params.wave = 'sawtooth';
  osc.params.amp = 0.3;
  env.params.attack = 0.005;
  env.params.decay = 0.12;
  env.params.sustain = 0.3;
  env.params.release = 0.1;
  filter.params.cutoff = 2200;
  delay.params.mix = 0.22;

  return {
    id: uid('patch'),
    name: 'Euclid + Turing',
    nodes: [clock, euclid, turing, osc, env, filter, vca, delay, out],
    edges: [
      edge(clock, 'gate', euclid, 'clock'),
      edge(clock, 'gate', turing, 'clock'),
      edge(euclid, 'gate', env, 'gate'),
      edge(turing, 'pitch', osc, 'freq'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', delay, 'audio'),
      edge(delay, 'out', out, 'audio'),
    ],
  };
}

/** FM osc into distortion and delay. */
export function fmGritPatch(): Patch {
  const osc = createNode('osc', at(0, 0).x, at(0, 0).y);
  const env = createNode('env', at(0, 1).x, at(0, 1).y);
  const filter = createNode('filter', at(1, 0).x, at(1, 0).y);
  const vca = createNode('vca', at(2, 0).x, at(2, 0).y);
  const dist = createNode('dist', at(3, 0).x, at(3, 0).y);
  const delay = createNode('delay', at(4, 0).x, at(4, 0).y);
  const out = createNode('out', at(5, 0).x, at(5, 0).y);

  osc.params.wave = 'sine';
  osc.params.freq = 55;
  osc.params.fm = 0.55;
  osc.params.fmRatio = 3.2;
  osc.params.amp = 0.4;
  env.params.attack = 0.01;
  env.params.decay = 0.25;
  env.params.sustain = 0.45;
  env.params.release = 0.3;
  filter.params.cutoff = 3200;
  filter.params.q = 2;
  dist.params.drive = 9;
  dist.params.mix = 0.6;
  delay.params.mix = 0.3;
  delay.params.feedback = 0.4;

  return {
    id: uid('patch'),
    name: 'FM grit',
    nodes: [osc, env, filter, vca, dist, delay, out],
    edges: [
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', dist, 'audio'),
      edge(dist, 'out', delay, 'audio'),
      edge(delay, 'out', out, 'audio'),
    ],
  };
}

/** Bipolar LFO sweeps filter on a held drone. */
export function bipolarFilterPatch(): Patch {
  const lfo = createNode('lfo', at(0, 0).x, at(0, 0).y);
  const osc = createNode('osc', at(0, 1).x, at(0, 1).y);
  const env = createNode('env', at(0, 2).x, at(0, 2).y);
  const filter = createNode('filter', at(1, 0).x, at(1, 0).y + 80);
  const vca = createNode('vca', at(2, 0).x, at(2, 0).y + 80);
  const reverb = createNode('reverb', at(3, 0).x, at(3, 0).y + 80);
  const out = createNode('out', at(4, 0).x, at(4, 0).y + 80);

  lfo.params.wave = 'triangle';
  lfo.params.bipolar = 'bi';
  lfo.params.rate = 0.09;
  lfo.params.depth = 0.7;
  lfo.params.offset = 0.5;
  osc.params.wave = 'sawtooth';
  osc.params.freq = 65;
  osc.params.amp = 0.35;
  env.params.attack = 0.5;
  env.params.decay = 0.4;
  env.params.sustain = 0.9;
  env.params.release = 1.8;
  filter.params.cutoff = 900;
  filter.params.q = 4;
  reverb.params.mix = 0.35;

  return {
    id: uid('patch'),
    name: 'Bipolar filter',
    nodes: [lfo, osc, env, filter, vca, reverb, out],
    edges: [
      edge(lfo, 'cv', filter, 'cutoff'),
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
      edge(vca, 'out', reverb, 'audio'),
      edge(reverb, 'out', out, 'audio'),
    ],
  };
}

export function blankPatch(): Patch {
  return {
    id: uid('patch'),
    name: 'Untitled',
    nodes: [],
    edges: [],
  };
}

export function portHandleId(portId: string, dir: 'in' | 'out') {
  return `${dir}-${portId}`;
}

export function parseHandleId(
  handle: string,
): { dir: 'in' | 'out'; port: string } | null {
  if (handle.startsWith('in-')) return { dir: 'in', port: handle.slice(3) };
  if (handle.startsWith('out-')) return { dir: 'out', port: handle.slice(4) };
  return null;
}
