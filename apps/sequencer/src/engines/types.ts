import type { ScaleId } from '../scale/scales';
import type { Scene } from '../viz/types';

export type EngineId =
  | 'linear'
  | 'radar'
  | 'bounce'
  | 'rain'
  | 'strings'
  | 'tree'
  | 'pulses'
  | 'ratchet'
  | 'cycles'
  | 'phrase'
  | 'arp'
  | 'brownian'
  | 'orbit'
  | 'cellular'
  | 'markov'
  | 'polyrhythm'
  | 'swarm'
  | 'pendulum'
  | 'lissajous'
  | 'ripple';

export interface SharedParams {
  rootNote: number;
  octave: number;
  scaleId: ScaleId;
  gate: number;
  velocity: number;
}

export interface ScheduledNote {
  note: number;
  velocity: number;
  durationBeats: number;
  delayMs?: number;
}

export interface Engine {
  id: EngineId;
  name: string;
  step: (
    dt: number,
    shared: SharedParams,
    beat?: number,
  ) => ScheduledNote[];
  onTick: (beat: number, shared: SharedParams) => ScheduledNote[];
  reset: () => void;
  getScene: () => Scene;
}

export const ENGINE_META: { id: EngineId; name: string }[] = [
  { id: 'linear', name: 'Linear' },
  { id: 'radar', name: 'Radar' },
  { id: 'bounce', name: 'Bouncing spheres' },
  { id: 'rain', name: 'Rain' },
  { id: 'strings', name: 'Strings' },
  { id: 'tree', name: 'Tree branches' },
  { id: 'pulses', name: 'Pulses' },
  { id: 'ratchet', name: 'Ratchet' },
  { id: 'cycles', name: 'Cycles' },
  { id: 'phrase', name: 'Phrase' },
  { id: 'arp', name: 'Arp' },
  { id: 'brownian', name: 'Brownian' },
  { id: 'orbit', name: 'Orbit' },
  { id: 'cellular', name: 'Cellular' },
  { id: 'markov', name: 'Markov' },
  { id: 'polyrhythm', name: 'Polyrhythm' },
  { id: 'swarm', name: 'Swarm' },
  { id: 'pendulum', name: 'Pendulum' },
  { id: 'lissajous', name: 'Lissajous' },
  { id: 'ripple', name: 'Ripple' },
];

export const TEAL: [number, number, number, number] = [0.37, 0.92, 0.83, 1];
export const AMBER: [number, number, number, number] = [0.91, 0.72, 0.43, 1];
export const DIM: [number, number, number, number] = [0.16, 0.22, 0.28, 1];
export const MUTED: [number, number, number, number] = [0.1, 0.13, 0.16, 1];
