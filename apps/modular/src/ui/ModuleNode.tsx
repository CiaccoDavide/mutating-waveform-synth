import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MODULE_DEFS } from '../modules/registry';
import type { ModuleType, PortKind } from '../modules/types';
import type { ModularEngine } from '../audio/ModularEngine';
import { portHandleId } from '../patch/factory';
import { MiniViz } from './MiniViz';
import { ModuleParams } from './ModuleParams';

export type ModuleNodeData = {
  moduleType: ModuleType;
  params: Record<string, number | string>;
  engine: ModularEngine;
  expanded?: boolean;
  selectedId?: string | null;
  onParamChange?: (nodeId: string, key: string, value: number | string) => void;
  onDeleteNode?: (nodeId: string) => void;
};

const KIND_CLASS: Record<PortKind, string> = {
  audio: 'port-audio',
  cv: 'port-cv',
  gate: 'port-gate',
};

export function ModuleNode({ id, data, selected }: NodeProps) {
  const d = data as ModuleNodeData;
  const def = MODULE_DEFS[d.moduleType];
  const inputs = def.ports.filter((p) => p.dir === 'in');
  const outputs = def.ports.filter((p) => p.dir === 'out');
  const expanded = Boolean(d.expanded);
  const vizW = expanded ? 120 : 72;
  const vizH = expanded ? 40 : 28;

  return (
    <div
      className={`module-node${expanded ? ' expanded' : ' compact'}${selected ? ' selected' : ''}`}
      title={def.category}
    >
      <div className="module-head">
        <span className="module-title">{def.name}</span>
        {expanded && selected && d.onDeleteNode && (
          <button
            type="button"
            className="btn danger module-delete nodrag nopan"
            onClick={(e) => {
              e.stopPropagation();
              d.onDeleteNode?.(id);
            }}
          >
            ×
          </button>
        )}
      </div>
      <div className="module-body">
        <div className="module-ports in">
          {inputs.map((p) => (
            <div key={p.id} className="port-row">
              <Handle
                type="target"
                position={Position.Left}
                id={portHandleId(p.id, 'in')}
                className={`port-handle ${KIND_CLASS[p.kind]}`}
                title={`${p.label} (${p.kind})`}
              />
              <span className={`port-label ${KIND_CLASS[p.kind]}`}>{p.label}</span>
            </div>
          ))}
        </div>
        <MiniViz
          nodeId={id}
          type={d.moduleType}
          engine={d.engine}
          params={d.params}
          width={vizW}
          height={vizH}
        />
        <div className="module-ports out">
          {outputs.map((p) => (
            <div key={p.id} className="port-row out">
              <span className={`port-label ${KIND_CLASS[p.kind]}`}>{p.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={portHandleId(p.id, 'out')}
                className={`port-handle ${KIND_CLASS[p.kind]}`}
                title={`${p.label} (${p.kind})`}
              />
            </div>
          ))}
        </div>
      </div>
      {expanded && d.onParamChange && (
        <div className="module-inline-params nodrag nopan">
          <ModuleParams
            moduleType={d.moduleType}
            params={d.params}
            onChange={(key, value) => d.onParamChange?.(id, key, value)}
            compact
          />
        </div>
      )}
    </div>
  );
}
