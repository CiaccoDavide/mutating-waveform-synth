export type PortKind = 'audio' | 'cv' | 'gate';
export type PortDir = 'in' | 'out';

export type ModuleCategory = 'voice' | 'effects' | 'timing';

export type ModuleType =
  | 'osc'
  | 'env'
  | 'filter'
  | 'vca'
  | 'out'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'clock'
  | 'seq'
  | 'quant'
  | 'lfo'
  | 'mixer'
  | 'noise'
  | 'sh'
  | 'att'
  | 'dist'
  | 'turing'
  | 'euclid';

export interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
  dir: PortDir;
}

export interface ParamDef {
  key: string;
  label: string;
  kind: 'float' | 'int' | 'enum';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** When false, no auto CV in port (default: true for float) */
  modulate?: boolean;
}

export interface ModuleDef {
  type: ModuleType;
  name: string;
  category: ModuleCategory;
  ports: PortDef[];
  params: ParamDef[];
  defaults: Record<string, number | string>;
}

export interface PatchNode {
  id: string;
  type: ModuleType;
  x: number;
  y: number;
  params: Record<string, number | string>;
}

export interface PatchEdge {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}

export interface Patch {
  id: string;
  name: string;
  nodes: PatchNode[];
  edges: PatchEdge[];
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
