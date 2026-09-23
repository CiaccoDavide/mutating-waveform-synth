import { MODULE_DEFS } from '../modules/registry';
import type { Patch, PatchEdge, PortKind } from '../modules/types';

export function getPortKind(
  patch: Patch,
  nodeId: string,
  portId: string,
): PortKind | null {
  const node = patch.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const port = MODULE_DEFS[node.type].ports.find((p) => p.id === portId);
  return port?.kind ?? null;
}

/** Same-kind, or audio → CV (modulation). One edge per destination input. */
export function canConnect(
  patch: Patch,
  fromNode: string,
  fromPort: string,
  toNode: string,
  toPort: string,
): boolean {
  if (fromNode === toNode) return false;
  const a = getPortKind(patch, fromNode, fromPort);
  const b = getPortKind(patch, toNode, toPort);
  if (!a || !b) return false;
  const compatible =
    a === b || (a === 'audio' && b === 'cv');
  if (!compatible) return false;
  const fromDef = MODULE_DEFS[patch.nodes.find((n) => n.id === fromNode)!.type];
  const toDef = MODULE_DEFS[patch.nodes.find((n) => n.id === toNode)!.type];
  const fp = fromDef.ports.find((p) => p.id === fromPort);
  const tp = toDef.ports.find((p) => p.id === toPort);
  if (!fp || !tp || fp.dir !== 'out' || tp.dir !== 'in') return false;
  return true;
}

export function replaceInputEdge(
  edges: PatchEdge[],
  edge: PatchEdge,
): PatchEdge[] {
  return [
    ...edges.filter(
      (e) => !(e.to.node === edge.to.node && e.to.port === edge.to.port),
    ),
    edge,
  ];
}
