import type { ModuleType } from '../modules/types';
import { MODULE_DEFS } from '../modules/registry';
import { ModuleParams } from './ModuleParams';

interface Props {
  moduleType: ModuleType | null;
  params: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
  onDelete?: () => void;
}

export function Inspector({ moduleType, params, onChange, onDelete }: Props) {
  if (!moduleType) {
    return (
      <div className="inspector">
        <h2>Inspector</h2>
        <p className="hint">Select a node to edit parameters.</p>
      </div>
    );
  }

  const def = MODULE_DEFS[moduleType];

  return (
    <div className="inspector">
      <div className="inspector-head">
        <h2>{def.name}</h2>
        {onDelete && (
          <button type="button" className="btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
      <div className="inspector-params">
        <ModuleParams
          moduleType={moduleType}
          params={params}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
