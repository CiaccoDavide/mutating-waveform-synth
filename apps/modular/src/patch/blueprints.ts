import type { Patch, PatchEdge, PatchNode } from '../modules/types';
import { uid } from '../modules/types';
import { createNode } from './factory';

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  patch: Patch;
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

function fragment(
  name: string,
  nodes: PatchNode[],
  edges: PatchEdge[],
): Patch {
  return { id: uid('bp'), name, nodes, edges };
}

/** Remint ids and place blueprint to the right of the current graph. */
export function mergeBlueprint(current: Patch, bp: Patch): Patch {
  const idMap = new Map<string, string>();
  for (const n of bp.nodes) {
    idMap.set(n.id, uid(n.type));
  }

  let originX = 60;
  let originY = 40;
  if (current.nodes.length > 0) {
    let maxX = -Infinity;
    let minY = Infinity;
    for (const n of current.nodes) {
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
    }
    originX = maxX + 320;
    originY = Number.isFinite(minY) ? minY : 40;
  }

  let minBx = Infinity;
  let minBy = Infinity;
  for (const n of bp.nodes) {
    minBx = Math.min(minBx, n.x);
    minBy = Math.min(minBy, n.y);
  }
  if (!Number.isFinite(minBx)) minBx = 0;
  if (!Number.isFinite(minBy)) minBy = 0;

  const nodes: PatchNode[] = [
    ...current.nodes,
    ...bp.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      x: originX + (n.x - minBx),
      y: originY + (n.y - minBy),
      params: { ...n.params },
    })),
  ];

  const edges: PatchEdge[] = [
    ...current.edges,
    ...bp.edges.map((e) => ({
      id: uid('e'),
      from: {
        node: idMap.get(e.from.node) ?? e.from.node,
        port: e.from.port,
      },
      to: {
        node: idMap.get(e.to.node) ?? e.to.node,
        port: e.to.port,
      },
    })),
  ];

  return {
    id: current.id,
    name: current.name,
    nodes,
    edges,
  };
}

function voiceChain(): Patch {
  const osc = createNode('osc', 0, 0);
  const env = createNode('env', 0, 260);
  const filter = createNode('filter', 300, 0);
  const vca = createNode('vca', 600, 40);
  return fragment(
    'Voice chain',
    [osc, env, filter, vca],
    [
      edge(osc, 'audio', filter, 'audio'),
      edge(filter, 'out', vca, 'audio'),
      edge(env, 'cv', vca, 'cv'),
    ],
  );
}

function fxChain(): Patch {
  const chorus = createNode('chorus', 0, 0);
  const delay = createNode('delay', 300, 0);
  const reverb = createNode('reverb', 600, 0);
  chorus.params.mix = 0.3;
  delay.params.mix = 0.25;
  reverb.params.mix = 0.3;
  return fragment(
    'FX chain',
    [chorus, delay, reverb],
    [
      edge(chorus, 'out', delay, 'audio'),
      edge(delay, 'out', reverb, 'audio'),
    ],
  );
}

function clockEuclid(): Patch {
  const clock = createNode('clock', 0, 0);
  const euclid = createNode('euclid', 0, 260);
  clock.params.bpm = 120;
  clock.params.div = '1/4';
  euclid.params.steps = 16;
  euclid.params.fills = 5;
  return fragment(
    'Clock + Euclid',
    [clock, euclid],
    [edge(clock, 'gate', euclid, 'clock')],
  );
}

function clockTuring(): Patch {
  const clock = createNode('clock', 0, 0);
  const turing = createNode('turing', 0, 260);
  clock.params.bpm = 100;
  turing.params.prob = 0.35;
  turing.params.scale = 'minor';
  return fragment(
    'Clock + Turing',
    [clock, turing],
    [edge(clock, 'gate', turing, 'clock')],
  );
}

function lfoSweep(): Patch {
  const lfo = createNode('lfo', 0, 0);
  lfo.params.rate = 0.12;
  lfo.params.depth = 0.6;
  lfo.params.offset = 0.5;
  lfo.params.wave = 'sine';
  return fragment('LFO sweep', [lfo], []);
}

function dualOscMix(): Patch {
  const osc1 = createNode('osc', 0, 0);
  const osc2 = createNode('osc', 0, 260);
  const mixer = createNode('mixer', 300, 80);
  osc1.params.freq = 110;
  osc2.params.wave = 'triangle';
  osc2.params.freq = 165;
  mixer.params.levelA = 0.7;
  mixer.params.levelB = 0.55;
  return fragment(
    'Dual osc mix',
    [osc1, osc2, mixer],
    [
      edge(osc1, 'audio', mixer, 'a'),
      edge(osc2, 'audio', mixer, 'b'),
    ],
  );
}

export function factoryBlueprints(): Blueprint[] {
  return [
    {
      id: 'bp-voice',
      name: 'Voice chain',
      description: 'Osc → filter → VCA + env',
      patch: voiceChain(),
    },
    {
      id: 'bp-fx',
      name: 'FX chain',
      description: 'Chorus → delay → reverb',
      patch: fxChain(),
    },
    {
      id: 'bp-euclid',
      name: 'Clock + Euclid',
      description: 'Clocked Euclidean gates',
      patch: clockEuclid(),
    },
    {
      id: 'bp-turing',
      name: 'Clock + Turing',
      description: 'Clocked Turing pitch + gate',
      patch: clockTuring(),
    },
    {
      id: 'bp-lfo',
      name: 'LFO sweep',
      description: 'Slow LFO for cutoff / PW',
      patch: lfoSweep(),
    },
    {
      id: 'bp-dual',
      name: 'Dual osc mix',
      description: 'Two oscs into a mixer',
      patch: dualOscMix(),
    },
  ];
}
